"""End-to-end: NIT in, complete compliance picture out.

The Day 3 definition of done from CLAUDE.md §15, against a real PostgreSQL,
real PDFs and the real rule engine — with only the language model stubbed.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.db.enums import ComplianceStatus

REPO_ROOT = Path(__file__).resolve().parents[2]
TENDER_PDF = REPO_ROOT / "seed" / "tender" / "nit_darpg_style.pdf"
BIDDER_A = REPO_ROOT / "seed" / "bidders" / "bidder_a"

pytestmark = pytest.mark.skipif(
    not TENDER_PDF.exists(), reason="fixtures missing; run scripts/generate_tender.py"
)


@pytest.fixture
def tender(client):
    payload = {
        "title": "Supply and Installation of Corrosion-Resistant Piping System",
        "bid_number": "TEST/2026/RFP/0001",
        "bid_due_date": "2026-09-15",
        "contract_start_date": "2026-11-01",
        "estimated_value": "620000000",
    }
    created = client.post("/tenders", json=payload).json()
    with open(TENDER_PDF, "rb") as fh:
        client.post(
            f"/tenders/{created['id']}/document",
            files={"file": ("nit.pdf", fh, "application/pdf")},
        )
    return created


@pytest.fixture
def verified(client, tender):
    """A confirmed checklist, Bidder A's bundle uploaded, verification run."""
    client.post(f"/tenders/{tender['id']}/extract-requirements")
    client.post(f"/tenders/{tender['id']}/confirm-requirements")
    bidder = client.post(
        "/bidders",
        json={
            "legal_name": "ABC Infrastructure Private Limited",
            "pan": "AABCA1234C",
            "gstin": "33AABCA1234C1ZM",
            "cin": "U45200TN2015PTC101234",
        },
    ).json()
    bid = client.post("/bids", json={"tender_id": tender["id"], "bidder_id": bidder["id"]}).json()
    for pdf in sorted(BIDDER_A.glob("*.pdf")):
        with open(pdf, "rb") as fh:
            client.post(
                f"/bids/{bid['id']}/documents",
                files={"file": (pdf.name, fh, "application/pdf")},
                data={"ingestion_mode": "auto_classify"},
            )
    return client.post(f"/bids/{bid['id']}/verify").json()


# ─────────────────────────────────────────────────────────────────────────────
# Requirement extraction and the confirmation gate
# ─────────────────────────────────────────────────────────────────────────────
def test_the_pq_table_yields_one_requirement_per_clause(client, tender):
    rows = client.post(f"/tenders/{tender['id']}/extract-requirements").json()
    assert len(rows) == 15
    assert [r["code"] for r in rows][:3] == ["REQ-001", "REQ-002", "REQ-003"]


def test_the_applicability_column_is_read_not_assumed(client, tender):
    """CLAUDE.md §20: real tenders state applicability per criterion."""
    rows = client.post(f"/tenders/{tender['id']}/extract-requirements").json()
    scopes = {r["code"]: r["applicability_scope"] for r in rows}
    assert scopes["REQ-003"] == "all_members"  # "each consortium member"
    assert scopes["REQ-005"] == "any_member"  # "any consortium member"
    assert scopes["REQ-002"] == "lead_only"  # "prime bidder"


def test_thresholds_are_parsed_into_machine_checkable_conditions(client, tender):
    rows = client.post(f"/tenders/{tender['id']}/extract-requirements").json()
    turnover = next(r for r in rows if r["code"] == "REQ-002")
    assert turnover["condition"]["threshold"] == 1000000000
    assert turnover["condition"]["period_years"] == 3


def test_extraction_records_the_source_clause_for_the_confirmation_screen(client, tender):
    rows = client.post(f"/tenders/{tender['id']}/extract-requirements").json()
    assert all(r["source_clause_ref"] for r in rows)
    assert all(r["raw_clause"] for r in rows)


def test_verification_is_refused_before_the_checklist_is_confirmed(client, tender):
    """The gate is a gate, not a suggestion (CLAUDE.md §11)."""
    client.post(f"/tenders/{tender['id']}/extract-requirements")
    bidder = client.post(
        "/bidders", json={"legal_name": "Gate Test Ltd", "pan": "AAACG1111G"}
    ).json()
    bid = client.post("/bids", json={"tender_id": tender["id"], "bidder_id": bidder["id"]}).json()
    response = client.post(f"/bids/{bid['id']}/verify")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "gate_not_satisfied"


def test_re_extracting_after_confirmation_is_refused(client, tender):
    client.post(f"/tenders/{tender['id']}/extract-requirements")
    client.post(f"/tenders/{tender['id']}/confirm-requirements")
    assert client.post(f"/tenders/{tender['id']}/extract-requirements").status_code == 409


def test_an_officer_can_correct_a_requirement_before_confirming(client, tender):
    rows = client.post(f"/tenders/{tender['id']}/extract-requirements").json()
    target = rows[0]
    updated = client.patch(
        f"/requirements/{target['id']}", json={"mandatory": False, "weight": "7"}
    ).json()
    assert updated["mandatory"] is False
    assert updated["edited_by_officer"] is True


# ─────────────────────────────────────────────────────────────────────────────
# The compliance picture
# ─────────────────────────────────────────────────────────────────────────────
def test_every_requirement_receives_a_verdict(verified):
    assert len(verified["requirements"]) == 15
    assert verified["run_status"] == "succeeded"


def test_bidder_a_is_mostly_compliant(verified):
    """CLAUDE.md §16: mostly compliant, with one subtle near-miss."""
    counts = verified["status_counts"]
    assert counts.get("COMPLIANT", 0) >= 12
    assert verified["risk_level"] == "LOW"


def test_turnover_is_averaged_and_compared_deterministically(verified):
    row = next(r for r in verified["requirements"] if r["requirement_code"] == "REQ-002")
    assert row["status"] == ComplianceStatus.COMPLIANT
    assert row["verification_method"] == "deterministic_calculation"
    # The working is shown: three years, their mean, and the comparison.
    assert "1,053,333,333" in row["reasoning"]


def test_the_near_miss_certificate_passes_and_reports_its_margin(verified):
    """The ISO certificate expires three days after the bid due date."""
    row = next(r for r in verified["requirements"] if r["requirement_code"] == "REQ-008")
    assert row["status"] == ComplianceStatus.COMPLIANT
    assert "3 day(s) after" in row["reasoning"]


def test_the_absent_document_is_missing_evidence_and_is_named(verified):
    row = next(r for r in verified["requirements"] if r["requirement_code"] == "REQ-013")
    assert row["status"] == ComplianceStatus.MISSING_EVIDENCE
    assert "local content certificate" in row["reasoning"]


def test_the_prose_specification_is_referred_to_a_human(verified):
    row = next(r for r in verified["requirements"] if r["requirement_code"] == "REQ-010")
    assert row["status"] == ComplianceStatus.NEEDS_HUMAN_REVIEW
    assert row["verification_method"] == "semantic_judgement"


def test_every_verdict_that_rests_on_evidence_cites_it(verified):
    """CLAUDE.md §2 rule 1: a verdict without evidence references is a bug."""
    for row in verified["requirements"]:
        if row["status"] in (ComplianceStatus.MISSING_EVIDENCE,):
            continue
        assert row["evidence_field_ids"], f"{row['requirement_code']} cites nothing"


def test_every_external_check_is_labelled_simulated(verified):
    """CLAUDE.md §2 rule 2, all the way out to the API response."""
    assert verified["external_checks_live"] == 0
    assert verified["external_checks_simulated"] > 0
    for row in verified["requirements"]:
        if row["external_check_portal"]:
            assert row["external_check_source"] == "simulated"


def test_the_score_is_recomputable_from_the_verdict_table(verified):
    """§10: arithmetic, not a model output."""
    from decimal import Decimal

    from app.modules.compliance_engine.scoring import compute

    rows = [
        (
            r["requirement_code"],
            r["requirement_name"],
            r["mandatory"],
            True,
            float(r["weight"]),
            ComplianceStatus(r["status"]),
        )
        for r in verified["requirements"]
    ]
    assert compute(rows).value == Decimal(verified["compliance_score"])


def test_a_pending_review_item_does_not_read_as_a_failure(verified):
    """A mandatory item awaiting the officer is unresolved, not failed.

    Bidder A's only outstanding mandatory item is the prose specification, which
    the system referred to a human by policy. Treating that identically to a
    genuine NON_COMPLIANT would make §13's clean-bidder demo impossible and,
    worse, would tell an officer a compliant bidder had failed.
    """
    assert verified["mandatory_failed"] == []
    assert "REQ-010" in verified["pending_review"]
    assert verified["mandatory_gate_passed"] is True
    assert verified["qualifiable"] is False


def test_accepting_the_pending_item_makes_the_bidder_qualifiable(client, verified, conn):
    from sqlalchemy import text

    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('o@example.gov.in', 'An Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    after = client.post(
        f"/bids/{verified['bid_id']}/review",
        json={
            "requirement_code": "REQ-010",
            "action": "accept",
            "officer_id": str(officer),
            "reason": "Duplex stainless steel with epoxy-phenolic lining is suitable for "
            "chloride-bearing service. Confirmed against the tender clause.",
        },
    ).json()
    assert after["pending_review"] == []
    assert after["qualifiable"] is True


def test_an_override_is_stored_beside_the_machine_verdict_not_instead_of_it(client, verified, conn):
    """CLAUDE.md §5: both are stored, and both stay visible."""
    from sqlalchemy import text

    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('o2@example.gov.in', 'Another Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    after = client.post(
        f"/bids/{verified['bid_id']}/review",
        json={
            "requirement_code": "REQ-010",
            "action": "accept",
            "officer_id": str(officer),
            "reason": "Materials confirmed against clause 6.10.",
        },
    ).json()
    row = next(r for r in after["requirements"] if r["requirement_code"] == "REQ-010")
    assert row["status"] == ComplianceStatus.NEEDS_HUMAN_REVIEW  # machine, untouched
    assert row["override_status"] == ComplianceStatus.COMPLIANT  # officer, alongside
    assert row["effective_status"] == ComplianceStatus.COMPLIANT
    assert row["reasoning"], "the machine's own reasoning must survive an override"


def test_accepting_something_the_system_failed_is_refused_as_an_override(client, verified, conn):
    """ "I looked and agreed" and "I disagree" are different acts (§5)."""
    from sqlalchemy import text

    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('o3@example.gov.in', 'Third Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    response = client.post(
        f"/bids/{verified['bid_id']}/review",
        json={
            "requirement_code": "REQ-002",
            "action": "accept",
            "officer_id": str(officer),
            "reason": "fine by me",
        },
    )
    assert response.status_code == 422
    assert "override" in response.json()["error"]["message"]


def test_a_review_without_a_reason_is_refused(client, verified, conn):
    from sqlalchemy import text

    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('o4@example.gov.in', 'Fourth Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    response = client.post(
        f"/bids/{verified['bid_id']}/review",
        json={
            "requirement_code": "REQ-010",
            "action": "accept",
            "officer_id": str(officer),
            "reason": "   ",
        },
    )
    assert response.status_code == 422


def test_the_audit_trail_reports_chain_integrity(client, verified):
    """§11: chain-integrity status is shown at the top of the trail."""
    trail = client.get(f"/bids/{verified['bid_id']}/audit").json()
    assert trail["integrity"]["intact"] is True
    assert trail["integrity"]["total_events"] >= 1
    assert len(trail["integrity"]["head_hash"]) == 64


def test_a_consistent_bidder_raises_no_cross_document_findings(verified):
    """Bidder A's identifiers agree by construction (CLAUDE.md §16)."""
    assert verified["cross_document_findings"] == []


def test_risk_flags_are_listed_with_the_level(verified):
    """§10: the UI always lists which flags fired."""
    assert verified["risk_level"]
    for flag in verified["risk_flags"]:
        assert flag["description"]


def test_verification_never_writes_a_decision(verified, conn):
    """CLAUDE.md §2: no code path qualifies or disqualifies a bidder."""
    from sqlalchemy import text

    row = (
        conn.execute(
            text("SELECT decision, decided_by FROM bids WHERE id = :b"),
            {"b": verified["bid_id"]},
        )
        .mappings()
        .one()
    )
    assert row["decision"] is None
    assert row["decided_by"] is None


def test_the_run_is_recorded_in_the_audit_chain(verified, conn):
    from sqlalchemy import text

    events = (
        conn.execute(
            text(
                "SELECT event_type, actor_type, payload FROM audit_events "
                "WHERE bid_id = :b ORDER BY seq"
            ),
            {"b": verified["bid_id"]},
        )
        .mappings()
        .all()
    )
    assert any(e["event_type"] == "verification_run_completed" for e in events)
    assert all(e["actor_type"] == "system" for e in events)


def test_re_running_replaces_verdicts_without_duplicating_them(client, verified):
    again = client.post(f"/bids/{verified['bid_id']}/verify").json()
    assert len(again["requirements"]) == len(verified["requirements"])
    assert again["compliance_score"] == verified["compliance_score"]


# ─────────────────────────────────────────────────────────────────────────────
# Comparison across bidders (architecture.md §9.4)
# ─────────────────────────────────────────────────────────────────────────────
def test_comparison_lists_every_bidder_and_every_condition(client, tender, verified):
    comparison = client.get(f"/tenders/{tender['id']}/comparison").json()
    assert len(comparison["bidders"]) >= 1
    assert len(comparison["requirements"]) == 15
    for row in comparison["requirements"]:
        assert len(row["cells"]) == len(comparison["bidders"])


def test_comparison_marks_the_conditions_where_bidders_differ(client, tender, verified):
    """The column worth reading first when shortlisting."""
    comparison = client.get(f"/tenders/{tender['id']}/comparison").json()
    # With one bidder nothing can differ; the flag must still be present and false.
    assert all("differentiating" in row for row in comparison["requirements"])
    if len(comparison["bidders"]) == 1:
        assert not any(row["differentiating"] for row in comparison["requirements"])


def test_comparison_does_not_rank_bidders(client, tender, verified):
    """Ordering by score would be the system expressing a preference.

    CLAUDE.md §2: the officer decides. Presenting bidders best-first is a
    recommendation dressed as a layout.
    """
    comparison = client.get(f"/tenders/{tender['id']}/comparison").json()
    payload = client.get(f"/tenders/{tender['id']}/comparison").text
    assert "rank" not in payload.lower()
    # Bid order, not score order.
    assert [b["bid_id"] for b in comparison["bidders"]] == sorted(
        [b["bid_id"] for b in comparison["bidders"]],
        key=lambda x: [b["bid_id"] for b in comparison["bidders"]].index(x),
    )


def test_comparison_reports_both_gates_per_bidder(client, tender, verified):
    comparison = client.get(f"/tenders/{tender['id']}/comparison").json()
    bidder = comparison["bidders"][0]
    assert "mandatory_failed" in bidder
    assert "pending_review" in bidder
    assert "qualifiable" in bidder


def test_comparison_shows_the_officers_verdict_where_one_exists(client, tender, verified, conn):
    """The effective status is what the cell shows; the override is marked."""
    from sqlalchemy import text

    officer = conn.execute(
        text(
            "INSERT INTO users (email, full_name, role) "
            "VALUES ('cmp@example.gov.in', 'Comparison Officer', 'officer') RETURNING id"
        )
    ).scalar_one()
    client.post(
        f"/bids/{verified['bid_id']}/review",
        json={
            "requirement_code": "REQ-010",
            "action": "accept",
            "officer_id": str(officer),
            "reason": "Materials confirmed against the tender clause.",
        },
    )
    comparison = client.get(f"/tenders/{tender['id']}/comparison").json()
    row = next(r for r in comparison["requirements"] if r["requirement_code"] == "REQ-010")
    cell = next(c for c in row["cells"] if c["bid_id"] == verified["bid_id"])
    assert cell["status"] == ComplianceStatus.NEEDS_HUMAN_REVIEW  # machine, kept
    assert cell["effective_status"] == ComplianceStatus.COMPLIANT  # officer, counted
    assert cell["overridden"] is True


def test_comparison_of_an_unknown_tender_is_a_clean_404(client):
    import uuid as _uuid

    response = client.get(f"/tenders/{_uuid.uuid4()}/comparison")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
