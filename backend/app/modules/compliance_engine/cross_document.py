"""Layer 5: do the bidder's own documents agree with each other?

Fully deterministic (CLAUDE.md §4). Findings are raised, never resolved — a
fuzzy name match produces something for an officer to look at, and is never
silently absorbed into a pass (§9, §13).

Comparisons run **within** each member's own documents. Two companies in a
consortium legitimately have different names and PANs, and checking across them
would flag every consortium as fraudulent (§20).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.db.enums import Severity
from app.modules.compliance_engine import rules
from app.modules.compliance_engine.evidence_index import BidEvidence, humanise_doc_type


@dataclass
class Finding:
    finding_type: str
    severity: Severity
    description: str
    field_name: str | None = None
    value_a: str | None = None
    value_b: str | None = None
    segment_a_id: uuid.UUID | None = None
    segment_b_id: uuid.UUID | None = None
    similarity_score: float | None = None
    normalization_steps: dict | None = field(default=None)


# Findings that are genuine contradictions *within the bidder's own papers*.
# Everything outside this set is context for the officer rather than evidence
# that the submission disagrees with itself — a holding company's certificate
# names a different company because it is a different company.
CONTRADICTION_TYPES = frozenset(
    {
        "pan_mismatch",
        "gstin_mismatch",
        "udyam_urn_mismatch",
        "cin_mismatch",
        "gstin_pan_mismatch",
        "legal_name_mismatch",
        "legal_name_variance",
        "pan_holder_type_mismatch",
        "cin_inconsistent",
    }
)

# Identifiers are compared exactly. Never fuzzy-match an ID (CLAUDE.md §7).
EXACT_FIELDS = ("pan", "gstin", "udyam_urn", "cin")
# Names are compared after normalisation, with the steps shown.
NAME_FIELDS = ("legal_name", "enterprise_name")


def run(evidence: BidEvidence, bidder) -> list[Finding]:
    """Compare the bidder's documents against each other.

    Documents belonging to a *different* legal entity are set aside first. A
    holding company's turnover certificate correctly carries the holding
    company's name and PAN; comparing those against the bidder's own and
    calling the difference a contradiction would report an ordinary
    parent-subsidiary arrangement as fraud.

    This is the same rule §20 states for consortium members — consistency is
    checked within each member's own documents, because "getting this backwards
    would flag every consortium as fraudulent". A parent company is the same
    situation with one member.
    """
    bidder_name = getattr(bidder, "legal_name", None)
    own, variances, foreign = _partition_by_entity(evidence, bidder_name)

    findings: list[Finding] = []
    findings += _foreign_entity_notices(foreign, bidder_name)
    findings += _variance_notices(variances, bidder_name)
    findings += _identifier_agreement(own)
    findings += _name_agreement(own)
    findings += _gstin_pan_embedding(own)
    findings += _pan_holder_type(own)
    findings += _cin_year(own)
    findings += _duplicate_documents(own)
    return _deduplicate(findings)


def _partition_by_entity(
    evidence: BidEvidence, bidder_name: str | None
) -> tuple[BidEvidence, list[tuple], list[tuple]]:
    """Split the bundle three ways, as §9 classifies a name comparison.

    * **the same entity** — identical after normalisation, or close enough.
    * **a variance** — close but not identical. This is the bidder's own
      document with inconsistent paperwork, so its values are still compared;
      the difference is raised for a human rather than resolved either way.
    * **a different entity** — not close. Its values are set aside, because a
      different company's name and tax numbers are not a contradiction.

    Collapsing the middle case into either neighbour is the mistake §9 warns
    against: treat it as the same and a substituted identity slips through;
    treat it as different and every clerical variation reads as fraud.
    """
    if not bidder_name:
        return evidence, [], []

    own_segments, variances, foreign = [], [], []
    for segment in evidence.segments:
        named = None
        for field_name in ("legal_name", "enterprise_name"):
            candidate = evidence.field(segment, field_name)
            if candidate and candidate.field_value:
                named = candidate
                break
        if named is None:
            own_segments.append(segment)
            continue

        outcome = rules.compare_legal_names(named.field_value, bidder_name)
        if outcome.passed:
            own_segments.append(segment)
        elif outcome.working.get("needs_human"):
            own_segments.append(segment)  # still the bidder's own document
            variances.append((segment, named, outcome))
        else:
            foreign.append((segment, named, outcome))

    own = BidEvidence(
        segments=own_segments,
        fields_by_segment={s.id: evidence.fields_by_segment.get(s.id, []) for s in own_segments},
    )
    return own, variances, foreign


def _variance_notices(variances: list[tuple], bidder_name: str | None) -> list[Finding]:
    """A name close to the bidder's own, but not the same.

    Raised, never resolved. The system does not decide whether this is one
    company's inconsistent paperwork or two companies (§9).
    """
    out: list[Finding] = []
    for segment, named, outcome in variances:
        out.append(
            Finding(
                finding_type="legal_name_variance",
                severity=Severity.HIGH,
                description=(
                    f"The {humanise_doc_type(segment.doc_type)} names "
                    f"'{named.field_value}', while the bidder is registered as "
                    f"'{bidder_name}'. {outcome.detail}"
                ),
                field_name="legal_name",
                value_a=named.field_value,
                value_b=bidder_name,
                segment_a_id=segment.id,
                similarity_score=outcome.working.get("similarity"),
                normalization_steps=outcome.working,
            )
        )
    return out


def _foreign_entity_notices(foreign: list[tuple], bidder_name: str | None) -> list[Finding]:
    """One notice per outside entity whose documents are in the bundle.

    Deliberately not CRITICAL. Relying on a parent's standing is permitted by
    real tenders subject to an undertaking and a board resolution, so this is
    something the officer must weigh, not evidence of misrepresentation.
    """
    by_entity: dict[str, tuple] = {}
    for segment, named, outcome in foreign:
        by_entity.setdefault(named.field_value, (segment, outcome, []))[2].append(segment.doc_type)

    out: list[Finding] = []
    for entity, (segment, outcome, doc_types) in by_entity.items():
        documents = ", ".join(humanise_doc_type(t) for t in sorted(set(doc_types)))
        out.append(
            Finding(
                finding_type="evidence_from_another_entity",
                severity=Severity.HIGH,
                description=(
                    f"The {documents} in this bundle is issued to '{entity}', not to the "
                    f"bidding entity '{bidder_name}'. Its contents were not compared against "
                    f"the bidder's own documents, because a different company's name and tax "
                    f"numbers are not a contradiction. Whether this entity's standing may be "
                    f"relied on is a decision for you."
                ),
                field_name="legal_name",
                value_a=entity,
                value_b=bidder_name,
                segment_a_id=segment.id,
                similarity_score=outcome.working.get("similarity"),
                normalization_steps=outcome.working,
            )
        )
    return out


def _deduplicate(findings: list[Finding]) -> list[Finding]:
    """One finding per distinct problem.

    The same difference between two values surfaces once per document the value
    appears in — nine times, for one name. The officer needs the problem, not
    the tally.
    """
    seen: dict[tuple, Finding] = {}
    for finding in findings:
        # The pair is unordered: "A differs from B" and "B differs from A" are
        # one problem reported twice, and an officer should see it once.
        key = (
            finding.finding_type,
            finding.field_name,
            frozenset({finding.value_a, finding.value_b}),
        )
        seen.setdefault(key, finding)
    return list(seen.values())


def _identifier_agreement(evidence: BidEvidence) -> list[Finding]:
    """The same identifier, wherever it appears, must be identical."""
    out: list[Finding] = []
    for name in EXACT_FIELDS:
        occurrences = evidence.find(name)
        if len(occurrences) < 2:
            continue
        first = occurrences[0]
        for other in occurrences[1:]:
            outcome = rules.check_exact_identifier(first.field_value, other.field_value, name)
            if outcome.passed:
                continue
            out.append(
                Finding(
                    finding_type=f"{name}_mismatch",
                    severity=Severity.CRITICAL,
                    description=outcome.detail,
                    field_name=name,
                    value_a=first.field_value,
                    value_b=other.field_value,
                    segment_a_id=first.document_segment_id,
                    segment_b_id=other.document_segment_id,
                )
            )
    return out


def _name_agreement(evidence: BidEvidence) -> list[Finding]:
    """Legal names across documents, compared with the working shown."""
    occurrences = [f for name in NAME_FIELDS for f in evidence.find(name)]
    if len(occurrences) < 2:
        return []

    out: list[Finding] = []
    anchor = occurrences[0]
    for other in occurrences[1:]:
        outcome = rules.compare_legal_names(anchor.field_value, other.field_value)
        if outcome.passed and outcome.working.get("similarity") == 1.0:
            continue
        needs_human = outcome.working.get("needs_human", False)
        out.append(
            Finding(
                finding_type="legal_name_variance" if needs_human else "legal_name_mismatch",
                severity=Severity.HIGH if needs_human else Severity.CRITICAL,
                description=outcome.detail,
                field_name="legal_name",
                value_a=anchor.field_value,
                value_b=other.field_value,
                segment_a_id=anchor.document_segment_id,
                segment_b_id=other.document_segment_id,
                similarity_score=outcome.working.get("similarity"),
                normalization_steps=outcome.working,
            )
        )
    return out


def _gstin_pan_embedding(evidence: BidEvidence) -> list[Finding]:
    """The highest-value structural check in the system (CLAUDE.md §9)."""
    gstin = evidence.first("gstin")
    pan = evidence.first("pan")
    if gstin is None or pan is None:
        return []
    outcome = rules.check_gstin_contains_pan(gstin.field_value, pan.field_value)
    if outcome.passed:
        return []
    return [
        Finding(
            finding_type="gstin_pan_mismatch",
            severity=Severity.CRITICAL,
            description=outcome.detail,
            field_name="gstin",
            value_a=gstin.field_value,
            value_b=pan.field_value,
            segment_a_id=gstin.document_segment_id,
            segment_b_id=pan.document_segment_id,
            normalization_steps=outcome.working,
        )
    ]


def _pan_holder_type(evidence: BidEvidence) -> list[Finding]:
    pan = evidence.first("pan")
    if pan is None:
        return []
    outcome = rules.check_pan_holder_type(pan.field_value, "company")
    if outcome.passed:
        return []
    return [
        Finding(
            finding_type="pan_holder_type_mismatch",
            severity=Severity.HIGH,
            description=outcome.detail,
            field_name="pan",
            value_a=pan.field_value,
            segment_a_id=pan.document_segment_id,
            normalization_steps=outcome.working,
        )
    ]


def _cin_year(evidence: BidEvidence) -> list[Finding]:
    from app.modules.compliance_engine.evidence_index import parse_date

    cin = evidence.first("cin")
    incorporated = evidence.first("incorporation_date")
    if cin is None:
        return []
    outcome = rules.check_cin_structure(
        cin.field_value, parse_date(incorporated.field_value) if incorporated else None
    )
    if outcome.passed:
        return []
    return [
        Finding(
            finding_type="cin_inconsistent",
            severity=Severity.HIGH,
            description=outcome.detail,
            field_name="cin",
            value_a=cin.field_value,
            value_b=incorporated.field_value if incorporated else None,
            segment_a_id=cin.document_segment_id,
        )
    ]


def _duplicate_documents(evidence: BidEvidence) -> list[Finding]:
    """Two segments of the same type disagreeing is itself a finding (§21)."""
    by_type: dict[str, list] = {}
    for segment in evidence.segments:
        by_type.setdefault(segment.doc_type, []).append(segment)

    out: list[Finding] = []
    for doc_type, segments in by_type.items():
        if len(segments) < 2 or doc_type == "unclassified":
            continue
        out.append(
            Finding(
                finding_type="duplicate_document_type",
                severity=Severity.INFO,
                description=(
                    f"{len(segments)} separate {humanise_doc_type(doc_type)} documents were "
                    f"submitted. All were evaluated; any disagreement between them appears "
                    f"as its own finding."
                ),
                field_name=None,
                segment_a_id=segments[0].id,
                segment_b_id=segments[1].id,
            )
        )
    return out
