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


@dataclass
class Score:
    value: Decimal
    mandatory_gate_passed: bool
    failed_mandatory: list[str] = field(default_factory=list)
    breakdown: list[dict] = field(default_factory=list)


def compute(rows: list[tuple]) -> Score:
    """``rows`` are ``(code, name, mandatory, applicable, weight, status)``.

    Every requirement contributes at least a nominal weight, so a criterion the
    tender marked mandatory-but-unweighted still moves the score. Otherwise a
    bidder could fail a mandatory statutory check and score 100.
    """
    numerator = Decimal(0)
    denominator = Decimal(0)
    failed: list[str] = []
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
        if mandatory and status is not ComplianceStatus.COMPLIANT:
            failed.append(code)

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
        failed_mandatory=failed,
        breakdown=breakdown,
    )
