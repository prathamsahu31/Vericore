"""End-to-end: an uploaded document becomes stored, citable fields.

This is the Day 2 definition of done from CLAUDE.md §15. It runs against a real
PostgreSQL and real PDFs, with only the language model stubbed.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from sqlalchemy import text

from app.db.enums import LocatorStatus

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED = REPO_ROOT / "seed" / "bidders" / "bidder_a"

pytestmark = pytest.mark.skipif(
    not (SEED / "gst_certificate.pdf").exists(),
    reason="fixtures missing; run python scripts/generate_fixtures.py",
)


@pytest.fixture
def tender_id(conn) -> uuid.UUID:
    return conn.execute(
        text("INSERT INTO tenders (title) VALUES ('Corrosion-resistant piping') RETURNING id")
    ).scalar_one()


def _upload(client, bid_id, filename, mode="auto_classify", doc_type=None):
    data = {"ingestion_mode": mode}
    if doc_type:
        data["doc_type"] = doc_type
    with open(SEED / filename, "rb") as fh:
        return client.post(
            f"/bids/{bid_id}/documents",
            files={"file": (filename, fh, "application/pdf")},
            data=data,
        )


def test_upload_produces_located_fields(client, bid):
    """The Day 2 bar: real coordinates, from a real PDF, for every field."""
    response = _upload(client, bid, "gst_certificate.pdf")
    assert response.status_code == 201
    body = response.json()

    assert body["segments"][0]["doc_type"] == "gst_certificate"
    assert body["fields_unlocated"] == 0
    assert body["fields_located"] == len(body["extracted_fields"])

    names = {f["field_name"] for f in body["extracted_fields"]}
    assert {"gstin", "legal_name", "registration_status"} <= names

    for field in body["extracted_fields"]:
        assert field["page"] >= 1
        assert field["x1"] > field["x0"] and field["y1"] > field["y0"]
        assert field["locator_status"] == LocatorStatus.EXACT


def test_extracted_gstin_matches_the_fixture_and_its_pan(client, bid):
    """§16: fixtures are internally consistent, so our own validators pass them."""
    _upload(client, bid, "gst_certificate.pdf")
    _upload(client, bid, "pan_card.pdf")

    fields = {}
    for doc in client.get(f"/bids/{bid}/documents").json():
        for f in client.get(f"/documents/{doc['id']}/fields").json():
            fields[f["field_name"]] = f["field_value"]

    # The single highest-value structural check in the system (CLAUDE.md §9).
    assert fields["gstin"][2:12] == fields["pan"]


def test_a_declared_type_is_trusted_over_the_classifier(client, bid):
    """Mode 'separate' means the officer labelled it; we do not second-guess."""
    body = _upload(
        client, bid, "udyam_certificate.pdf", mode="separate", doc_type="udyam_certificate"
    ).json()
    segment = body["segments"][0]
    assert segment["doc_type"] == "udyam_certificate"
    assert segment["boundary_confidence"] == 1.0
    assert segment["needs_review"] is False


def test_separate_mode_without_a_type_is_rejected_with_an_explanation(client, bid):
    response = _upload(client, bid, "gst_certificate.pdf", mode="separate")
    assert response.status_code == 422
    assert "auto_classify" in response.json()["error"]["message"]


def test_a_wrapped_span_stores_one_rectangle_per_line(client, bid):
    """The work order's description runs across three lines (§24)."""
    body = _upload(client, bid, "work_order.pdf").json()
    description = next(f for f in body["extracted_fields"] if f["field_name"] == "work_description")
    assert description["bbox_rects"] is not None
    assert len(description["bbox_rects"]) == 3


def test_a_single_line_span_stores_no_separate_rectangles(client, bid):
    body = _upload(client, bid, "gst_certificate.pdf").json()
    gstin = next(f for f in body["extracted_fields"] if f["field_name"] == "gstin")
    assert gstin["bbox_rects"] is None


def test_every_field_records_the_model_that_produced_it(client, bid):
    body = _upload(client, bid, "gst_certificate.pdf").json()
    for field in body["extracted_fields"]:
        assert field["llm_provider"] == "stub"
        assert field["llm_model_id"] == "stub-extraction-v1"


def test_a_repeated_upload_is_reported_as_a_duplicate(client, bid):
    """Detected, not silently collapsed (CLAUDE.md §9)."""
    first = _upload(client, bid, "gst_certificate.pdf").json()
    second = _upload(client, bid, "gst_certificate.pdf").json()
    assert first["document"]["sha256"] == second["document"]["sha256"]
    assert first["document"]["id"] in second["duplicate_of"]


def test_a_non_pdf_upload_is_refused(client, bid):
    response = client.post(
        f"/bids/{bid}/documents",
        files={"file": ("payload.exe", b"MZ\x90\x00", "application/octet-stream")},
        data={"ingestion_mode": "auto_classify"},
    )
    assert response.status_code == 422
    assert "not accepted" in response.json()["error"]["message"]


def test_a_bid_always_has_a_member(client, conn, tender_id):
    """A sole bid is one member with role 'sole' — no special case (§20)."""
    bidder = client.post(
        "/bidders", json={"legal_name": "Solo Works Pvt Ltd", "pan": "AAACS9999S"}
    ).json()
    bid = client.post("/bids", json={"tender_id": str(tender_id), "bidder_id": bidder["id"]}).json()
    rows = (
        conn.execute(text("SELECT role FROM bid_members WHERE bid_id = :b"), {"b": bid["id"]})
        .scalars()
        .all()
    )
    assert rows == ["sole"]


def test_the_same_bidder_cannot_bid_twice_on_one_tender(client, tender_id):
    bidder = client.post("/bidders", json={"legal_name": "Twice Ltd", "pan": "AAACT8888T"}).json()
    payload = {"tender_id": str(tender_id), "bidder_id": bidder["id"]}
    assert client.post("/bids", json=payload).status_code == 201
    assert client.post("/bids", json=payload).status_code == 409


def test_bidders_are_deduplicated_by_pan(client):
    """The same company on a second tender is the same row (CLAUDE.md §6)."""
    a = client.post("/bidders", json={"legal_name": "Dedup Ltd", "pan": "AAACD7777D"}).json()
    b = client.post("/bidders", json={"legal_name": "Dedup Limited", "pan": "AAACD7777D"}).json()
    assert a["id"] == b["id"]
