"""Report routes: build and export the tender report (CLAUDE.md §15, Day 5).

The report is assembled purely from stored data — no LLM call, no decision
made. Two shapes are offered so automation and print care differ:
``GET /tenders/{id}/report`` returns the structured record; ``GET
/tenders/{id}/report.html`` returns a self-contained printable document.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.report_service import service as reports

router = APIRouter(tags=["reports"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("/tenders/{tender_id}/report")
def get_report(tender_id: uuid.UUID, db: DbSession) -> dict:
    """The structured report: requirements, per-bidder verdicts and provenance."""
    return reports.build_report(db, tender_id=tender_id).as_dict()


@router.get("/tenders/{tender_id}/report.html", response_class=HTMLResponse)
def get_report_html(tender_id: uuid.UUID, db: DbSession) -> str:
    """The printable report, self-contained and styled for paper."""
    return reports.render_html(reports.build_report(db, tender_id=tender_id))


__all__ = ["router"]