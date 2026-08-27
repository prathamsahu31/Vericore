"""Verification routes: run the pipeline, read the compliance picture."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import extraction_provider
from app.api.schemas import (
    ComplianceRowOut,
    FindingOut,
    RiskFlagOut,
    VerificationSummary,
)
from app.db.enums import VerificationSource
from app.db.models import (
    Bid,
    Bidder,
    BidMember,
    ComplianceResult,
    CrossDocumentFinding,
    Evidence,
    PortalCheck,
    Requirement,
    RiskFlag,
    Tender,
    VerificationRun,
)
from app.db.session import get_db
from app.errors import NotFoundError
from app.modules.compliance_engine import service as compliance

router = APIRouter(tags=["verification"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/bids/{bid_id}/verify", response_model=VerificationSummary, status_code=201)
def verify(
    bid_id: uuid.UUID, db: DbSession, provider: Annotated[Any, Depends(extraction_provider)]
) -> VerificationSummary:
    """Run layers 4-8 and return the complete compliance picture.

    Synchronous while the provider is fast. Moving this to BackgroundTasks with
    progress polled from ``verification_runs`` is a one-line change — the run
    row is already written and updated as it goes (CLAUDE.md §3).
    """
    compliance.verify_bid(db, bid_id=bid_id, provider=provider)
    db.commit()
    return _summary(db, bid_id)


@router.get("/bids/{bid_id}/compliance", response_model=VerificationSummary)
def get_compliance(bid_id: uuid.UUID, db: DbSession) -> VerificationSummary:
    return _summary(db, bid_id)


def _summary(db: Session, bid_id: uuid.UUID) -> VerificationSummary:
    bid = db.get(Bid, bid_id)
    if bid is None:
        raise NotFoundError(f"Bid {bid_id} not found")
    tender = db.get(Tender, bid.tender_id)

    member = (
        db.execute(
            select(BidMember).where(BidMember.bid_id == bid_id).order_by(BidMember.member_order)
        )
        .scalars()
        .first()
    )
    bidder = db.get(Bidder, member.bidder_id) if member else None

    run = (
        db.execute(
            select(VerificationRun)
            .where(VerificationRun.bid_id == bid_id)
            .order_by(VerificationRun.started_at.desc())
        )
        .scalars()
        .first()
    )

    results = {
        r.requirement_id: r
        for r in db.execute(
            select(ComplianceResult).where(ComplianceResult.bid_id == bid_id)
        ).scalars()
    }
    requirements = list(
        db.execute(
            select(Requirement)
            .where(Requirement.tender_id == bid.tender_id)
            .order_by(Requirement.display_order)
        ).scalars()
    )
    evidence_by_requirement: dict[uuid.UUID, list[uuid.UUID]] = {}
    for row in db.execute(select(Evidence).where(Evidence.bid_id == bid_id)).scalars():
        evidence_by_requirement.setdefault(row.requirement_id, []).extend(
            row.extracted_field_ids or []
        )

    rows: list[ComplianceRowOut] = []
    counts: dict[str, int] = {}
    for requirement in requirements:
        result = results.get(requirement.id)
        if result is None:
            continue
        counts[str(result.status)] = counts.get(str(result.status), 0) + 1
        rows.append(
            ComplianceRowOut(
                requirement_code=requirement.code,
                requirement_name=requirement.name,
                category=requirement.category,
                mandatory=requirement.mandatory,
                weight=requirement.weight,
                applicability_scope=requirement.applicability_scope,
                status=result.status,
                reasoning=result.reasoning,
                confidence=result.confidence,
                verification_method=result.verification_method,
                external_check_portal=result.external_check_portal,
                external_check_status=result.external_check_status,
                external_check_source=result.external_check_source,
                evidence_field_ids=evidence_by_requirement.get(requirement.id, []),
                override_status=result.override_status,
            )
        )

    checks = list(db.execute(select(PortalCheck).where(PortalCheck.bid_id == bid_id)).scalars())
    findings = list(
        db.execute(
            select(CrossDocumentFinding).where(CrossDocumentFinding.bid_id == bid_id)
        ).scalars()
    )
    flags = list(db.execute(select(RiskFlag).where(RiskFlag.bid_id == bid_id)).scalars())

    breakdown = bid.score_breakdown or {}
    return VerificationSummary(
        bid_id=bid.id,
        bidder_name=bidder.legal_name if bidder else "(unknown)",
        run_status=run.status if run else "queued",
        bid_due_date=tender.bid_due_date if tender else None,
        compliance_score=bid.compliance_score,
        mandatory_gate_passed=bid.mandatory_gate_passed,
        failed_mandatory=breakdown.get("failed_mandatory", []),
        risk_level=bid.risk_level,
        status_counts=counts,
        requirements=rows,
        cross_document_findings=[FindingOut.model_validate(f) for f in findings],
        risk_flags=[RiskFlagOut.model_validate(f) for f in flags],
        external_checks_simulated=sum(
            1 for c in checks if c.source is VerificationSource.SIMULATED
        ),
        external_checks_live=sum(1 for c in checks if c.source is VerificationSource.LIVE),
    )
