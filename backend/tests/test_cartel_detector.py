"""Tests for the collusion signals between bids on the same tender.

Each signal is a deterministic rule, so each gets a passing, a failing and a
boundary case (CLAUDE.md §13). The last tests run the real pipeline: two bids
that share a file, verified one after the other, end up flagged on both sides.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from sqlalchemy import text

from app.db.enums import Severity
from app.modules.risk_engine.cartel_detector import BidProfile, Mark, flags

A, B, C = (uuid.UUID(int=n) for n in (1, 2, 3))

REPO_ROOT = Path(__file__).resolve().parents[2]
TENDER_PDF = REPO_ROOT / "seed" / "tender" / "nit_darpg_style.pdf"
GST_CERTIFICATE = REPO_ROOT / "seed" / "bidders" / "bidder_a" / "gst_certificate.pdf"


def _bid(bid_id: uuid.UUID, name: str, *marks: Mark) -> BidProfile:
    return BidProfile(bid_id=bid_id, name=name, marks=marks)


def _by_code(result, bid_id) -> dict:
    return {flag.code: flag for flag in result.get(bid_id, [])}


def _gstin(value: str, where: str = "registration") -> Mark:
    return Mark("gstin", value, value, where)


# ── Shared identifiers ──────────────────────────────────────────────────


def test_a_shared_gstin_flags_both_bids_and_names_the_other():
    result = flags(
        [
            _bid(A, "Apex Buildtech", _gstin("07ABCDE1234F1Z5")),
            _bid(B, "Nova Infra", _gstin("07ABCDE1234F1Z5", "gst_certificate.pdf p.1")),
        ]
    )

    apex = _by_code(result, A)["shared_identifier_across_bids"]
    assert apex.severity is Severity.HIGH
    assert "GSTIN 07ABCDE1234F1Z5 (registration here; gst_certificate.pdf p.1 in Nova" in (
        apex.description
    )
    assert apex.evidence_refs == {"linked_bids": [str(B)]}
    assert (
        "Apex Buildtech's bid" in _by_code(result, B)["shared_identifier_across_bids"].description
    )


def test_identifiers_match_whatever_their_case_spacing_or_hyphens():
    result = flags(
        [
            _bid(A, "Apex", Mark("udyam_urn", "UDYAM-DL-01-0000001", "x", "registration")),
            _bid(B, "Nova", Mark("udyam_urn", " udyam dl 01 0000001", "y", "udyam.pdf p.1")),
        ]
    )
    assert "shared_identifier_across_bids" in _by_code(result, A)


def test_bids_with_nothing_in_common_are_not_flagged():
    result = flags(
        [
            _bid(A, "Apex", _gstin("07ABCDE1234F1Z5")),
            _bid(B, "Nova", _gstin("33AABCA1234C1ZM")),
        ]
    )
    assert result == {}


def test_a_bid_repeating_its_own_number_links_to_nobody():
    result = flags(
        [
            _bid(A, "Apex", _gstin("07ABCDE1234F1Z5"), _gstin("07ABCDE1234F1Z5", "gst.pdf p.1")),
            _bid(B, "Nova", _gstin("33AABCA1234C1ZM")),
        ]
    )
    assert result == {}


def test_values_too_short_to_identify_anything_are_ignored():
    def pair(value: str):
        return flags(
            [
                _bid(A, "Apex", Mark("certificate_number", value, value, "iso.pdf p.1")),
                _bid(B, "Nova", Mark("certificate_number", value, value, "iso.pdf p.1")),
            ]
        )

    assert pair("NA") == {}
    assert pair("12345") == {}  # one short of the minimum
    assert "shared_identifier_across_bids" in _by_code(pair("123456"), A)


def test_placeholder_numbers_without_a_nonzero_digit_are_ignored():
    def pair(value: str):
        return flags(
            [
                _bid(A, "Apex", Mark("esic_reg_number", value, value, "esic.pdf p.1")),
                _bid(B, "Nova", Mark("esic_reg_number", value, value, "esic.pdf p.1")),
            ]
        )

    assert pair("TEST-ESIC-000000") == {}
    assert pair("DL/CPM/0000000/TEST") == {}
    assert "shared_identifier_across_bids" in _by_code(pair("TEST-ESIC-000001"), A)


def test_a_number_shared_by_three_bids_is_described_once_per_bid():
    iso = Mark("certificate_number", "IN-QMS-2023-88141", "IN-QMS-2023-88141", "iso.pdf p.1")
    result = flags([_bid(A, "Apex", iso), _bid(B, "Nova", iso), _bid(C, "Coastal", iso)])

    description = _by_code(result, A)["shared_identifier_across_bids"].description
    assert description.count("IN-QMS-2023-88141") == 1
    assert "iso.pdf p.1 in Nova's bid, iso.pdf p.1 in Coastal's bid" in description
    assert _by_code(result, A)["shared_identifier_across_bids"].evidence_refs == {
        "linked_bids": sorted([str(B), str(C)])
    }


# ── Identical files and the same bidder twice ───────────────────────────


def test_an_identical_file_in_two_bids_is_a_high_signal():
    sha = "a" * 64
    result = flags(
        [
            _bid(A, "Apex", Mark("document", sha, "ca_certificate.pdf", "ca_certificate.pdf")),
            _bid(B, "Nova", Mark("document", sha, "turnover.pdf", "turnover.pdf")),
        ]
    )
    flag = _by_code(result, A)["identical_document_in_two_bids"]
    assert flag.severity is Severity.HIGH
    assert "ca_certificate.pdf here is the same file as turnover.pdf in Nova's bid" in (
        flag.description
    )


def test_different_files_are_not_a_signal():
    result = flags(
        [
            _bid(A, "Apex", Mark("document", "a" * 64, "gst.pdf", "gst.pdf")),
            _bid(B, "Nova", Mark("document", "b" * 64, "gst.pdf", "gst.pdf")),
        ]
    )
    assert result == {}


def test_the_same_bidder_in_two_bids_is_critical():
    bidder = str(uuid.UUID(int=99))
    result = flags(
        [
            _bid(A, "Apex", Mark("bidder", bidder, "Apex Buildtech", "bid membership")),
            _bid(B, "Consortium", Mark("bidder", bidder, "Apex Buildtech", "bid membership")),
        ]
    )
    flag = _by_code(result, B)["same_bidder_in_two_bids"]
    assert flag.severity is Severity.CRITICAL
    assert "Apex Buildtech is also a member of Apex's bid" in flag.description


# ── Registered address ──────────────────────────────────────────────────


def _address(value: str) -> Mark:
    return Mark("address", value, value, "registration")


def test_addresses_match_despite_case_and_punctuation():
    result = flags(
        [
            _bid(A, "Apex", _address("12, MG Road, Connaught Place, New Delhi")),
            _bid(B, "Nova", _address("12 mg road connaught place new delhi.")),
        ]
    )
    assert _by_code(result, A)["shared_registered_address"].severity is Severity.HIGH


def test_an_address_too_short_to_be_a_premises_is_ignored():
    result = flags([_bid(A, "Apex", _address("New Delhi")), _bid(B, "Nova", _address("new delhi"))])
    assert result == {}


# ── Groups ──────────────────────────────────────────────────────────────


def test_three_bids_linked_in_a_chain_are_reported_as_a_group():
    sha = "c" * 64
    result = flags(
        [
            _bid(A, "Apex", _gstin("07ABCDE1234F1Z5")),
            _bid(B, "Nova", _gstin("07ABCDE1234F1Z5"), Mark("document", sha, "bg.pdf", "bg.pdf")),
            _bid(C, "Coastal", Mark("document", sha, "bg.pdf", "bg.pdf")),
        ]
    )
    # Apex and Coastal share nothing directly, but both share something with Nova.
    group = _by_code(result, A)["linked_bidder_group"]
    assert group.severity is Severity.INFO
    assert "to 2 other bidders on this tender: Coastal, Nova" in group.description
    assert "identical_document_in_two_bids" not in _by_code(result, A)
    assert "linked_bidder_group" in _by_code(result, C)


def test_a_linked_pair_alone_is_not_reported_as_a_group():
    result = flags(
        [_bid(A, "Apex", _gstin("07ABCDE1234F1Z5")), _bid(B, "Nova", _gstin("07ABCDE1234F1Z5"))]
    )
    assert "linked_bidder_group" not in _by_code(result, A)


# ── Through the pipeline ────────────────────────────────────────────────


@pytest.mark.skipif(
    not (TENDER_PDF.exists() and GST_CERTIFICATE.exists()), reason="fixtures missing"
)
def test_two_bids_sharing_a_file_are_flagged_on_both_sides(client, conn):
    tender = client.post(
        "/tenders",
        json={"title": "Piping", "bid_due_date": "2026-09-15", "estimated_value": "620000000"},
    ).json()
    with open(TENDER_PDF, "rb") as fh:
        client.post(
            f"/tenders/{tender['id']}/document",
            files={"file": ("nit.pdf", fh, "application/pdf")},
        )
    client.post(f"/tenders/{tender['id']}/extract-requirements")
    client.post(f"/tenders/{tender['id']}/confirm-requirements")

    bids = []
    for name, pan in (
        ("ABC Infrastructure Private Limited", "AABCA1234C"),
        ("Shadow Traders Private Limited", "AAECS5678D"),
    ):
        bidder = client.post("/bidders", json={"legal_name": name, "pan": pan}).json()
        bid = client.post("/bids", json={"tender_id": tender["id"], "bidder_id": bidder["id"]})
        bids.append(bid.json()["id"])
        client.post(
            f"/bids/{bids[-1]}/documents",
            files={
                "file": ("gst_certificate.pdf", GST_CERTIFICATE.read_bytes(), "application/pdf")
            },
            data={"ingestion_mode": "auto_classify"},
        )

    # Verified one after the other: the second run must also update the first bid.
    for bid in bids:
        assert client.post(f"/bids/{bid}/verify").status_code == 201
    first, second = (client.get(f"/bids/{bid}/compliance").json() for bid in bids)

    for summary, other in ((first, "Shadow Traders"), (second, "ABC Infrastructure")):
        collusion = {f["code"]: f for f in summary["risk_flags"] if f["category"] == "collusion"}
        assert set(collusion) == {"identical_document_in_two_bids", "shared_identifier_across_bids"}
        assert other in collusion["identical_document_in_two_bids"]["description"]
        # Two high signals band the bid HIGH at least (§10).
        assert summary["risk_level"] in ("HIGH", "CRITICAL")

    events = conn.execute(
        text("SELECT count(*) FROM audit_events WHERE event_type = 'collusion_signals_updated'")
    ).scalar_one()
    assert events >= 2

    # Re-verifying changes nothing: the flags are replaced, not duplicated.
    client.post(f"/bids/{bids[0]}/verify")
    again = client.get(f"/bids/{bids[0]}/compliance").json()
    assert sum(f["category"] == "collusion" for f in again["risk_flags"]) == 2
