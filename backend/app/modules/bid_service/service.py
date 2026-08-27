"""Bidders, bids, and the documents attached to them.

A bid always has at least one ``bid_members`` row. A sole bid has exactly one,
with role ``sole`` — so consortium evaluation on Day 4 adds rows rather than
changing shape (CLAUDE.md §20).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.enums import BidMemberRole, IngestionMode
from app.db.models import Bid, Bidder, BidMember, Document, DocumentSegment, Tender
from app.errors import ConflictError, NotFoundError, ValidationError
from app.modules.document_intelligence.pdf_reader import read_pdf
from app.modules.document_intelligence.service import segment_document
from app.storage import store


def _require(db: Session, model, ident: uuid.UUID, label: str):
    obj = db.get(model, ident)
    if obj is None:
        raise NotFoundError(f"{label} {ident} not found")
    return obj


def create_bidder(
    db: Session,
    *,
    legal_name: str,
    pan: str | None = None,
    gstin: str | None = None,
    udyam_urn: str | None = None,
    cin: str | None = None,
) -> Bidder:
    """Create a bidder, or return the existing one with the same PAN.

    Bidders are deduplicated across tenders by PAN so history accumulates
    (CLAUDE.md §6) — the same company bidding on a second tender is the same
    row, not a new one.
    """
    if pan:
        existing = db.execute(select(Bidder).where(Bidder.pan == pan)).scalar_one_or_none()
        if existing is not None:
            return existing

    bidder = Bidder(
        legal_name=legal_name,
        normalized_name=legal_name.strip().casefold() or None,
        pan=pan,
        gstin=gstin,
        udyam_urn=udyam_urn,
        cin=cin,
    )
    db.add(bidder)
    db.flush()
    return bidder


def create_bid(db: Session, *, tender_id: uuid.UUID, bidder_id: uuid.UUID) -> Bid:
    """A sole bid: one bid, one member, role ``sole``."""
    _require(db, Tender, tender_id, "Tender")
    _require(db, Bidder, bidder_id, "Bidder")

    duplicate = db.execute(
        select(Bid)
        .join(BidMember, BidMember.bid_id == Bid.id)
        .where(Bid.tender_id == tender_id, BidMember.bidder_id == bidder_id)
    ).scalar_one_or_none()
    if duplicate is not None:
        raise ConflictError(
            "This bidder already has a bid on this tender.",
            detail={"bid_id": str(duplicate.id)},
        )

    bid = Bid(tender_id=tender_id)
    db.add(bid)
    db.flush()
    db.add(BidMember(bid_id=bid.id, bidder_id=bidder_id, role=BidMemberRole.SOLE, member_order=1))
    db.flush()
    return bid


def upload_document(
    db: Session,
    *,
    bid_id: uuid.UUID,
    content: bytes,
    filename: str,
    mime_type: str,
    ingestion_mode: IngestionMode,
    declared_doc_type: str | None,
    provider,
) -> tuple[Document, list[DocumentSegment]]:
    """Store an upload, then split it into its logical documents.

    Returns the file and its segments. Extraction is a separate step so that a
    segmentation review can sit between them when merged bundles arrive (§19).
    """
    bid = _require(db, Bid, bid_id, "Bid")

    if ingestion_mode is IngestionMode.SEPARATE and not declared_doc_type:
        raise ValidationError(
            "Ingestion mode 'separate' means the officer labels the document; "
            "supply doc_type, or use 'auto_classify' to have it classified.",
        )

    stored = store(content, filename, mime_type)
    pdf = read_pdf(stored.path)

    member = (
        db.execute(
            select(BidMember).where(BidMember.bid_id == bid.id).order_by(BidMember.member_order)
        )
        .scalars()
        .first()
    )

    document = Document(
        bid_id=bid.id,
        bid_member_id=member.id if member else None,
        original_filename=filename,
        storage_path=str(stored.path),
        sha256=stored.sha256,
        mime_type=stored.mime_type,
        size_bytes=stored.size_bytes,
        page_count=pdf.page_count,
        ingestion_mode=ingestion_mode,
    )
    db.add(document)
    db.flush()

    drafts = segment_document(pdf, ingestion_mode, provider, declared_doc_type)
    segments = [
        DocumentSegment(
            document_id=document.id,
            segment_index=d.segment_index,
            doc_type=d.doc_type,
            classification_confidence=d.classification_confidence,
            page_start=d.page_start,
            page_end=d.page_end,
            boundary_method=d.boundary_method,
            boundary_confidence=d.boundary_confidence,
            needs_review=d.needs_review,
        )
        for d in drafts
    ]
    db.add_all(segments)
    db.flush()
    return document, segments


def duplicate_uploads(db: Session, bid_id: uuid.UUID, sha256: str) -> list[Document]:
    """Other documents on this bid with identical content (CLAUDE.md §9)."""
    return list(
        db.execute(
            select(Document).where(Document.bid_id == bid_id, Document.sha256 == sha256)
        ).scalars()
    )
