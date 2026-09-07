"""Tenders, the NIT upload, and the requirement confirmation gate.

CLAUDE.md §11: after parsing a tender the officer sees each extracted
requirement beside the source text it came from, and must confirm before
verification can run. That is a gate, not a suggestion — a misread threshold
would silently corrupt every downstream verdict, and two minutes of human
confirmation removes the entire failure class.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.enums import BoundaryMethod, IngestionMode, TenderStatus
from app.db.models import Document, DocumentSegment, Requirement, Tender
from app.errors import ConflictError, NotFoundError
from app.llm.types import DocumentInput
from app.modules.document_intelligence.pdf_reader import build_provider_text, read_pdf
from app.modules.verification_adapter.adapter import portal_for
from app.storage import store


def create_tender(
    db: Session,
    *,
    title: str,
    bid_number: str | None = None,
    buyer_organisation: str | None = None,
    bid_due_date: date | None = None,
    estimated_value=None,
    contract_start_date: date | None = None,
) -> Tender:
    tender = Tender(
        title=title,
        bid_number=bid_number,
        buyer_organisation=buyer_organisation,
        bid_due_date=bid_due_date,
        estimated_value=estimated_value,
        contract_start_date=contract_start_date,
        status=TenderStatus.DRAFT,
    )
    db.add(tender)
    db.flush()
    return tender


def get_tender(db: Session, tender_id: uuid.UUID) -> Tender:
    tender = db.get(Tender, tender_id)
    if tender is None:
        raise NotFoundError(f"Tender {tender_id} not found")
    return tender


def list_tenders(db: Session) -> list[Tender]:
    rows = (
        db.execute(select(Tender).order_by(Tender.created_at.desc(), Tender.title.asc()))
        .scalars()
        .all()
    )
    return list(rows)


def upload_nit(
    db: Session, *, tender_id: uuid.UUID, content: bytes, filename: str, mime_type: str
) -> Document:
    """Store the NIT against the tender. One segment spanning all pages."""
    tender = get_tender(db, tender_id)
    stored = store(content, filename, mime_type)
    pdf = read_pdf(stored.path)

    document = Document(
        tender_id=tender.id,
        original_filename=filename,
        storage_path=str(stored.path),
        sha256=stored.sha256,
        mime_type=stored.mime_type,
        size_bytes=stored.size_bytes,
        page_count=pdf.page_count,
        ingestion_mode=IngestionMode.SEPARATE,
    )
    db.add(document)
    db.flush()
    db.add(
        DocumentSegment(
            document_id=document.id,
            segment_index=0,
            doc_type="tender_notice",
            page_start=1,
            page_end=pdf.page_count or 1,
            boundary_method=BoundaryMethod.WHOLE_FILE,
            boundary_confidence=1.0,
            classification_confidence=1.0,
        )
    )
    db.flush()
    return document


def extract_requirements(db: Session, *, tender_id: uuid.UUID, provider) -> list[Requirement]:
    """Parse the tender's NIT into requirement drafts.

    Re-running replaces any drafts the officer has not yet confirmed, and
    refuses once the checklist is confirmed — silently re-parsing under a
    confirmed checklist would invalidate every verdict already formed against it.
    """
    tender = get_tender(db, tender_id)
    if tender.status is TenderStatus.REQUIREMENTS_CONFIRMED:
        raise ConflictError(
            "This tender's checklist has already been confirmed. Re-extracting would "
            "invalidate verdicts already formed against it.",
            detail={"tender_id": str(tender_id)},
        )

    document = (
        db.execute(
            select(Document)
            .where(Document.tender_id == tender.id)
            .order_by(Document.uploaded_at.desc())
        )
        .scalars()
        .first()
    )
    if document is None:
        raise NotFoundError(f"Tender {tender_id} has no uploaded NIT to parse")

    pdf = read_pdf(document.storage_path)
    result = provider.extract_requirements(
        DocumentInput(text=build_provider_text(pdf.pages), mime_type="application/pdf")
    )

    for existing in db.execute(
        select(Requirement).where(Requirement.tender_id == tender.id)
    ).scalars():
        db.delete(existing)
    db.flush()

    rows = [
        Requirement(
            tender_id=tender.id,
            code=draft.code,
            name=draft.name,
            category=draft.category,
            raw_clause=draft.raw_clause,
            normalized_clause=draft.normalized_clause,
            condition=draft.condition,
            mandatory=draft.mandatory,
            weight=draft.weight,
            applicability_scope=draft.applicability_scope,
            accepts_document_types=draft.accepts_document_types,
            required_fields=draft.required_fields,
            external_check=draft.external_check or portal_for(draft),
            source_page=draft.source_page,
            source_clause_ref=draft.source_clause_ref,
            display_order=index,
            extraction_confidence=draft.confidence,
            confirmed=False,
        )
        for index, draft in enumerate(result.requirements)
    ]
    db.add_all(rows)
    tender.status = TenderStatus.REQUIREMENTS_EXTRACTED
    db.flush()
    return rows


def list_requirements(db: Session, tender_id: uuid.UUID) -> list[Requirement]:
    return list(
        db.execute(
            select(Requirement)
            .where(Requirement.tender_id == tender_id)
            .order_by(Requirement.display_order)
        ).scalars()
    )


def update_requirement(db: Session, requirement_id: uuid.UUID, changes: dict) -> Requirement:
    """Officer edits to an extracted requirement, before confirmation."""
    requirement = db.get(Requirement, requirement_id)
    if requirement is None:
        raise NotFoundError(f"Requirement {requirement_id} not found")
    for key, value in changes.items():
        if value is not None and hasattr(requirement, key):
            setattr(requirement, key, value)
    requirement.edited_by_officer = True
    db.flush()
    return requirement


def confirm_requirements(
    db: Session, *, tender_id: uuid.UUID, officer_id: uuid.UUID | None
) -> Tender:
    """The gate. Nothing is evaluated against a checklist nobody confirmed."""
    from datetime import UTC, datetime

    tender = get_tender(db, tender_id)
    requirements = list_requirements(db, tender_id)
    if not requirements:
        raise ConflictError("There are no extracted requirements to confirm.")

    for requirement in requirements:
        requirement.confirmed = True
    tender.status = TenderStatus.REQUIREMENTS_CONFIRMED
    tender.requirements_confirmed_at = datetime.now(UTC)
    tender.requirements_confirmed_by = officer_id
    db.flush()
    return tender
