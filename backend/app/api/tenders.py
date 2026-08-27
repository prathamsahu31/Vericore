"""Tender routes: create, upload the NIT, extract and confirm the checklist."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import extraction_provider, reasoning_provider
from app.api.schemas import (
    DocumentOut,
    RequirementOut,
    RequirementUpdate,
    TenderCreate,
    TenderOut,
)
from app.db.session import get_db
from app.modules.tender_service import service as tenders

router = APIRouter(tags=["tenders"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/tenders", response_model=TenderOut, status_code=201)
def create_tender(payload: TenderCreate, db: DbSession) -> TenderOut:
    tender = tenders.create_tender(db, **payload.model_dump())
    db.commit()
    return TenderOut.model_validate(tender)


@router.get("/tenders/{tender_id}", response_model=TenderOut)
def get_tender(tender_id: uuid.UUID, db: DbSession) -> TenderOut:
    return TenderOut.model_validate(tenders.get_tender(db, tender_id))


@router.post("/tenders/{tender_id}/document", response_model=DocumentOut, status_code=201)
def upload_nit(
    tender_id: uuid.UUID, db: DbSession, file: Annotated[UploadFile, File()]
) -> DocumentOut:
    """Upload the notice inviting tender. Extraction is a separate step."""
    document = tenders.upload_nit(
        db,
        tender_id=tender_id,
        content=file.file.read(),
        filename=file.filename or "nit.pdf",
        mime_type=file.content_type or "application/octet-stream",
    )
    db.commit()
    return DocumentOut.model_validate(document)


@router.post(
    "/tenders/{tender_id}/extract-requirements",
    response_model=list[RequirementOut],
    status_code=201,
)
def extract_requirements(
    tender_id: uuid.UUID,
    db: DbSession,
    provider: Annotated[Any, Depends(reasoning_provider)],
) -> list[RequirementOut]:
    """Parse the NIT into a draft checklist.

    Reading a tender is the REASONING role: low volume, high difficulty, and the
    output a judge reads word for word (CLAUDE.md §7.3).
    """
    rows = tenders.extract_requirements(db, tender_id=tender_id, provider=provider)
    db.commit()
    return [RequirementOut.model_validate(r) for r in rows]


@router.get("/tenders/{tender_id}/requirements", response_model=list[RequirementOut])
def list_requirements(tender_id: uuid.UUID, db: DbSession) -> list[RequirementOut]:
    return [RequirementOut.model_validate(r) for r in tenders.list_requirements(db, tender_id)]


@router.patch("/requirements/{requirement_id}", response_model=RequirementOut)
def update_requirement(
    requirement_id: uuid.UUID, payload: RequirementUpdate, db: DbSession
) -> RequirementOut:
    """Correct an extracted requirement before the checklist is confirmed."""
    row = tenders.update_requirement(db, requirement_id, payload.model_dump(exclude_unset=True))
    db.commit()
    return RequirementOut.model_validate(row)


@router.post("/tenders/{tender_id}/confirm-requirements", response_model=TenderOut)
def confirm_requirements(
    tender_id: uuid.UUID, db: DbSession, officer_id: uuid.UUID | None = None
) -> TenderOut:
    """The gate. Verification cannot run until this is called (CLAUDE.md §11)."""
    tender = tenders.confirm_requirements(db, tender_id=tender_id, officer_id=officer_id)
    db.commit()
    return TenderOut.model_validate(tender)


# Re-exported so the extraction provider dependency stays importable from here.
__all__ = ["router", "extraction_provider"]
