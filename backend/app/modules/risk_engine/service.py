"""Layer 8: risk. CLAUDE.md §10.

A different question from the score. The score asks "how completely does this
bidder meet the requirements?"; risk asks "how likely is this bidder to be
misrepresenting itself?" A bidder can score well and still be high risk, so the
two are computed independently and never folded together.

Driven by counted red flags, not by pass rate. The UI always lists which fired.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.db.enums import ComplianceStatus, RiskLevel, Severity
from app.modules.compliance_engine.evidence_index import BidEvidence, parse_date

# A company incorporated shortly before a large bid is the shell-company
# pattern; a certificate lapsing during the contract is a continuity concern.
SHELL_COMPANY_MONTHS = 12
TURNOVER_TO_BID_MIN_RATIO = 0.5


@dataclass
class RiskFlag:
    code: str
    category: str
    severity: Severity
    description: str
    evidence_refs: dict = field(default_factory=dict)


@dataclass
class RiskAssessment:
    level: RiskLevel
    flags: list[RiskFlag]
    rationale: str


def assess(
    *,
    evidence: BidEvidence,
    findings: list,
    verdicts: list,
    bid_due_date: date,
    estimated_value=None,
    contract_start_date: date | None = None,
) -> RiskAssessment:
    flags: list[RiskFlag] = []

    flags += _no_evidence(evidence)
    flags += _from_cross_document(findings)
    flags += _debarment(verdicts)
    flags += _young_company(evidence, bid_due_date)
    flags += _turnover_ratio(evidence, estimated_value)
    flags += _expiring_certificates(evidence, bid_due_date, contract_start_date)
    flags += _unverifiable(verdicts)

    flags = _one_per_code(flags)
    return RiskAssessment(level=_band(flags), flags=flags, rationale=_rationale(flags))


def _no_evidence(evidence: BidEvidence) -> list[RiskFlag]:
    """A submission that yielded nothing to look at is not low risk.

    Risk measures misrepresentation likelihood; an empty submission cannot be
    vetted at all, so it is itself the signal (CLAUDE.md §10, signal list).
    """
    submitted = sum(len(evidence.fields(segment)) for segment in evidence.segments)
    if submitted:
        return []
    return [
        RiskFlag(
            code="no_evidence_submitted",
            category="verification",
            severity=Severity.HIGH,
            description=(
                "No verifiable evidence was extracted from this submission — "
                "nothing submitted could be checked, so the bid is unassessable "
                "rather than low risk."
            ),
            evidence_refs={"submitted_fields": 0},
        )
    ]


def _one_per_code(flags: list[RiskFlag]) -> list[RiskFlag]:
    """Collapse repeats of the same signal into a single flag.

    A bidder whose PAN differs from the one embedded in their GSTIN produces
    that finding once per document the PAN appears in — three times, for the
    same underlying problem. ``risk_flags`` is unique on (bid_id, code)
    precisely so the officer reads one line per *kind* of concern, and the
    counted bands in §10 would otherwise treat one problem as several.

    The surviving flag keeps the highest severity seen and lists every
    description, so nothing is lost in the merge.
    """
    merged: dict[str, RiskFlag] = {}
    order = [Severity.INFO, Severity.WARNING, Severity.HIGH, Severity.CRITICAL]

    for flag in flags:
        existing = merged.get(flag.code)
        if existing is None:
            merged[flag.code] = flag
            continue
        descriptions = existing.evidence_refs.get("occurrences", [existing.description])
        if flag.description not in descriptions:
            descriptions = [*descriptions, flag.description]
        merged[flag.code] = RiskFlag(
            code=flag.code,
            category=existing.category,
            severity=max(existing.severity, flag.severity, key=order.index),
            description=(
                descriptions[0]
                if len(descriptions) == 1
                else f"{len(descriptions)} occurrences. " + " ".join(descriptions)
            ),
            evidence_refs={**existing.evidence_refs, "occurrences": descriptions},
        )
    return list(merged.values())


def _from_cross_document(findings: list) -> list[RiskFlag]:
    out: list[RiskFlag] = []
    for f in findings:
        if f.severity in (Severity.INFO,):
            continue
        out.append(
            RiskFlag(
                code=f.finding_type,
                category="consistency",
                severity=f.severity,
                description=f.description,
                evidence_refs={"value_a": f.value_a, "value_b": f.value_b},
            )
        )
    return out


def _debarment(verdicts: list) -> list[RiskFlag]:
    """A debarment hit is disqualifying on its own (CLAUDE.md §10)."""
    for verdict in verdicts:
        external = getattr(verdict, "external", None)
        if external and external.portal_id == "blacklist" and external.status == "found":
            return [
                RiskFlag(
                    code="debarment_hit",
                    category="integrity",
                    severity=Severity.CRITICAL,
                    description=(
                        f"The debarment register returned a record for this bidder "
                        f"(source: {external.source}). {external.data}"
                    ),
                    evidence_refs=dict(external.data),
                )
            ]
    return []


def _young_company(evidence: BidEvidence, bid_due_date: date) -> list[RiskFlag]:
    incorporated = evidence.date("incorporation_date")
    if incorporated is None:
        return []
    months = (bid_due_date - incorporated).days / 30.44
    if months >= SHELL_COMPANY_MONTHS:
        return []
    return [
        RiskFlag(
            code="recently_incorporated",
            category="capacity",
            severity=Severity.HIGH,
            description=(
                f"Incorporated {incorporated.isoformat()}, only {months:.0f} months before "
                f"the bid due date. This is the shell-company pattern and warrants a look."
            ),
            evidence_refs={"incorporation_date": incorporated.isoformat()},
        )
    ]


def _turnover_ratio(evidence: BidEvidence, estimated_value) -> list[RiskFlag]:
    if not estimated_value:
        return []
    turnover = evidence.amount("turnover_fy1")
    if turnover is None or turnover == 0:
        return []
    ratio = float(turnover) / float(estimated_value)
    if ratio >= TURNOVER_TO_BID_MIN_RATIO:
        return []
    return [
        RiskFlag(
            code="turnover_to_bid_ratio",
            category="capacity",
            severity=Severity.WARNING,
            description=(
                f"Most recent turnover is {ratio:.1f}x the estimated tender value. "
                f"A ratio this low can indicate capacity overreach."
            ),
            evidence_refs={"ratio": round(ratio, 2)},
        )
    ]


def _expiring_certificates(
    evidence: BidEvidence, bid_due_date: date, contract_start_date: date | None
) -> list[RiskFlag]:
    """Valid at bid time but lapsing soon is a continuity risk, not a failure.

    One flag per bid, listing every certificate concerned. ``risk_flags`` is
    unique on (bid_id, code) precisely so the officer sees one line per *kind* of
    concern rather than one per document.
    """
    horizon = contract_start_date or bid_due_date
    concerns: list[str] = []
    refs: dict[str, str] = {}

    for extracted in evidence.find("valid_until"):
        valid_until = parse_date(extracted.field_value)
        if valid_until is None or valid_until < bid_due_date:
            continue  # already EXPIRED, handled by the engine as a verdict
        days = (valid_until - horizon).days
        if days > 90:
            continue
        segment = evidence.segment_of(extracted)
        label = segment.doc_type.replace("_", " ") if segment else "certificate"
        if valid_until < horizon:
            concerns.append(
                f"the {label} is valid at the bid due date but expires "
                f"{valid_until.isoformat()}, {abs(days)} day(s) BEFORE the contract is due "
                f"to start on {horizon.isoformat()}"
            )
        else:
            concerns.append(
                f"the {label} expires {valid_until.isoformat()}, only {days} day(s) after "
                f"the contract is due to start"
            )
        refs[label] = valid_until.isoformat()

    if not concerns:
        return []
    return [
        RiskFlag(
            code="certificate_expires_soon",
            category="continuity",
            severity=Severity.WARNING,
            description=(
                "Renewal will be needed for the contract period: " + "; ".join(concerns) + "."
            ),
            evidence_refs=refs,
        )
    ]


def _unverifiable(verdicts: list) -> list[RiskFlag]:
    """Surfaced, never hidden — the count of checks that could not run."""
    count = sum(1 for v in verdicts if v.status is ComplianceStatus.UNVERIFIED)
    if not count:
        return []
    return [
        RiskFlag(
            code="external_checks_unavailable",
            category="verification",
            severity=Severity.INFO,
            description=(
                f"{count} external check(s) could not be run, so nothing is claimed about "
                f"them. This is residual risk, not a finding against the bidder."
            ),
            evidence_refs={"count": count},
        )
    ]


def _band(flags: list[RiskFlag]) -> RiskLevel:
    """CRITICAL on any critical; HIGH on >=2 high; MEDIUM on 1 high or >=3 medium."""
    critical = sum(1 for f in flags if f.severity is Severity.CRITICAL)
    high = sum(1 for f in flags if f.severity is Severity.HIGH)
    medium = sum(1 for f in flags if f.severity is Severity.WARNING)

    if critical:
        return RiskLevel.CRITICAL
    if high >= 2:
        return RiskLevel.HIGH
    if high == 1 or medium >= 3:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _rationale(flags: list[RiskFlag]) -> str:
    if not flags:
        return "No risk signals fired."
    counts: dict[str, int] = {}
    for f in flags:
        counts[str(f.severity)] = counts.get(str(f.severity), 0) + 1
    parts = ", ".join(f"{n} {sev}" for sev, n in sorted(counts.items()))
    return f"{len(flags)} signal(s) fired: {parts}."
