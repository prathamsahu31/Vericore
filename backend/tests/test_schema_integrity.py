"""Verifies the guarantees the first migration is supposed to install.

These are not tests of application code — there is no application code yet.
They test that the *database* refuses to do things CLAUDE.md says it must
refuse, so that later features inherit those guarantees rather than having to
re-implement them.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

EXPECTED_TABLES = {
    "audit_events",
    "bid_members",
    "bidders",
    "bids",
    "compliance_results",
    "cross_document_findings",
    "document_segments",
    "documents",
    "evidence",
    "extracted_fields",
    "portal_checks",
    "reports",
    "requirements",
    "risk_flags",
    "tenders",
    "users",
    "verification_runs",
}

GENESIS = "0" * 64


def _make_bid(conn) -> uuid.UUID:
    """A tender and a bid, supplying only genuinely required columns.

    Nothing here passes ``currency``, ``status`` or an ``id``. That is the
    point: every NOT NULL column with a default carries a server_default, so a
    plain SQL insert succeeds without the ORM's help. If this helper starts
    failing, a default has gone Python-side-only again.
    """
    tender = conn.execute(
        text("INSERT INTO tenders (title) VALUES ('Corrosion-resistant piping') RETURNING id")
    ).scalar_one()
    return conn.execute(
        text("INSERT INTO bids (tender_id) VALUES (:t) RETURNING id"), {"t": tender}
    ).scalar_one()


def _insert_audit_event(conn, event_type: str = "test_event") -> dict:
    row = (
        conn.execute(
            text("""
            INSERT INTO audit_events (id, event_type, actor_type, actor_component)
            VALUES (:id, :event_type, 'system', 'test')
            RETURNING id, seq, prev_hash, row_hash
            """),
            {"id": uuid.uuid4(), "event_type": event_type},
        )
        .mappings()
        .one()
    )
    return dict(row)


# ─────────────────────────────────────────────────────────────────────────────
# Structure
# ─────────────────────────────────────────────────────────────────────────────
def test_all_seventeen_tables_exist(conn):
    """CLAUDE.md §6 names seventeen tables. All seventeen, no more, no fewer."""
    found = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
            )
        )
    }
    assert found == EXPECTED_TABLES


def test_compliance_status_has_all_nine_states(conn):
    """The state machine of CLAUDE.md §5, enforced as a Postgres enum."""
    labels = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT e.enumlabel FROM pg_enum e "
                "JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'compliance_status'"
            )
        )
    }
    assert labels == {
        "COMPLIANT",
        "NON_COMPLIANT",
        "PARTIALLY_COMPLIANT",
        "MISSING_EVIDENCE",
        "INCONSISTENT",
        "EXPIRED",
        "UNVERIFIED",
        "NOT_APPLICABLE",
        "NEEDS_HUMAN_REVIEW",
    }


def test_applicability_scope_enum_exists(conn):
    """CLAUDE.md §20 / §23: the column ships on Day 1 even though the logic doesn't."""
    labels = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT e.enumlabel FROM pg_enum e "
                "JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'applicability_scope'"
            )
        )
    }
    assert labels == {"lead_only", "any_member", "all_members", "aggregate"}


def test_extracted_field_coordinates_are_mandatory(conn):
    """CLAUDE.md §6: page and bounding box are NOT NULL.

    A field that cannot be pointed at on the page cannot be cited, and the
    citation drill-down is the product.
    """
    nullable = {
        r[0]: r[1]
        for r in conn.execute(
            text(
                "SELECT column_name, is_nullable FROM information_schema.columns "
                "WHERE table_name = 'extracted_fields' "
                "AND column_name IN ('page','x0','y0','x1','y1')"
            )
        )
    }
    assert nullable == {"page": "NO", "x0": "NO", "y0": "NO", "x1": "NO", "y1": "NO"}


def test_bidders_are_deduplicated_by_pan(conn):
    """CLAUDE.md §6: bidders are deduplicated across tenders by PAN."""
    conn.execute(
        text("INSERT INTO bidders (id, legal_name, pan) VALUES (:i, 'Alpha Ltd', 'AAACA1111A')"),
        {"i": uuid.uuid4()},
    )
    with pytest.raises(IntegrityError):
        conn.execute(
            text("INSERT INTO bidders (id, legal_name, pan) VALUES (:i, 'Beta Ltd', 'AAACA1111A')"),
            {"i": uuid.uuid4()},
        )


# ─────────────────────────────────────────────────────────────────────────────
# Rule 2 — a simulated result can never be stored without its label
# ─────────────────────────────────────────────────────────────────────────────
def test_portal_check_cannot_omit_its_source(conn):
    """CLAUDE.md §2 rule 2, as a plain NOT NULL column on every row.

    ``source`` says whether a government-database answer was live or simulated.
    A row that cannot say is a row that must not exist.
    """
    bid = _make_bid(conn)
    with pytest.raises(IntegrityError):
        conn.execute(
            text(
                "INSERT INTO portal_checks (bid_id, portal_id, identifier, status) "
                "VALUES (:b, 'gstn', '27ABCDE1234F1Z5', 'found')"
            ),
            {"b": bid},
        )


def test_portal_check_records_a_simulated_result_as_simulated(conn):
    """The happy path: a simulated answer stores, and stores its label."""
    bid = _make_bid(conn)
    source = conn.execute(
        text(
            "INSERT INTO portal_checks (bid_id, portal_id, identifier, status, source) "
            "VALUES (:b, 'udyam', 'UDYAM-TN-33-0041827', 'found', 'simulated') "
            "RETURNING source"
        ),
        {"b": bid},
    ).scalar_one()
    assert source == "simulated"


def test_decision_requires_an_actor_and_a_justification(conn):
    """CLAUDE.md §11: every decision opens a justification that cannot be skipped."""
    bid = _make_bid(conn)
    with pytest.raises(IntegrityError):
        conn.execute(text("UPDATE bids SET decision = 'disqualify' WHERE id = :b"), {"b": bid})


def test_decision_is_accepted_when_actor_and_justification_are_present(conn):
    """The constraint must permit a properly-recorded decision, not just reject."""
    bid = _make_bid(conn)
    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('officer@cpcl.example', 'A Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    conn.execute(
        text(
            "UPDATE bids SET decision = 'disqualify', decided_by = :o, decided_at = now(), "
            "decision_justification = 'No OEM authorisation letter submitted.' WHERE id = :b"
        ),
        {"o": officer, "b": bid},
    )
    assert (
        conn.execute(text("SELECT decision FROM bids WHERE id = :b"), {"b": bid}).scalar_one()
        == "disqualify"
    )


def test_blank_justification_is_not_a_justification(conn):
    """Whitespace must not satisfy the requirement to state a reason."""
    bid = _make_bid(conn)
    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('officer2@cpcl.example', 'B Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    with pytest.raises(IntegrityError):
        conn.execute(
            text(
                "UPDATE bids SET decision = 'qualify', decided_by = :o, decided_at = now(), "
                "decision_justification = '   ' WHERE id = :b"
            ),
            {"o": officer, "b": bid},
        )


# ─────────────────────────────────────────────────────────────────────────────
# Rule 6 — append-only audit, enforced by the database
# ─────────────────────────────────────────────────────────────────────────────
def test_audit_event_update_is_rejected(conn):
    """CLAUDE.md §2 rule 6. Not application discipline — the database refuses."""
    event = _insert_audit_event(conn)
    with pytest.raises(DBAPIError) as excinfo:
        conn.execute(
            text("UPDATE audit_events SET reason = 'tampered' WHERE id = :i"),
            {"i": event["id"]},
        )
    assert "append-only" in str(excinfo.value)


def test_audit_event_delete_is_rejected(conn):
    event = _insert_audit_event(conn)
    with pytest.raises(DBAPIError) as excinfo:
        conn.execute(text("DELETE FROM audit_events WHERE id = :i"), {"i": event["id"]})
    assert "append-only" in str(excinfo.value)


def test_audit_event_truncate_is_rejected(conn):
    """TRUNCATE bypasses row-level triggers, so it needs its own statement trigger."""
    with pytest.raises(DBAPIError) as excinfo:
        conn.execute(text("TRUNCATE audit_events"))
    assert "append-only" in str(excinfo.value)


def test_hash_chain_links_each_event_to_its_predecessor(conn):
    """Each row stores prev_hash and row_hash, written by the trigger."""
    first = _insert_audit_event(conn, "first")
    second = _insert_audit_event(conn, "second")
    third = _insert_audit_event(conn, "third")

    for event in (first, second, third):
        assert len(event["row_hash"]) == 64
        assert event["row_hash"] != event["prev_hash"]

    assert second["prev_hash"] == first["row_hash"]
    assert third["prev_hash"] == second["row_hash"]
    assert second["seq"] > first["seq"]


def test_first_event_in_an_empty_chain_uses_the_genesis_hash(conn):
    """Only meaningful on a fresh database; skipped once the chain has rows."""
    existing = conn.execute(text("SELECT count(*) FROM audit_events")).scalar_one()
    if existing:
        pytest.skip("chain already has rows; genesis link is only observable when empty")
    assert _insert_audit_event(conn)["prev_hash"] == GENESIS


def test_application_supplied_hashes_are_overwritten_by_the_trigger(conn):
    """An attacker who can INSERT still cannot choose their own place in the chain."""
    row = (
        conn.execute(
            text(
                "INSERT INTO audit_events (id, event_type, actor_type, prev_hash, row_hash) "
                "VALUES (:i, 'forged', 'system', :fake, :fake) RETURNING prev_hash, row_hash"
            ),
            {"i": uuid.uuid4(), "fake": "f" * 64},
        )
        .mappings()
        .one()
    )
    assert row["row_hash"] != "f" * 64
    assert row["prev_hash"] != "f" * 64


def test_chain_verifier_reports_every_row_intact(conn):
    """vericore_audit_chain_verify() recomputes each hash and checks each link."""
    for i in range(3):
        _insert_audit_event(conn, f"event_{i}")
    rows = conn.execute(text("SELECT seq, link_ok, hash_ok FROM vericore_audit_chain_verify()"))
    results = list(rows)
    assert results, "verifier returned no rows"
    assert all(r.link_ok for r in results), "a chain link is broken"
    assert all(r.hash_ok for r in results), "a row hash does not match its content"


def test_officer_events_must_name_the_officer(conn):
    """An officer action is never anonymous in the audit trail."""
    with pytest.raises(IntegrityError):
        conn.execute(
            text(
                "INSERT INTO audit_events (id, event_type, actor_type) "
                "VALUES (:i, 'override', 'officer')"
            ),
            {"i": uuid.uuid4()},
        )
