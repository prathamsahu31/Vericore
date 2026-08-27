"""Layer 3: turn a document segment into stored, citable fields.

The shape of this module is the point. The model reads; the locator places;
the database stores. No step trusts the one before it to have done the other's
job — which is why the model is never asked for coordinates and the locator is
never asked what a value means.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.db.enums import LocatorStatus
from app.db.models import Document, DocumentSegment, ExtractedField
from app.llm.base import LLMError
from app.llm.schemas import schema_for
from app.llm.types import DocumentInput, LLMRole
from app.modules.document_intelligence.pdf_reader import PdfDocument, build_provider_text
from app.modules.evidence_extraction.locator import locate

log = logging.getLogger(__name__)


class ExtractionOutcome:
    """What one segment's extraction produced, for the caller to report."""

    def __init__(self) -> None:
        self.stored: list[ExtractedField] = []
        self.injection_suspected = False
        self.failed_reason: str | None = None

    @property
    def located_count(self) -> int:
        return sum(
            1
            for f in self.stored
            if f.locator_status not in (LocatorStatus.PAGE_FALLBACK, LocatorStatus.SEGMENT_FALLBACK)
        )


def extract_segment(
    db: Session,
    segment: DocumentSegment,
    pdf: PdfDocument,
    provider,
) -> ExtractionOutcome:
    """Read one segment and write its fields, each with a real page box."""
    outcome = ExtractionOutcome()
    schema = schema_for(segment.doc_type)
    if not schema:
        log.info("no extraction schema for doc_type=%s segment=%s", segment.doc_type, segment.id)
        return outcome

    pages = [p for p in pdf.pages if segment.page_start <= p.number <= segment.page_end]

    doc_input = DocumentInput(
        text=build_provider_text(pdf.pages, (segment.page_start, segment.page_end)),
        file_bytes=None,
        mime_type="application/pdf",
        page_range=(segment.page_start, segment.page_end),
    )

    try:
        result = provider.extract_evidence(doc_input, schema, segment.doc_type)
    except LLMError as exc:
        # Never crash the pipeline. The requirement this segment would have
        # answered resolves to NEEDS_HUMAN_REVIEW downstream (§7.6).
        log.warning("extraction failed segment=%s: %s", segment.id, exc)
        outcome.failed_reason = str(exc)
        return outcome

    outcome.injection_suspected = result.injection_suspected
    if result.injection_suspected:
        # Reported, never followed (§17). Surfaced to the officer as a finding.
        log.warning("instruction-like text present in segment=%s", segment.id)

    provenance = result.provenance

    for field in result.fields:
        box = locate(
            span=field.source_span,
            pages=pages,
            cited_page=field.page,
            segment_first_page=segment.page_start,
        )
        row = ExtractedField(
            document_segment_id=segment.id,
            field_name=field.field_name,
            field_value=field.value,
            value_normalized=field.value.strip().casefold() or None,
            page=box.page,
            x0=box.x0,
            y0=box.y0,
            x1=box.x1,
            y1=box.y1,
            locator_status=box.status,
            locator_score=box.score,
            bbox_rects=list(box.rects) if box.rects else None,
            confidence=field.confidence,
            extraction_method="llm_span_located",
            source_span=field.source_span,
            llm_provider=provenance.provider if provenance else None,
            llm_model_id=provenance.model_id if provenance else None,
            llm_role=provenance.role if provenance else str(LLMRole.EXTRACTION),
        )
        db.add(row)
        outcome.stored.append(row)

    db.flush()
    log.info(
        "extracted segment=%s doc_type=%s fields=%d located=%d",
        segment.id,
        segment.doc_type,
        len(outcome.stored),
        outcome.located_count,
    )
    return outcome


def extract_document(
    db: Session, document: Document, pdf: PdfDocument, provider
) -> ExtractionOutcome:
    """Every segment of one uploaded file, processed sequentially.

    Sequential by design, not by accident: the free tier caps requests per
    minute, and nobody is timing the demo (CLAUDE.md §7.7).
    """
    combined = ExtractionOutcome()
    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.document_id == document.id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    for segment in segments:
        outcome = extract_segment(db, segment, pdf, provider)
        combined.stored.extend(outcome.stored)
        combined.injection_suspected |= outcome.injection_suspected
        combined.failed_reason = combined.failed_reason or outcome.failed_reason
    return combined
