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


# Identifiers are compared exactly. Never fuzzy-match an ID (CLAUDE.md §7).
EXACT_FIELDS = ("pan", "gstin", "udyam_urn", "cin")
# Names are compared after normalisation, with the steps shown.
NAME_FIELDS = ("legal_name", "enterprise_name")


def run(evidence: BidEvidence, bidder) -> list[Finding]:
    findings: list[Finding] = []
    findings += _identifier_agreement(evidence)
    findings += _name_agreement(evidence)
    findings += _gstin_pan_embedding(evidence)
    findings += _pan_holder_type(evidence)
    findings += _cin_year(evidence)
    findings += _duplicate_documents(evidence)
    return findings


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
