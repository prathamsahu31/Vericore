"""Layers 4 and 7: match evidence to requirements, and assign a state.

The division of labour here is the product's credibility argument. Every
numeric, date and identifier comparison is delegated to ``rules`` — pure
functions with no model in them. The LLM is consulted only where a requirement
is inherently prose (CLAUDE.md §7.4), and even then its answer is routed to
``NEEDS_HUMAN_REVIEW`` rather than being taken as a verdict.

No path in this module qualifies or disqualifies a bidder. It assigns one of
the nine states of §5 and explains why.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import date

from app.db.enums import ComplianceStatus, LocatorStatus
from app.db.models import Requirement
from app.modules.compliance_engine import rules
from app.modules.compliance_engine.evidence_index import (
    BidEvidence,
    RoutingResult,
    humanise_doc_type,
    parse_date,
    route,
    with_article,
)
from app.modules.verification_adapter.adapter import (
    VerificationResult,
    get_adapter,
    portal_for,
)

log = logging.getLogger(__name__)

# Fields whose absence means the requirement cannot be judged mechanically.
TURNOVER_FIELDS = ("turnover_fy1", "turnover_fy2", "turnover_fy3")


@dataclass
class Verdict:
    """One requirement × bid outcome, with everything needed to defend it."""

    requirement_id: uuid.UUID
    status: ComplianceStatus
    reasoning: str
    applicable: bool = True
    confidence: float | None = None
    verification_method: str | None = None
    segment_ids: list[uuid.UUID] = field(default_factory=list)
    field_ids: list[uuid.UUID] = field(default_factory=list)
    outcomes: list[rules.RuleOutcome] = field(default_factory=list)
    external: VerificationResult | None = None
    satisfied_by_member_id: uuid.UUID | None = None


def _cite(verdict: Verdict, evidence: BidEvidence, *fields) -> None:
    """Attach the fields a verdict rests on.

    CLAUDE.md §2 rule 1: a verdict without evidence references is a bug.
    """
    for f in fields:
        if f is None:
            continue
        verdict.field_ids.append(f.id)
        if f.document_segment_id not in verdict.segment_ids:
            verdict.segment_ids.append(f.document_segment_id)


def _unlocated(*fields) -> bool:
    """Whether any cited field's box is a page rather than a highlight.

    §24: such a field may never produce an automatic COMPLIANT.
    """
    return any(
        f is not None
        and f.locator_status in (LocatorStatus.PAGE_FALLBACK, LocatorStatus.SEGMENT_FALLBACK)
        for f in fields
    )


# Fields that name the entity a document belongs to.
ATTRIBUTION_FIELDS = ("legal_name", "enterprise_name")


def evaluate(
    requirement: Requirement,
    evidence: BidEvidence,
    bid_due_date: date,
    provider,
    lead_member_id: uuid.UUID | None = None,
    bidder_name: str | None = None,
) -> Verdict:
    """Assign one of the nine states to one requirement."""
    verdict = _evaluate(requirement, evidence, bid_due_date, provider, lead_member_id)
    return _check_attribution(verdict, evidence, bidder_name)


def _check_attribution(verdict: Verdict, evidence: BidEvidence, bidder_name: str | None) -> Verdict:
    """Evidence has to belong to the bidder.

    A turnover certificate issued to the bidder's holding company clears the
    threshold on someone else's money. The figure is real and the arithmetic is
    right, so nothing upstream objects — and a silent COMPLIANT would be the
    system answering a question the tender never asked.

    Whether a parent's resources may be relied on is a policy judgement that
    real tenders decide case by case, so this does not fail the requirement. It
    routes to the officer, naming the other entity, which is the same treatment
    §21 gives a required field that could not be read and §24 gives a value that
    could not be placed on its page.
    """
    if verdict.status is not ComplianceStatus.COMPLIANT or not bidder_name:
        return verdict

    # Only segments that actually contributed a cited value. A wildcard
    # requirement routes to every segment in the bundle, and one outside
    # document among them should not colour a verdict that never read it.
    cited = set(verdict.field_ids)
    contributing = [
        segment
        for segment in evidence.segments
        if any(f.id in cited for f in evidence.fields(segment))
    ]

    for segment in contributing:
        for field_name in ATTRIBUTION_FIELDS:
            named = evidence.field(segment, field_name)
            if named is None or not named.field_value:
                continue
            outcome = rules.compare_legal_names(named.field_value, bidder_name)
            if outcome.passed:
                continue
            verdict.status = ComplianceStatus.NEEDS_HUMAN_REVIEW
            verdict.outcomes = [*verdict.outcomes, outcome]
            if outcome.working.get("needs_human"):
                # Close, but not the same. Possibly one company's inconsistent
                # paperwork, possibly two companies — not for us to decide (§9).
                note = (
                    f"However, this rests on a {humanise_doc_type(segment.doc_type)} "
                    f"naming '{named.field_value}', while the bidder is registered as "
                    f"'{bidder_name}'. Please confirm they are the same company."
                )
            else:
                note = (
                    f"However, this rests on a {humanise_doc_type(segment.doc_type)} "
                    f"issued to '{named.field_value}', which is not the bidding entity "
                    f"('{bidder_name}'). Whether that entity's standing may be relied "
                    f"on is a decision for you, not for this system."
                )
            verdict.reasoning = f"{verdict.reasoning} {note}".strip()
            return verdict
    return verdict


def _evaluate(
    requirement: Requirement,
    evidence: BidEvidence,
    bid_due_date: date,
    provider,
    lead_member_id: uuid.UUID | None = None,
) -> Verdict:
    """Dispatch to the check the requirement's condition calls for."""
    verdict = Verdict(
        requirement_id=requirement.id,
        status=ComplianceStatus.MISSING_EVIDENCE,
        reasoning="",
        satisfied_by_member_id=lead_member_id,
    )

    routing = route(requirement, evidence)
    if not routing.has_evidence:
        return _missing(verdict, routing)

    verdict.segment_ids = [s.id for s in routing.segments]
    condition = requirement.condition or {}
    operator = condition.get("operator")
    target = condition.get("field")

    if operator == "min_years_before_due_date":
        return _age(verdict, requirement, evidence, bid_due_date, condition)
    if target == "average_annual_turnover":
        return _turnover(verdict, requirement, evidence, condition)
    if target == "order_value":
        return _experience(verdict, requirement, evidence, bid_due_date, condition)
    if operator == "not_expired_at_due_date":
        return _validity(verdict, requirement, evidence, bid_due_date, routing)
    if operator in (">=", ">", "<=", "<", "==") and target:
        return _numeric(verdict, requirement, evidence, condition)

    return _presence(verdict, requirement, evidence, routing, provider)


# ─────────────────────────────────────────────────────────────────────────────
# Individual evaluations
# ─────────────────────────────────────────────────────────────────────────────
def _missing(verdict: Verdict, routing: RoutingResult) -> Verdict:
    """Missing evidence is not failure (CLAUDE.md §2 rule 5)."""
    names = ", ".join(humanise_doc_type(t) for t in routing.missing_document_types)
    verdict.status = ComplianceStatus.MISSING_EVIDENCE
    verdict.reasoning = (
        f"No {names} was submitted. This routes to the clarification workflow; "
        f"real procurement solicits a shortfall document rather than rejecting outright."
        if names
        else "No document of an accepted type was submitted for this requirement."
    )
    verdict.verification_method = "routing"
    return verdict


def _age(verdict, requirement, evidence, bid_due_date, condition) -> Verdict:
    incorporated = evidence.first("incorporation_date", requirement.accepts_document_types)
    if incorporated is None:
        return _needs_review(
            verdict,
            "An incorporation certificate was submitted but no date of incorporation "
            "could be read from it. Please read the date from the document.",
        )
    outcome = rules.check_minimum_age(
        parse_date(incorporated.field_value), bid_due_date, int(condition["threshold"])
    )
    _cite(verdict, evidence, incorporated)
    verdict.outcomes = [outcome]
    verdict.verification_method = "deterministic_date"
    verdict.status = _pass_or_fail(outcome, incorporated)
    verdict.reasoning = outcome.detail
    verdict.confidence = incorporated.confidence
    return verdict


def _turnover(verdict, requirement, evidence, condition) -> Verdict:
    """Averaged then compared, both in Python. The LLM does no arithmetic (§7.5)."""
    cited = [evidence.first(name, requirement.accepts_document_types) for name in TURNOVER_FIELDS]
    values = [rules.parse_amount(f.field_value) if f else None for f in cited]
    required_years = condition.get("period_years")

    average = rules.average_turnover(values, required_years=required_years)
    _cite(verdict, evidence, *cited)
    verdict.verification_method = "deterministic_calculation"

    if not average.passed:
        return _needs_review(verdict, average.detail, outcomes=[average])

    mean = rules.Decimal(average.working["mean"])
    threshold = rules.compare_threshold(
        mean, condition["operator"], condition["threshold"], condition.get("unit", "")
    )
    verdict.outcomes = [average, threshold]
    verdict.reasoning = f"{average.detail} {threshold.detail}"
    verdict.confidence = min((f.confidence for f in cited if f), default=None)
    verdict.status = (
        ComplianceStatus.COMPLIANT if threshold.passed else ComplianceStatus.NON_COMPLIANT
    )
    if threshold.passed and _unlocated(*cited):
        return _needs_review(
            verdict,
            verdict.reasoning + " Source values could not be "
            "pinpointed on the page; please confirm them.",
            verdict.outcomes,
        )
    return verdict


def _experience(verdict, requirement, evidence, bid_due_date, condition) -> Verdict:
    """Value and recency, per work order. Both deterministic."""
    accepted = requirement.accepts_document_types
    orders = evidence.find("order_value", accepted)
    if not orders:
        return _needs_review(
            verdict,
            "A work order was submitted but no order value could be read from it.",
        )

    qualifying: list[tuple] = []
    outcomes: list[rules.RuleOutcome] = []
    for order in orders:
        segment = evidence.segment_of(order)
        completed = evidence.field(segment, "completion_date") if segment else None
        value_check = rules.compare_threshold(
            rules.parse_amount(order.field_value),
            condition["operator"],
            condition["threshold"],
            condition.get("unit", ""),
        )
        date_check = rules.check_within_period(
            parse_date(completed.field_value) if completed else None,
            bid_due_date,
            int(condition.get("within_years", 7)),
        )
        outcomes += [value_check, date_check]
        if value_check.passed and date_check.passed:
            qualifying.append((order, completed))

    verdict.outcomes = outcomes
    verdict.verification_method = "deterministic_calculation"
    minimum = int(condition.get("min_count", 1))

    if len(qualifying) >= minimum:
        for order, completed in qualifying:
            _cite(verdict, evidence, order, completed)
        verdict.status = ComplianceStatus.COMPLIANT
        verdict.reasoning = (
            f"{len(qualifying)} qualifying work order(s) found; the tender requires "
            f"{minimum}. " + qualifying[0][0].field_value + " — " + outcomes[0].detail
        )
        verdict.confidence = qualifying[0][0].confidence
        return verdict

    for order in orders:
        _cite(verdict, evidence, order)
    verdict.status = ComplianceStatus.NON_COMPLIANT
    verdict.reasoning = (
        f"{len(qualifying)} of the {len(orders)} submitted work order(s) meet both the "
        f"value and the recency condition; the tender requires {minimum}. "
        + " ".join(o.detail for o in outcomes[:2])
    )
    return verdict


def _validity(verdict, requirement, evidence, bid_due_date, routing) -> Verdict:
    """Every certificate in scope, checked against the bid due date."""
    checked: list[tuple] = []
    for segment in routing.segments:
        valid_until = evidence.field(segment, "valid_until")
        if valid_until is None:
            continue
        checked.append(
            (
                segment,
                valid_until,
                rules.check_not_expired(parse_date(valid_until.field_value), bid_due_date),
            )
        )

    if not checked:
        return _needs_review(
            verdict,
            "No validity date could be read from the documents in scope for this "
            "requirement. Please check the certificates by eye.",
        )

    verdict.outcomes = [o for _, _, o in checked]
    verdict.verification_method = "deterministic_date"
    expired = [(s, f, o) for s, f, o in checked if not o.passed]

    for _, valid_until, _ in checked:
        _cite(verdict, evidence, valid_until)

    if expired:
        verdict.status = ComplianceStatus.EXPIRED
        verdict.reasoning = "; ".join(
            f"{humanise_doc_type(s.doc_type)}: {o.detail}" for s, _, o in expired
        )
        return verdict

    soonest = min(checked, key=lambda c: c[2].working["days_remaining_at_due_date"])
    verdict.status = ComplianceStatus.COMPLIANT
    verdict.reasoning = (
        f"All {len(checked)} certificate(s) in scope are valid at the bid due date. "
        f"Earliest expiry: {humanise_doc_type(soonest[0].doc_type)} — {soonest[2].detail}"
    )
    verdict.confidence = min(f.confidence for _, f, _ in checked)
    return verdict


def _numeric(verdict, requirement, evidence, condition) -> Verdict:
    """A plain threshold on a single extracted number."""
    target = condition["field"]
    found = evidence.first(target, requirement.accepts_document_types)
    if found is None:
        return _needs_review(
            verdict,
            f"A document of an accepted type was submitted, but '{target.replace('_', ' ')}' "
            f"could not be read from it. Please read the value from the document.",
        )
    outcome = rules.compare_threshold(
        rules.parse_amount(found.field_value),
        condition["operator"],
        condition["threshold"],
        condition.get("unit", ""),
    )
    _cite(verdict, evidence, found)
    verdict.outcomes = [outcome]
    verdict.verification_method = "deterministic_calculation"
    verdict.status = _pass_or_fail(outcome, found)
    verdict.reasoning = outcome.detail
    verdict.confidence = found.confidence
    return verdict


def _presence(verdict, requirement, evidence, routing, provider) -> Verdict:
    """No machine-checkable condition: the document exists, but does it satisfy?

    A requirement whose wording is inherently prose is the only place §7.4 lets
    a model form an opinion — and even then the answer is advisory, so the
    verdict is NEEDS_HUMAN_REVIEW rather than the model's own word.
    """
    segment = routing.segments[0]
    present = evidence.fields(segment)
    for f in present[:4]:
        _cite(verdict, evidence, f)

    if not present:
        return _needs_review(
            verdict,
            f"{with_article(humanise_doc_type(segment.doc_type)).capitalize()} was submitted "
            f"but nothing could be read from it. Please review the document.",
        )

    is_prose = requirement.category == "technical"
    if is_prose:
        # Quote the most informative prose value for the officer, then ask the
        # model to analyze it against the requirement (§7.4). The verdict is
        # always NEEDS_HUMAN_REVIEW — the model's analysis is advisory only.
        quoted = max(present, key=lambda f: len(f.field_value or ""))
        _cite(verdict, evidence, quoted)

        # Attempt semantic judgement via judge(). Failure is graceful: we fall
        # back to the raw quote so the officer still has something to read.
        try:
            evidence_dicts = [
                {"field_name": f.field_name, "value": f.field_value, "page": f.page}
                for f in present[:6]
            ]
            judgment = provider.judge(
                requirement=f"{requirement.name}: {requirement.normalized_clause or requirement.raw_clause or ''}",
                evidence=evidence_dicts,
            )
            verdict.status = ComplianceStatus.NEEDS_HUMAN_REVIEW
            verdict.verification_method = "semantic_judgement"
            verdict.confidence = judgment.confidence
            verdict.reasoning = (
                f"[AI analysis — advisory only] {judgment.reasoning} "
                f"The {humanise_doc_type(segment.doc_type)} states: "
                f"\"{' '.join((quoted.field_value or '').split())[:200]}\"."
            )
        except Exception:  # noqa: BLE001 — a failed judgement degrades to quote
            verdict.status = ComplianceStatus.NEEDS_HUMAN_REVIEW
            verdict.verification_method = "semantic_judgement"
            verdict.reasoning = (
                f"This requirement is worded as a judgement rather than a measurement, so it "
                f"is referred to you by policy. The {humanise_doc_type(segment.doc_type)} states "
                f"under '{quoted.field_name.replace('_', ' ')}': "
                f"\"{' '.join((quoted.field_value or '').split())[:200]}\"."
            )
            verdict.confidence = quoted.confidence
        return verdict


    verdict.status = ComplianceStatus.COMPLIANT
    verdict.verification_method = "document_presence"
    verdict.reasoning = (
        f"{with_article(humanise_doc_type(segment.doc_type)).capitalize()} was submitted and "
        f"{len(present)} field(s) were read from it."
    )
    verdict.confidence = min(f.confidence for f in present)
    if _unlocated(*present[:4]):
        return _needs_review(
            verdict,
            verdict.reasoning + " The values could not be pinpointed on the page, "
            "so please confirm them against the document.",
        )
    return verdict


def _pass_or_fail(outcome: rules.RuleOutcome, *cited) -> ComplianceStatus:
    if not outcome.passed:
        return ComplianceStatus.NON_COMPLIANT
    if _unlocated(*cited):
        return ComplianceStatus.NEEDS_HUMAN_REVIEW
    return ComplianceStatus.COMPLIANT


def _needs_review(verdict: Verdict, reason: str, outcomes=None) -> Verdict:
    """§21: an accepted document exists but a required field could not be read."""
    verdict.status = ComplianceStatus.NEEDS_HUMAN_REVIEW
    verdict.reasoning = reason
    if outcomes:
        verdict.outcomes = outcomes
    verdict.verification_method = verdict.verification_method or "routing"
    return verdict


# ─────────────────────────────────────────────────────────────────────────────
# External verification (layer 6)
# ─────────────────────────────────────────────────────────────────────────────
def run_external_check(
    requirement: Requirement, evidence: BidEvidence, bidder
) -> VerificationResult | None:
    """Look the bidder up on the portal this requirement names, if any."""
    portal = portal_for(requirement)
    if not portal:
        return None

    identifier = {
        "gstn": bidder.gstin,
        "pan": bidder.pan,
        "udyam": (evidence.first("udyam_urn") or _Empty()).field_value,
        "mca21": (evidence.first("cin") or _Empty()).field_value,
        "blacklist": bidder.pan,
        # DigiLocker is keyed by the PAN the account is built around; DPIIT's
        # Startup India recognition and NSIC registration sit alongside the
        # same enterprise the Udyam certificate names.
        "digilocker": bidder.pan,
        "dpiit": (evidence.first("udyam_urn") or _Empty()).field_value,
        "nsic": (evidence.first("udyam_urn") or _Empty()).field_value,
    }.get(portal)

    if not identifier:
        return None
    return get_adapter(portal).verify(str(identifier), {})


class _Empty:
    field_value = None


def apply_external(verdict: Verdict, result: VerificationResult | None) -> Verdict:
    """Fold a portal answer into the verdict.

    ``unavailable`` becomes UNVERIFIED, never NON_COMPLIANT: a portal being down
    must never cost a bidder their tender (CLAUDE.md §8).
    """
    if result is None:
        return verdict
    verdict.external = result

    if result.status == "unavailable":
        verdict.status = ComplianceStatus.UNVERIFIED
        verdict.reasoning += (
            f" The {result.portal_id} check could not be run, so no claim is made about it."
        )
        return verdict

    if result.status == "found" and verdict.status is ComplianceStatus.COMPLIANT:
        verdict.reasoning += (
            f" The {result.portal_id} adapter returned a matching record "
            f"(source: {result.source})."
        )
        verdict.reasoning += _external_facts(result)
    elif result.status == "not_found":
        if verdict.requirement_id and verdict.status is ComplianceStatus.COMPLIANT:
            # For a debarment register, absence is the good outcome.
            verdict.reasoning += (
                f" The {result.portal_id} adapter returned no record for this identifier "
                f"(source: {result.source})."
            )
    return verdict


def _external_facts(result: VerificationResult) -> str:
    """Extra statutorily-significant facts carried in the adapter's data.

    GST registration on the register is one thing; whether returns were filed
    is another, and the mock dataset answers both — so the reasoning says both,
    each time attributed to its source. The same applies to the PAN's income
    tax filing status.
    """
    if result.portal_id == "gstn":
        through = (result.data or {}).get("returns_filed_through")
        if through:
            return (
                f" The register reports returns filed through {through} "
                f"(source: {result.source})."
            )
    if result.portal_id == "pan":
        itr = (result.data or {}).get("itr_status")
        if itr:
            return (
                f" The PAN check reports income-tax filing status: {itr} "
                f"(source: {result.source})."
            )
    return ""
