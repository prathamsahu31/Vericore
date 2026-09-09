"""Bidder, bid and document routes.

Routers validate and delegate. No business logic here (CLAUDE.md §13).
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import extraction_provider
from app.api.schemas import (
    BidCreate,
    BidderCreate,
    BidderOut,
    BidOut,
    DocumentOut,
    ExtractedFieldOut,
    SegmentOut,
    UploadResult,
)
from app.db.enums import IngestionMode, LocatorStatus
from app.db.models import Document, DocumentSegment, ExtractedField
from app.db.session import get_db
from app.errors import NotFoundError
from app.modules.bid_service import service as bids
from app.modules.document_intelligence.pdf_reader import read_pdf
from app.modules.evidence_extraction.service import extract_document

router = APIRouter(tags=["bids"])

DbSession = Annotated[Session, Depends(get_db)]
Provider = Annotated[Any, Depends(extraction_provider)]


@router.post("/bidders", response_model=BidderOut, status_code=201)
def create_bidder(payload: BidderCreate, db: DbSession) -> BidderOut:
    bidder = bids.create_bidder(db, **payload.model_dump())
    db.commit()
    return BidderOut.model_validate(bidder)


@router.get("/bidders", response_model=list[BidderOut])
def list_bidders(db: DbSession) -> list[BidderOut]:
    from app.db.models import Bidder

    rows = db.execute(select(Bidder).order_by(Bidder.legal_name)).scalars().all()
    return [BidderOut.model_validate(r) for r in rows]


@router.post("/bids", response_model=BidOut, status_code=201)
def create_bid(payload: BidCreate, db: DbSession) -> BidOut:
    bid = bids.create_bid(db, tender_id=payload.tender_id, bidder_id=payload.bidder_id)
    db.commit()
    return BidOut.model_validate(bid)


@router.post("/bids/{bid_id}/documents", response_model=UploadResult, status_code=201)
def upload_document(
    bid_id: uuid.UUID,
    db: DbSession,
    provider: Provider,
    file: Annotated[UploadFile, File()],
    # The officer chooses the mode; it is never inferred (CLAUDE.md §19).
    ingestion_mode: Annotated[IngestionMode, Form()] = IngestionMode.AUTO_CLASSIFY,
    doc_type: Annotated[str | None, Form()] = None,
) -> UploadResult:
    """Store a document, split it into segments, and extract its fields.

    Extraction runs inline: documents are small and the provider is called
    sequentially by design (§7.7). When live-provider latency makes that
    uncomfortable it moves to BackgroundTasks with progress on
    ``verification_runs`` (§3) — the service function is already separate.
    """
    content = file.file.read()
    document, segments = bids.upload_document(
        db,
        bid_id=bid_id,
        content=content,
        filename=file.filename or "upload",
        mime_type=file.content_type or "application/octet-stream",
        ingestion_mode=ingestion_mode,
        declared_doc_type=doc_type,
        provider=provider,
    )

    pdf = read_pdf(document.storage_path)
    outcome = extract_document(db, document, pdf, provider)

    duplicates = [
        d.id for d in bids.duplicate_uploads(db, bid_id, document.sha256) if d.id != document.id
    ]
    db.commit()

    fields = [ExtractedFieldOut.model_validate(f) for f in outcome.stored]
    unlocated = sum(
        1
        for f in fields
        if f.locator_status in (LocatorStatus.PAGE_FALLBACK, LocatorStatus.SEGMENT_FALLBACK)
    )
    return UploadResult(
        document=DocumentOut.model_validate(document),
        segments=[SegmentOut.model_validate(s) for s in segments],
        extracted_fields=fields,
        fields_located=len(fields) - unlocated,
        fields_unlocated=unlocated,
        injection_suspected=outcome.injection_suspected,
        duplicate_of=duplicates,
        extraction_error=outcome.failed_reason,
    )


@router.get("/bids/{bid_id}/documents", response_model=list[DocumentOut])
def list_documents(bid_id: uuid.UUID, db: DbSession) -> list[DocumentOut]:
    rows = (
        db.execute(select(Document).where(Document.bid_id == bid_id).order_by(Document.uploaded_at))
        .scalars()
        .all()
    )
    return [DocumentOut.model_validate(r) for r in rows]


@router.get("/documents/{document_id}/fields", response_model=list[ExtractedFieldOut])
def list_fields(document_id: uuid.UUID, db: DbSession) -> list[ExtractedFieldOut]:
    """Every field extracted from a document, with its page geometry."""
    if db.get(Document, document_id) is None:
        raise NotFoundError(f"Document {document_id} not found")
    rows = (
        db.execute(
            select(ExtractedField)
            .join(DocumentSegment, DocumentSegment.id == ExtractedField.document_segment_id)
            .where(DocumentSegment.document_id == document_id)
            .order_by(ExtractedField.page, ExtractedField.y0, ExtractedField.x0)
        )
        .scalars()
        .all()
    )
    return [ExtractedFieldOut.model_validate(r) for r in rows]


@router.get("/documents/{document_id}/file")
def get_document_file(document_id: uuid.UUID, db: DbSession):
    """Serve the original PDF so the officer can verify a citation in one click (CLAUDE.md §11)."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise NotFoundError(f"Document {document_id} not found")
    path = Path(doc.storage_path)
    if not path.exists():
        raise NotFoundError(f"File for document {document_id} not found on disk")
    return FileResponse(str(path), media_type=doc.mime_type or "application/pdf", filename=doc.original_filename)
