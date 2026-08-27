"""An index over one bid's extracted fields, and the routing rules of §21.

Routing is a lookup, and a lookup cannot hallucinate. The engine never scans
all evidence for every requirement, and the LLM is never asked which document
is relevant — the requirement declares what can satisfy it, and this module
answers from that declaration alone (CLAUDE.md §7.5, §21).
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.db.models import DocumentSegment, ExtractedField
from app.modules.compliance_engine.rules import parse_amount

# A requirement that binds across the whole submission rather than to one
# document type — certificate validity, name and ID consistency.
ANY_DOCUMENT_TYPE = "*"

_DATE_FORMATS = ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y-%m-%d")
_DATE_RE = re.compile(r"\d{2}[/.-]\d{2}[/.-]\d{4}|\d{4}-\d{2}-\d{2}")


def parse_date(text: str | None) -> date | None:
    """Read a date, or return None. Never a guess."""
    if not text:
        return None
    match = _DATE_RE.search(str(text))
    if not match:
        return None
    from datetime import datetime

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(match.group(0), fmt).date()
        except ValueError:
            continue
    return None


@dataclass
class BidEvidence:
    """Every segment of a bid, and the fields extracted from each."""

    segments: list[DocumentSegment] = field(default_factory=list)
    fields_by_segment: dict[uuid.UUID, list[ExtractedField]] = field(default_factory=dict)

    def segments_of_type(self, accepted: list[str]) -> list[DocumentSegment]:
        """The segments a requirement is allowed to consider.

        Only evidence from a segment whose type is accepted is ever looked at.
        If a bidder submits two GST certificates, both are returned and any
        disagreement between them surfaces as a cross-document finding (§21).
        """
        if not accepted:
            return []
        if ANY_DOCUMENT_TYPE in accepted:
            return list(self.segments)
        allowed = set(accepted)
        return [s for s in self.segments if s.doc_type in allowed]

    def fields(self, segment: DocumentSegment) -> list[ExtractedField]:
        return self.fields_by_segment.get(segment.id, [])

    def field(self, segment: DocumentSegment, name: str) -> ExtractedField | None:
        for f in self.fields(segment):
            if f.field_name == name:
                return f
        return None

    def find(self, name: str, doc_types: list[str] | None = None) -> list[ExtractedField]:
        """Every field with this name, optionally restricted to some doc types."""
        pool = self.segments_of_type(doc_types) if doc_types else self.segments
        out: list[ExtractedField] = []
        for segment in pool:
            out.extend(f for f in self.fields(segment) if f.field_name == name)
        return out

    def first(self, name: str, doc_types: list[str] | None = None) -> ExtractedField | None:
        found = self.find(name, doc_types)
        return found[0] if found else None

    def amount(self, name: str, doc_types: list[str] | None = None) -> Decimal | None:
        f = self.first(name, doc_types)
        return parse_amount(f.field_value) if f else None

    def date(self, name: str, doc_types: list[str] | None = None) -> date | None:
        f = self.first(name, doc_types)
        return parse_date(f.field_value) if f else None

    def segment_of(self, extracted: ExtractedField) -> DocumentSegment | None:
        for segment in self.segments:
            if segment.id == extracted.document_segment_id:
                return segment
        return None


@dataclass(frozen=True)
class RoutingResult:
    """What routing found, and — when it found nothing — what was missing."""

    segments: list[DocumentSegment]
    missing_document_types: list[str]

    @property
    def has_evidence(self) -> bool:
        return bool(self.segments)


def route(requirement, evidence: BidEvidence) -> RoutingResult:
    """Which segments may answer this requirement.

    When nothing matches, the missing document types are named so the officer
    reads "No OEM authorisation letter found" rather than a bare failure (§21).
    """
    accepted = list(requirement.accepts_document_types or [])
    segments = evidence.segments_of_type(accepted)
    if segments:
        return RoutingResult(segments=segments, missing_document_types=[])

    present = {s.doc_type for s in evidence.segments}
    missing = [t for t in accepted if t != ANY_DOCUMENT_TYPE and t not in present]
    return RoutingResult(segments=[], missing_document_types=missing or accepted)


def humanise_doc_type(doc_type: str) -> str:
    """``iso_certificate`` -> ``ISO certificate``. This text reaches the officer."""
    words = doc_type.replace("_", " ").split()
    return " ".join(
        w.upper() if w in ("iso", "gst", "pan", "cin", "oem", "emd") else w for w in words
    )


def with_article(phrase: str) -> str:
    """ "a work order", "an ISO certificate". Officer-facing copy, so it matters."""
    return f"{'an' if phrase[:1].lower() in 'aeiou' else 'a'} {phrase}"
