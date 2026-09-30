from __future__ import annotations

from app.db.enums import ActorType, TenderStatus
from app.db.models import AuditEvent, Tender
from app.modules.tender_service.service import _heuristic_requirements_from_text


def test_delete_tender_hard_deletes_when_no_audit_history(client) -> None:
    created = client.post("/tenders", json={"title": "Delete me", "bid_due_date": "2026-09-30"}).json()
    tender_id = created["id"]

    response = client.delete(f"/tenders/{tender_id}")
    assert response.status_code == 204

    listed = client.get("/tenders").json()
    assert all(t["id"] != tender_id for t in listed)


def test_delete_tender_archives_when_audit_history_exists(client, db_session) -> None:
    created = client.post("/tenders", json={"title": "Archive me", "bid_number": "TMP-ARCH-01", "bid_due_date": "2026-09-30"}).json()
    tender_id = created["id"]

    db_session.add(
        AuditEvent(
            tender_id=tender_id,
            event_type="verification_run_completed",
            actor_type=ActorType.SYSTEM,
            actor_component="compliance_engine",
            new_state="LOW",
            reason="seed event",
        )
    )
    db_session.flush()

    response = client.delete(f"/tenders/{tender_id}")
    assert response.status_code == 204

    tender = db_session.get(Tender, tender_id)
    assert tender is not None
    assert tender.status is TenderStatus.CLOSED
    assert tender.bid_number is None
    assert tender.title.startswith("[Archived] ")

    listed = client.get("/tenders").json()
    assert all(t["id"] != tender_id for t in listed)


def test_heuristic_requirement_parser_handles_simple_eligibility_table() -> None:
    text = """
    Eligibility Criteria
    Criterion
    Minimum Requirement
    Average Annual Turnover
    >= INR 50 crore
    Financial Capacity
    Positive net worth
    GST Registration
    Mandatory
    Udyam Registration
    Mandatory
    ISO Certification
    ISO 9001:2015 or equivalent
    EPFO Registration
    Mandatory
    ESIC Registration
    Mandatory
    Required Documents
    """

    parsed = _heuristic_requirements_from_text(text)
    assert len(parsed.requirements) >= 7

    turnover = next(r for r in parsed.requirements if "Turnover" in r.name)
    assert turnover.condition is not None
    assert turnover.condition["field"] == "average_annual_turnover"
    assert turnover.condition["threshold"] == 500000000
