"""The compliance score. CLAUDE.md §10.

Arithmetic, not a model output. A transparent weighted sum over named
requirements, recomputable by hand from the verdict table — which is exactly the
property an audit or a tender challenge requires.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.db.enums import ComplianceStatus

# What each state contributes. NOT_APPLICABLE is excluded from the denominator
# entirely, so a bidder is never penalised for a rule that doesn't concern them.
STATUS_VALUE: dict[ComplianceStatus, Decimal] = {
    ComplianceStatus.COMPLIANT: Decimal("1.0"),
    ComplianceStatus.PARTIALLY_COMPLIANT: Decimal("0.5"),
    ComplianceStatus.NEEDS_HUMAN_REVIEW: Decimal("0.5"),
    ComplianceStatus.UNVERIFIED: Decimal("0.5"),
    ComplianceStatus.MISSING_EVIDENCE: Decimal("0.0"),
    ComplianceStatus.NON_COMPLIANT: Decimal("0.0"),
    ComplianceStatus.EXPIRED: Decimal("0.0"),
    ComplianceStatus.INCONSISTENT: Decimal("0.0"),
}


# A mandatory requirement in one of these states has been evaluated and found
# wanting. Only a deliberate officer override clears it.
HARD_FAILURE_STATES = frozenset(
    {
        ComplianceStatus.NON_COMPLIANT,
        ComplianceStatus.EXPIRED,
        ComplianceStatus.INCONSISTENT,
    }
)

# A mandatory requirement in one of these states is *unresolved*, not failed.
# The system has declined to conclude, and the officer's acceptance clears it.
# MISSING_EVIDENCE belongs here rather than above because §2 rule 5 is explicit
# that absent documentation routes to clarification, not to rejection.
PENDING_STATES = frozenset(
    {
        ComplianceStatus.NEEDS_HUMAN_REVIEW,
        ComplianceStatus.UNVERIFIED,
        ComplianceStatus.PARTIALLY_COMPLIANT,
        ComplianceStatus.MISSING_EVIDENCE,
    }
)


@dataclass
class Score:
    value: Decimal
    # True when nothing mandatory has *failed*. Says nothing about whether items
    # are still awaiting the officer — read ``pending_review`` for that.
    mandatory_gate_passed: bool
    mandatory_failed: list[str] = field(default_factory=list)
    pending_review: list[str] = field(default_factory=list)
    breakdown: list[dict] = field(default_factory=list)

    @property
    def qualifiable(self) -> bool:
        """Whether the officer could qualify this bidder as things stand.

        Both lists must be empty. A pending item does not mean the bidder failed
        — it means nobody has looked yet, which is a different thing to tell an
        officer and a different thing for them to act on.
        """
        return not self.mandatory_failed and not self.pending_review


def compute(rows: list[tuple]) -> Score:
    """``rows`` are ``(code, name, mandatory, applicable, weight, status)``.

    ``status`` should already be the *effective* status — the officer's override
    where one exists, otherwise the machine verdict. The machine verdict is
    never discarded; see ``effective_status``.

    Every requirement contributes at least a nominal weight, so a criterion the
    tender marked mandatory-but-unweighted still moves the score. Otherwise a
    bidder could fail a mandatory statutory check and score 100.
    """
    numerator = Decimal(0)
    denominator = Decimal(0)
    failed: list[str] = []
    pending: list[str] = []
    breakdown: list[dict] = []

    for code, name, mandatory, applicable, weight, status in rows:
        if not applicable or status is ComplianceStatus.NOT_APPLICABLE:
            breakdown.append(
                {
                    "code": code,
                    "name": name,
                    "status": str(status),
                    "weight": 0,
                    "value": None,
                    "excluded": "not applicable",
                }
            )
            continue

        effective = Decimal(weight or 0)
        if effective == 0:
            effective = Decimal(1)  # nominal weight; never a free pass
        value = STATUS_VALUE.get(status, Decimal(0))

        numerator += effective * value
        denominator += effective

        if mandatory:
            if status in HARD_FAILURE_STATES:
                failed.append(code)
            elif status in PENDING_STATES:
                pending.append(code)

        breakdown.append(
            {
                "code": code,
                "name": name,
                "status": str(status),
                "mandatory": mandatory,
                "weight": float(effective),
                "value": float(value),
                "contribution": float(effective * value),
            }
        )

    score = (Decimal(100) * numerator / denominator) if denominator else Decimal(0)
    return Score(
        value=score.quantize(Decimal("0.01")),
        mandatory_gate_passed=not failed,
        mandatory_failed=failed,
        pending_review=pending,
        breakdown=breakdown,
    )


def effective_status(machine_status, override_status):
    """What counts, without discarding what the machine said.

    CLAUDE.md §5: a human override does not replace the machine verdict — it is
    stored alongside it, and both stay visible. This function decides which one
    the gate and the score are computed from; both remain in the row and both
    are rendered.
    """
    return override_status if override_status is not None else machine_status
