"""Report export: from stored data to a structured record and a print document.

Day 5's final deliverable (CLAUDE.md §15). The report is assembled with no LLM
call and makes no decision — it renders the confirmed checklist, each bidder's
stored verdicts and evidence, risk flags, findings, and the reality check that
every simulated result must travel with.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
TENDER_PDF = REPO_ROOT / "seed" / "tender" / "nit_darpg_style.pdf"

pytestmark = pytest.mark.skipif(
    not TENDER_PDF.exists(), reason="fixtures missing; run scripts/generate_tender.py"
)


@pytest.fixture
def verified_tender(client):
    """A tender with a confirmed checklist, a verified bid, and a verdict row."""
    created = client.post(
        "/tenders",
        json={
            "title": "Supply and Installation of Corrosion-Resistant Piping System",
            "bid_number": "TEST/2026/RFP/0001",
            "bid_due_date": "2026-09-15",
            "contract_start_date": "2026-11-01",
            "estimated_value": "620000000",
        },
    ).json()
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
    bid = client.post(
        "/bids", json={"tender_id": created["id"], "bidder_id": bidder["id"]}
    ).json()
    for pdf in sorted((REPO_ROOT / "seed" / "bidders" / "bidder_a").glob("*.pdf")):
        with open(pdf, "rb") as fh:
            client.post(
                f"/bids/{bid['id']}/documents",
                files={"file": (pdf.name, fh, "application/pdf")},
                data={"ingestion_mode": "auto_classify"},
            )
    client.post(f"/bids/{bid['id']}/verify")
    created["bid_id"] = bid["id"]
    return created


def test_the_json_report_carries_the_tender_and_provenance(client, verified_tender):
    report = client.get(f"/tenders/{verified_tender['id']}/report")
    assert report.status_code == 200
    body = report.json()

    assert body["title"] == "Supply and Installation of Corrosion-Resistant Piping System"
    assert body["checklist_confirmed"] is True
    assert len(body["requirements"]) >= 10
    assert body["external_verification_source"] == "simulated"
    assert "llm_provider_reasoning" in body
    assert body["audit_chain_integrity"] is True

    bidder = body["bidders"][0]
    assert bidder["legal_name"] == "ABC Infrastructure Private Limited"
    assert bidder["compliance_score"] is not None
    assert len(bidder["requirements"]) == len(body["requirements"])
    for row in bidder["requirements"]:
        assert row["status"] in {
            "COMPLIANT", "NON_COMPLIANT", "PARTIALLY_COMPLIANT", "MISSING_EVIDENCE",
            "INCONSISTENT", "EXPIRED", "UNVERIFIED", "NOT_APPLICABLE",
            "NEEDS_HUMAN_REVIEW",
        }
        if row["external_check_status"]:
            assert row["external_check_source"] in {"live", "simulated"}


def test_the_html_report_is_printable_and_self_contained(client, verified_tender):
    html = client.get(f"/tenders/{verified_tender['id']}/report.html")
    assert html.status_code == 200
    page = html.text

    assert page.startswith("<!doctype html>")
    assert "Vericore" in page and "<style>" in page and "REQ-" in page
    assert "ABC Infrastructure Private Limited" in page
    assert "simulated" in page  # the real-vs-simulated posture is on the page


def test_the_html_report_lists_the_checklist_when_nobody_has_bid(client):
    created = client.post("/tenders", json={"title": "Fresh tender"}).json()
    with open(TENDER_PDF, "rb") as fh:
        client.post(
            f"/tenders/{created['id']}/document",
            files={"file": ("nit.pdf", fh, "application/pdf")},
        )
    client.post(f"/tenders/{created['id']}/extract-requirements")
    html = client.get(f"/tenders/{created['id']}/report.html")
    assert html.status_code == 200
    assert "Eligibility checklist" in html.text
    assert "REQ-" in html.text
    assert "Legible without colour" in html.text


def test_report_refuses_an_unknown_tender(client):
    report = client.get("/tenders/00000000-0000-0000-0000-000000000000/report")
    assert report.status_code == 404