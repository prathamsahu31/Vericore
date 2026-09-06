"""Tests for the officer-facing recommendation (layer 8).

The recommendation is advisory and traceable. The properties that matter: it is
produced by the reasoning provider from structured verdicts only, its action is
coerced to the fixed vocabulary, and every cited requirement actually exists on
the tender (§7.6). A failure to narrate must never fail the verification.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import text

from app.llm.types import (
    CallProvenance,
    LLMRole,
    Recommendation,
    recommendation_from_payload,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
TENDER_PDF = REPO_ROOT / "seed" / "tender" / "nit_darpg_style.pdf"
BIDDER_A = REPO_ROOT / "seed" / "bidders" / "bidder_a"

pytestmark = pytest.mark.skipif(
    not TENDER_PDF.exists(), reason="fixtures missing; run scripts/generate_tender.py"
)

PROVENANCE = CallProvenance(provider="test", model_id="model-0", role=str(LLMRole.REASONING))


def _results() -> list[dict]:
    return [
        {
            "requirement_id": "1" * 32,
            "code": "REQ-001",
            "name": "Legal entity",
            "status": "COMPLIANT",
            "mandatory": True,
            "weight": 10.0,
            "verification_method": "document_presence",
            "reasoning": "Incorporation certificate found.",
            "external_check_portal": "mca21",
            "external_check_status": "found",
        },
        {
            "requirement_id": "2" * 32,
            "code": "REQ-002",
            "name": "Turnover",
            "status": "MISSING_EVIDENCE",
            "mandatory": True,
            "weight": 20.0,
            "verification_method": "routing",
            "reasoning": "No financial statement was submitted.",
            "external_check_portal": None,
            "external_check_status": None,
        },
    ]


# ─────────────────────────────────────────────────────────────────────────────
# The coercion contract (§7.6) — never trust the model's vocabulary
# ─────────────────────────────────────────────────────────────────────────────
def test_an_unknown_action_is_sent_to_manual_review_not_dropped():
    rec = recommendation_from_payload(
        {"summary": "facts", "action": "DEFINITELY_QUALIFY", "cited_requirement_codes": []},
        results=_results(),
        provenance=PROVENANCE,
    )
    assert rec.action == "MANUAL_REVIEW_REQUIRED"


def test_the_action_vocabulary_is_fixed():
    rec = recommendation_from_payload(
        {"summary": "facts", "action": "seek_clarification", "cited_requirement_codes": []},
        results=_results(),
        provenance=PROVENANCE,
    )
    assert rec.action == "SEEK_CLARIFICATION"


def test_cited_codes_that_do_not_exist_are_dropped():
    rec = recommendation_from_payload(
        {
            "summary": "REQ-001 satisfied, REQ-999 pending.",
            "action": "SEEK_CLARIFICATION",
            "cited_requirement_codes": ["REQ-001", "REQ-999"],
        },
        results=_results(),
        provenance=PROVENANCE,
    )
    assert rec.cited_requirement_codes == ["REQ-001"]


def test_a_failed_payload_still_yields_a_usable_recommendation():
    rec = recommendation_from_payload(
        {}, results=_results(), provenance=PROVENANCE
    )
    assert isinstance(rec, Recommendation)
    assert rec.action == "MANUAL_REVIEW_REQUIRED"


# ─────────────────────────────────────────────────────────────────────────────
# End to end through the API, with the stub provider narrating
# ─────────────────────────────────────────────────────────────────────────────
@pytest.fixture
def verified(client):
    payload = {
        "title": "Recommendation Test Tender",
        "bid_number": "TEST/2026/RFP/REC",
        "bid_due_date": "2026-09-15",
    }
    created = client.post("/tenders", json=payload).json()
    with open(TENDER_PDF, "rb") as fh:
        client.post(
            f"/tenders/{created['id']}/document",
            files={"file": ("nit.pdf", fh, "application/pdf")},
        )
    client.post(f"/tenders/{created['id']}/extract-requirements")
    client.post(f"/tenders/{created['id']}/confirm-requirements")
    bidder = client.post(
        "/bidders",
        json={
            "legal_name": "ABC Infrastructure Private Limited",
            "pan": "AABCA1234C",
            "gstin": "33AABCA1234C1ZM",
            "cin": "U45200TN2015PTC101234",
        },
    ).json()
    bid = client.post("/bids", json={"tender_id": created["id"], "bidder_id": bidder["id"]}).json()
    for pdf in sorted(BIDDER_A.glob("*.pdf")):
        with open(pdf, "rb") as fh:
            client.post(
                f"/bids/{bid['id']}/documents",
                files={"file": (pdf.name, fh, "application/pdf")},
                data={"ingestion_mode": "auto_classify"},
            )
    return client.post(f"/bids/{bid['id']}/verify").json()


def test_a_verification_run_writes_a_recommendation(client, verified, conn):
    row = (
        conn.execute(
            text(
                "SELECT recommendation_text, recommendation_action, "
                "recommendation_cited_requirements FROM bids WHERE id = :b"
            ),
            {"b": verified["bid_id"]},
        )
        .mappings()
        .one()
    )
    # The stub narrates into a placeholder; the important part is it persisted
    # in a valid, stored form — and it must never look like a decision.
    assert row["recommendation_text"] is not None
    assert row["recommendation_action"] == "MANUAL_REVIEW_REQUIRED"


def test_the_compliance_response_carries_the_recommendation(verified):
    assert "recommendation_text" in verified
    assert verified["recommendation_text"]
    assert verified["recommendation_action"] == "MANUAL_REVIEW_REQUIRED"


def test_the_recommendation_is_not_a_decision(client, verified, conn):
    """§11: advisory content beside the decision bar, never the decision."""
    assert verified["recommendation_action"] != "RECOMMEND_QUALIFY"
    payload = (
        conn.execute(
            text(
                "SELECT payload FROM audit_events WHERE bid_id = :b "
                "ORDER BY seq DESC LIMIT 1"
            ),
            {"b": verified["bid_id"]},
        )
        .scalar_one()
    )
    assert payload["recommendation_action"] == "MANUAL_REVIEW_REQUIRED"
    assert payload["recommendation_cited_requirements"] == []


def test_the_report_includes_the_recommendation_and_its_action(client, verified, conn):
    tender_id = (
        conn.execute(text("SELECT tender_id FROM bids WHERE id = :b"), {"b": verified["bid_id"]})
        .scalar_one()
    )
    report = client.get(f"/tenders/{tender_id}/report").json()
    bidder = report["bidders"][0]
    assert bidder["recommendation_text"]
    assert bidder["recommendation_action"] == "MANUAL_REVIEW_REQUIRED"
    html = client.get(f"/tenders/{tender_id}/report.html").text
    assert "Recommendation — advisory" in html
    assert bidder["recommendation_text"] in html