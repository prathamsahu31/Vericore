"""Officer review, and the audit chain that records it.

CLAUDE.md §4 layer 9: the only place a decision is made. An override is stored
*alongside* the machine verdict, never in place of it, so the record shows both
what the system found and what the officer decided, and why (§5, §15).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.enums import ActorType, ComplianceStatus
from app.db.models import AuditEvent, Bid, ComplianceResult, Requirement
from app.errors import NotFoundError, ValidationError
from app.modules.compliance_engine.scoring import PENDING_STATES
from app.modules.compliance_engine.service import rescore


@dataclass(frozen=True)
class ChainIntegrity:
    """Whether the audit log is intact, and where it breaks if not."""

    total_events: int
    intact: bool
    first_broken_seq: int | None
    head_hash: str | None


def review_requirement(
    db: Session,
    *,
    bid_id: uuid.UUID,
    requirement_code: str,
    action: str,
    officer_id: uuid.UUID,
    reason: str,
    override_status: ComplianceStatus | None = None,
):
    """Record an officer's review of one requirement.

    ``accept``   — the officer has read the evidence and is satisfied. Only
                   valid on a requirement the system left unresolved; accepting
                   something the system found *failed* would be an override, and
                   is made to say so.
    ``override`` — the officer deliberately substitutes a different verdict.

    Both write the same columns, and both require a reason the database will not
    let be blank. The distinction is recorded in the audit chain, because
    "I looked and agreed" and "I disagree with the system" are different acts.
    """
    bid = db.get(Bid, bid_id)
    if bid is None:
        raise NotFoundError(f"Bid {bid_id} not found")

    requirement = db.execute(
        select(Requirement).where(
            Requirement.tender_id == bid.tender_id, Requirement.code == requirement_code
        )
    ).scalar_one_or_none()
    if requirement is None:
        raise NotFoundError(f"Requirement {requirement_code} not found on this tender")

    result = db.execute(
        select(ComplianceResult).where(
            ComplianceResult.bid_id == bid_id,
            ComplianceResult.requirement_id == requirement.id,
        )
    ).scalar_one_or_none()
    if result is None:
        raise NotFoundError(f"{requirement_code} has no verdict on this bid yet")

    if not reason or not reason.strip():
        raise ValidationError(
            "A reason is required. Every officer action on this system is recorded "
            "with its justification, and the justification cannot be skipped."
        )

    if action == "accept":
        if result.status not in PENDING_STATES:
            raise ValidationError(
                f"{requirement_code} is {result.status}, which the system evaluated and "
                f"found wanting. Changing it is an override, not an acceptance — use "
                f"action='override' so the record says what actually happened.",
                detail={"machine_status": str(result.status)},
            )
        new_status = ComplianceStatus.COMPLIANT
    elif action == "override":
        if override_status is None:
            raise ValidationError("An override must state the status it substitutes.")
        new_status = override_status
    else:
        raise ValidationError(f"Unknown action {action!r}. Use 'accept' or 'override'.")

    previous = result.status
    # The machine verdict in `status` is untouched. Both stay visible.
    result.override_status = new_status
    result.override_reason = reason.strip()
    result.override_by = officer_id
    result.override_at = datetime.now(UTC)

    db.add(
        AuditEvent(
            tender_id=bid.tender_id,
            bid_id=bid.id,
            requirement_id=requirement.id,
            event_type=f"officer_{action}",
            actor_type=ActorType.OFFICER,
            actor_id=officer_id,
            previous_state=str(previous),
            new_state=str(new_status),
            reason=reason.strip(),
            payload={
                "requirement_code": requirement_code,
                "machine_status": str(previous),
                "officer_status": str(new_status),
                "machine_reasoning": result.reasoning,
            },
        )
    )
    db.flush()
    score = rescore(db, bid)
    return result, score


def chain_integrity(db: Session) -> ChainIntegrity:
    """Verify the audit chain, using the database's own verifier.

    Shown at the top of the audit trail (CLAUDE.md §11). The function
    recomputes every row's hash and checks every link, sharing its payload
    definition with the insert trigger so the two cannot drift.
    """
    rows = (
        db.execute(text("SELECT seq, link_ok, hash_ok FROM vericore_audit_chain_verify()"))
        .mappings()
        .all()
    )
    broken = [r["seq"] for r in rows if not (r["link_ok"] and r["hash_ok"])]
    head = db.execute(
        text("SELECT row_hash FROM audit_events ORDER BY seq DESC LIMIT 1")
    ).scalar_one_or_none()
    return ChainIntegrity(
        total_events=len(rows),
        intact=not broken,
        first_broken_seq=broken[0] if broken else None,
        head_hash=head,
    )


def audit_trail(db: Session, *, bid_id: uuid.UUID | None = None, limit: int = 200):
    """Events in chain order, newest last — the order they were sealed in."""
    stmt = select(AuditEvent).order_by(AuditEvent.seq)
    if bid_id is not None:
        stmt = stmt.where(AuditEvent.bid_id == bid_id)
    return list(db.execute(stmt.limit(limit)).scalars())
