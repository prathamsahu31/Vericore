"""Request and response models. Routers validate and delegate (CLAUDE.md §13)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import IngestionMode, LocatorStatus


class BidderCreate(BaseModel):
    legal_name: str = Field(min_length=1, max_length=300)
    pan: str | None = Field(default=None, max_length=10)
    gstin: str | None = Field(default=None, max_length=15)
    udyam_urn: str | None = Field(default=None, max_length=25)
    cin: str | None = Field(default=None, max_length=21)


class BidderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    legal_name: str
    pan: str | None
    gstin: str | None
    udyam_urn: str | None
    cin: str | None


class BidCreate(BaseModel):
    tender_id: uuid.UUID
    bidder_id: uuid.UUID


class BidOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tender_id: uuid.UUID
    created_at: datetime


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    segment_index: int
    doc_type: str
    page_start: int
    page_end: int
    boundary_method: str
    boundary_confidence: float | None
    classification_confidence: float | None
    needs_review: bool


class ExtractedFieldOut(BaseModel):
    """One citable fact, with the geometry that makes it citable."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_segment_id: uuid.UUID
    field_name: str
    field_value: str | None
    source_span: str | None
    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    locator_status: LocatorStatus
    locator_score: float | None
    bbox_rects: list | None
    confidence: float
    extraction_method: str
    llm_provider: str | None
    llm_model_id: str | None

    @property
    def is_located(self) -> bool:
        return self.locator_status not in (
            LocatorStatus.PAGE_FALLBACK,
            LocatorStatus.SEGMENT_FALLBACK,
        )


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bid_id: uuid.UUID | None
    original_filename: str
    sha256: str
    mime_type: str
    size_bytes: int
    page_count: int | None
    ingestion_mode: IngestionMode
    uploaded_at: datetime


class UploadResult(BaseModel):
    """What the officer sees after an upload."""

    document: DocumentOut
    segments: list[SegmentOut]
    extracted_fields: list[ExtractedFieldOut]
    fields_located: int
    fields_unlocated: int
    # Text shaped like an instruction was present in the document. Reported,
    # never followed (CLAUDE.md §17).
    injection_suspected: bool
    # Other uploads on this bid with byte-identical content (§9).
    duplicate_of: list[uuid.UUID] = Field(default_factory=list)
    extraction_error: str | None = None
