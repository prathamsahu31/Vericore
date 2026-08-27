"""Layer 2: what kind of document is this, and where does it start and end.

CLAUDE.md §19. The officer chooses the ingestion mode; it is never inferred.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from app.db.enums import BoundaryMethod, IngestionMode
from app.llm.types import DocumentInput
from app.modules.document_intelligence.pdf_reader import PdfDocument, build_provider_text

# Below this a segment is flagged for the review screen (§19).
CONFIDENCE_FLOOR = 0.6


@dataclass(frozen=True)
class SegmentDraft:
    """A logical document found inside one uploaded file."""

    segment_index: int
    doc_type: str
    page_start: int
    page_end: int
    boundary_method: BoundaryMethod
    boundary_confidence: float | None
    classification_confidence: float | None
    needs_review: bool


def segment_document(
    pdf: PdfDocument,
    mode: IngestionMode,
    provider,
    declared_doc_type: str | None = None,
) -> list[SegmentDraft]:
    """Split an upload into the logical documents inside it.

    ``separate``      one segment spanning all pages, typed by the officer.
    ``auto_classify`` one segment spanning all pages, typed by the classifier.
    ``merged``        not yet built. Falls back to a single unclassified
                      segment flagged for review, per §19's stated fallback.
                      Segmentation proper is a Day 4–5 item (§23).
    """
    last_page = pdf.page_count or 1

    if mode is IngestionMode.SEPARATE:
        doc_type = declared_doc_type or "unclassified"
        return [
            SegmentDraft(
                segment_index=0,
                doc_type=doc_type,
                page_start=1,
                page_end=last_page,
                # A single-document upload produces exactly one segment
                # spanning all pages (§6), so the rest of the pipeline has one
                # shape to handle rather than two.
                boundary_method=BoundaryMethod.WHOLE_FILE,
                boundary_confidence=1.0,
                classification_confidence=1.0 if declared_doc_type else None,
                needs_review=doc_type == "unclassified",
            )
        ]

    if mode is IngestionMode.AUTO_CLASSIFY:
        doc_type, confidence = classify(pdf, provider)
        return [
            SegmentDraft(
                segment_index=0,
                doc_type=doc_type,
                page_start=1,
                page_end=last_page,
                boundary_method=BoundaryMethod.WHOLE_FILE,
                boundary_confidence=1.0,
                classification_confidence=confidence,
                needs_review=confidence < CONFIDENCE_FLOOR or doc_type == "unclassified",
            )
        ]

    # merged — never fail the upload (§19).
    return [
        SegmentDraft(
            segment_index=0,
            doc_type="unclassified",
            page_start=1,
            page_end=last_page,
            boundary_method=BoundaryMethod.FALLBACK_UNSEGMENTED,
            boundary_confidence=0.0,
            classification_confidence=None,
            needs_review=True,
        )
    ]


def classify(pdf: PdfDocument, provider) -> tuple[str, float]:
    """The document's type, from the most common non-continuation page type."""
    doc_input = DocumentInput(
        text=build_provider_text(pdf.pages),
        mime_type="application/pdf",
        page_range=(1, pdf.page_count) if pdf.page_count else None,
    )
    classifications = provider.classify_pages(doc_input)
    votes = Counter(
        c.doc_type for c in classifications if c.doc_type not in ("continuation", "unclassified")
    )
    if not votes:
        return "unclassified", 0.2

    winner, count = votes.most_common(1)[0]
    scores = [c.confidence for c in classifications if c.doc_type == winner]
    agreement = count / max(len(classifications), 1)
    return winner, round(min(sum(scores) / len(scores), 0.5 + agreement / 2), 4)
