"""The verification run: layers 4 through 8, for one bid.

Reads the confirmed checklist, routes evidence to each requirement, evaluates,
cross-checks the bidder's documents against each other, scores, and assesses
risk. Writes everything it concludes, with citations.

It does not decide. Nothing here writes ``bids.decision`` — that column is only
ever set by an authenticated officer action (CLAUDE.md §2, §4 layer 9).
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.enums import (
    ActorType,
    ComplianceStatus,
    TenderStatus,
    VerificationRunStatus,
)
from app.db.models import (
    AuditEvent,
    Bid,
    Bidder,
    BidMember,
    ComplianceResult,
    CrossDocumentFinding,
    Document,
    DocumentSegment,
    Evidence,
    ExtractedField,
    PortalCheck,
    Requirement,
    RiskFlag,
    Tender,
    VerificationRun,
)
from app.errors import GateNotSatisfiedError, NotFoundError
from app.modules.compliance_engine import cross_document, engine, scoring
from app.modules.compliance_engine.evidence_index import BidEvidence
from app.modules.risk_engine.service import assess

log = logging.getLogger(__name__)


def _bid_due_date(tender: Tender) -> date:
    """Pinned by BID_DUE_DATE_OVERRIDE so demo runs are reproducible (§14)."""
    override = get_settings().bid_due_date_override
    if override:
        return override
    if tender.bid_due_date:
        return tender.bid_due_date
    return datetime.now(UTC).date()


def _load_evidence(db: Session, bid_id: uuid.UUID) -> BidEvidence:
    segments = list(
        db.execute(
            select(DocumentSegment)
            .join(Document, Document.id == DocumentSegment.document_id)
            .where(Document.bid_id == bid_id)
            .order_by(DocumentSegment.created_at)
        ).scalars()
    )
    fields_by_segment: dict[uuid.UUID, list[ExtractedField]] = {}
    if segments:
        rows = db.execute(
            select(ExtractedField).where(
                ExtractedField.document_segment_id.in_([s.id for s in segments])
            )
        ).scalars()
        for row in rows:
            fields_by_segment.setdefault(row.document_segment_id, []).append(row)
    return BidEvidence(segments=segments, fields_by_segment=fields_by_segment)


def verify_bid(db: Session, *, bid_id: uuid.UUID, provider) -> VerificationRun:
    """Run layers 4–8 over one bid and store the result."""
    bid = db.get(Bid, bid_id)
    if bid is None:
        raise NotFoundError(f"Bid {bid_id} not found")

    tender = db.get(Tender, bid.tender_id)
    if tender.status is not TenderStatus.REQUIREMENTS_CONFIRMED:
        raise GateNotSatisfiedError(
            "This tender's requirement checklist has not been confirmed. Verification "
            "cannot run against an unconfirmed checklist, because a misread threshold "
            "would silently corrupt every verdict.",
            detail={"tender_id": str(tender.id), "status": str(tender.status)},
        )

    requirements = list(
        db.execute(
            select(Requirement)
            .where(Requirement.tender_id == tender.id)
            .order_by(Requirement.display_order)
        ).scalars()
    )

    run = VerificationRun(
        bid_id=bid.id,
        status=VerificationRunStatus.RUNNING,
        phase="loading evidence",
        progress_completed=0,
        progress_total=len(requirements),
    )
    db.add(run)
    db.flush()

    try:
        _run(db, bid, tender, requirements, run, provider)
    except Exception as exc:  # noqa: BLE001 - a failed run is recorded, not swallowed
        run.status = VerificationRunStatus.FAILED
        run.error_message = f"{type(exc).__name__}: {exc}"
        run.finished_at = datetime.now(UTC)
        db.flush()
        log.exception("verification run failed bid=%s", bid_id)
        raise

    return run


def _run(db, bid, tender, requirements, run, provider) -> None:
    due_date = _bid_due_date(tender)
    evidence = _load_evidence(db, bid.id)
    bidder, lead_member_id = _lead(db, bid.id)

    # Layers 4, 6, 7 — one requirement at a time, sequentially by design (§7.7).
    _clear_previous(db, bid.id)
    verdicts = []
    for index, requirement in enumerate(requirements, start=1):
        run.phase = f"evaluating {requirement.code}"
        run.progress_completed = index
        db.flush()

        verdict = engine.evaluate(
            requirement,
            evidence,
            due_date,
            provider,
            lead_member_id=lead_member_id,
            bidder_name=bidder.legal_name,
        )
        external = engine.run_external_check(requirement, evidence, bidder)
        verdict = engine.apply_external(verdict, external)
        verdicts.append(verdict)

        if external is not None:
            db.add(
                PortalCheck(
                    bid_id=bid.id,
                    bid_member_id=lead_member_id,
                    requirement_id=requirement.id,
                    verification_run_id=run.id,
                    portal_id=external.portal_id,
                    identifier=external.identifier,
                    status=external.status,
                    source=external.source,
                    data=external.data or None,
                    retrieved_at=external.retrieved_at,
                )
            )

    # Layer 5 — cross-document consistency.
    run.phase = "cross-checking documents"
    db.flush()
    findings = cross_document.run(evidence, bidder)
    for finding in findings:
        db.add(
            CrossDocumentFinding(
                bid_id=bid.id,
                bid_member_id=lead_member_id,
                finding_type=finding.finding_type,
                severity=finding.severity,
                description=finding.description,
                field_name=finding.field_name,
                value_a=finding.value_a,
                value_b=finding.value_b,
                segment_a_id=finding.segment_a_id,
                segment_b_id=finding.segment_b_id,
                similarity_score=finding.similarity_score,
                normalization_steps=finding.normalization_steps,
            )
        )

    verdicts = _apply_findings(verdicts, requirements, findings)
    _persist_verdicts(db, bid, requirements, verdicts, evidence, lead_member_id)

    # Layers 8 — score and risk, computed independently of one another (§10).
    run.phase = "scoring"
    db.flush()
    score = rescore(db, bid)
    risk = assess(
        evidence=evidence,
        findings=findings,
        verdicts=verdicts,
        bid_due_date=due_date,
        estimated_value=tender.estimated_value,
        contract_start_date=tender.contract_start_date,
    )
    for flag in risk.flags:
        db.add(
            RiskFlag(
                bid_id=bid.id,
                code=flag.code,
                category=flag.category,
                severity=flag.severity,
                description=flag.description,
                evidence_refs=flag.evidence_refs or None,
            )
        )

    bid.score_breakdown = {**(bid.score_breakdown or {}), "bid_due_date": due_date.isoformat()}
    bid.risk_level = risk.level

    db.add(
        AuditEvent(
            tender_id=tender.id,
            bid_id=bid.id,
            event_type="verification_run_completed",
            actor_type=ActorType.SYSTEM,
            actor_component="compliance_engine",
            new_state=str(risk.level),
            reason=risk.rationale,
            payload={
                "requirements_evaluated": len(requirements),
                "compliance_score": str(score.value),
                "mandatory_gate_passed": score.mandatory_gate_passed,
                "mandatory_failed": score.mandatory_failed,
                "pending_review": score.pending_review,
                "cross_document_findings": len(findings),
                "risk_flags": [f.code for f in risk.flags],
            },
        )
    )

    run.status = VerificationRunStatus.SUCCEEDED
    run.phase = "complete"
    run.finished_at = datetime.now(UTC)
    db.flush()


def _lead(db: Session, bid_id: uuid.UUID) -> tuple[Bidder, uuid.UUID | None]:
    """The member a lead_only requirement binds to.

    For a sole bid this is the only member, so every applicability scope
    collapses to it and the engine needs no special case (CLAUDE.md §20).
    """
    member = (
        db.execute(
            select(BidMember).where(BidMember.bid_id == bid_id).order_by(BidMember.member_order)
        )
        .scalars()
        .first()
    )
    if member is None:
        raise NotFoundError(f"Bid {bid_id} has no members")
    return db.get(Bidder, member.bidder_id), member.id


def _clear_previous(db: Session, bid_id: uuid.UUID) -> None:
    """A re-run replaces its own previous output — but never the audit trail."""
    for model in (Evidence, ComplianceResult, CrossDocumentFinding, RiskFlag, PortalCheck):
        for row in db.execute(select(model).where(model.bid_id == bid_id)).scalars():
            db.delete(row)
    db.flush()


def _apply_findings(verdicts, requirements, findings):
    """A contradiction makes the consistency requirement INCONSISTENT."""
    blocking = [f for f in findings if f.severity.value in ("critical", "high")]
    if not blocking:
        return verdicts

    for requirement, verdict in zip(requirements, verdicts, strict=True):
        if "*" not in (requirement.accepts_document_types or []):
            continue
        if "consisten" not in (requirement.name or "").lower():
            continue
        verdict.status = ComplianceStatus.INCONSISTENT
        verdict.reasoning = (
            f"{len(blocking)} contradiction(s) found between the bidder's own documents: "
            + "; ".join(f.description for f in blocking[:2])
        )
        verdict.verification_method = "cross_document"
    return verdicts


def _persist_verdicts(db, bid, requirements, verdicts, evidence, lead_member_id) -> None:
    for requirement, verdict in zip(requirements, verdicts, strict=True):
        external = verdict.external
        db.add(
            ComplianceResult(
                bid_id=bid.id,
                requirement_id=requirement.id,
                status=verdict.status,
                applicable=verdict.applicable,
                confidence=verdict.confidence,
                reasoning=verdict.reasoning,
                verification_method=verdict.verification_method,
                satisfied_by_bid_member_id=(
                    verdict.satisfied_by_member_id
                    if verdict.status is ComplianceStatus.COMPLIANT
                    else None
                ),
                external_check_portal=external.portal_id if external else None,
                external_check_status=external.status if external else None,
                external_check_source=external.source if external else None,
            )
        )
        # Evidence rows: the citation trail behind the verdict (§2 rule 1).
        for segment_id in verdict.segment_ids:
            cited = [fid for fid in verdict.field_ids if _in_segment(evidence, fid, segment_id)]
            if not cited and verdict.field_ids:
                continue
            db.add(
                Evidence(
                    bid_id=bid.id,
                    requirement_id=requirement.id,
                    document_segment_id=segment_id,
                    bid_member_id=lead_member_id,
                    extracted_field_ids=cited,
                    field_snapshot=_snapshot(evidence, cited) or None,
                    confidence=verdict.confidence,
                )
            )
    db.flush()


def _in_segment(evidence: BidEvidence, field_id, segment_id) -> bool:
    return any(f.id == field_id for f in evidence.fields_by_segment.get(segment_id, []))


def _snapshot(evidence: BidEvidence, field_ids) -> dict:
    """Values as they stood when the verdict formed, so a later re-extraction
    cannot silently rewrite what an officer saw."""
    out: dict = {}
    for fields in evidence.fields_by_segment.values():
        for f in fields:
            if f.id in field_ids:
                out[f.field_name] = f.field_value
    return out


def rescore(db: Session, bid: Bid) -> scoring.Score:
    """Recompute the score and both gates from the stored verdicts.

    Reads the *effective* status of each requirement — an officer's override
    where one exists, the machine verdict otherwise — so accepting a pending
    item moves the gate without erasing what the system originally found (§5).

    Called at the end of a verification run and again after every review, so
    the two can never drift apart.
    """
    results = {
        r.requirement_id: r
        for r in db.execute(
            select(ComplianceResult).where(ComplianceResult.bid_id == bid.id)
        ).scalars()
    }
    requirements = list(
        db.execute(
            select(Requirement)
            .where(Requirement.tender_id == bid.tender_id)
            .order_by(Requirement.display_order)
        ).scalars()
    )

    rows = []
    for requirement in requirements:
        result = results.get(requirement.id)
        if result is None:
            continue
        rows.append(
            (
                requirement.code,
                requirement.name,
                requirement.mandatory,
                result.applicable,
                float(requirement.weight or 0),
                scoring.effective_status(result.status, result.override_status),
            )
        )

    score = scoring.compute(rows)
    bid.compliance_score = score.value
    bid.mandatory_gate_passed = score.mandatory_gate_passed
    bid.score_breakdown = {
        **(bid.score_breakdown or {}),
        "requirements": score.breakdown,
        "mandatory_failed": score.mandatory_failed,
        "pending_review": score.pending_review,
        "qualifiable": score.qualifiable,
    }
    db.flush()
    return score
