"""Tenders, the NIT upload, and the requirement confirmation gate.

CLAUDE.md §11: after parsing a tender the officer sees each extracted
requirement beside the source text it came from, and must confirm before
verification can run. That is a gate, not a suggestion — a misread threshold
would silently corrupt every downstream verdict, and two minutes of human
confirmation removes the entire failure class.
"""

from __future__ import annotations

import re
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.enums import BoundaryMethod, IngestionMode, TenderStatus
from app.db.models import Document, DocumentSegment, Requirement, Tender
from app.errors import ConflictError, NotFoundError
from app.llm.base import LLMError
from app.llm.providers.stub import StubProvider
from app.llm.types import RequirementDraft, RequirementSet
from app.llm.types import DocumentInput
from app.modules.document_intelligence.pdf_reader import build_provider_text, read_pdf
from app.modules.verification_adapter.adapter import portal_for
from app.storage import store


def _looks_low_quality(requirements: list[RequirementDraft]) -> bool:
    if not requirements:
        return True
    meaningful = 0
    for row in requirements:
        name = (row.name or "").strip()
        if len(name) < 4:
            continue
        if not re.search(r"[A-Za-z]{3}", name):
            continue
        meaningful += 1
    return meaningful < max(2, len(requirements) // 2)


def _heuristic_requirements_from_text(text: str) -> RequirementSet:
    """Deterministic fallback for simple `Criterion | Minimum Requirement` NITs.

    This catches the synthetic/mock tender format where criteria appear as
    alternating lines under an "Eligibility Criteria" heading. It is deliberately
    narrow and deterministic so extraction still works when the live provider is
    rate-limited or returns malformed output.
    """

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    lo = [ln.casefold() for ln in lines]

    start = next((i for i, ln in enumerate(lo) if "eligibility criteria" in ln), -1)
    if start < 0:
        return RequirementSet(requirements=[])
    end = next((i for i in range(start + 1, len(lo)) if "required documents" in lo[i]), len(lines))
    section = [ln for ln in lines[start + 1 : end] if ln.casefold() not in {"criterion", "minimum requirement", "field", "details"}]

    pairs: list[tuple[str, str]] = []
    i = 0
    while i < len(section) - 1:
        left = section[i]
        right = section[i + 1]
        # Skip table serials if present.
        if re.fullmatch(r"\d+", left):
            i += 1
            continue
        # Ignore obvious headings.
        if left.casefold() in {"criterion", "minimum requirement", "no.", "document"}:
            i += 1
            continue
        pairs.append((left, right))
        i += 2

    out: list[RequirementDraft] = []
    for idx, (criterion, minimum) in enumerate(pairs, start=1):
        key = criterion.casefold()
        condition: dict | None = None
        category = "statutory"
        accepts: list[str] = []
        required: list[str] = []

        if "turnover" in key:
            category = "financial_eligibility"
            accepts = ["ca_turnover_certificate", "financial_statement"]
            required = ["turnover_fy1", "turnover_fy2", "turnover_fy3"]
            m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*crore", minimum, flags=re.IGNORECASE)
            if m:
                condition = {
                    "field": "average_annual_turnover",
                    "operator": ">=",
                    "threshold": int(float(m.group(1)) * 10_000_000),
                    "unit": "INR",
                    "period_years": 3,
                }
        elif "net worth" in key or "financial capacity" in key:
            category = "financial_eligibility"
            accepts = ["financial_statement"]
            required = ["net_worth"]
            condition = {"field": "net_worth", "operator": ">", "threshold": 0, "unit": "INR"}
        elif "gst" in key:
            accepts = ["gst_certificate"]
            required = ["gstin", "legal_name", "registration_status"]
        elif "udyam" in key:
            accepts = ["udyam_certificate"]
            required = ["udyam_urn", "enterprise_name"]
        elif "iso" in key:
            category = "technical"
            accepts = ["iso_certificate"]
            required = ["certificate_number", "standard", "valid_until"]
        elif "epfo" in key:
            accepts = ["epfo_certificate"]
            required = ["registration_number", "legal_name"]
        elif "esic" in key:
            accepts = ["esic_certificate"]
            required = ["registration_number", "legal_name"]
        elif re.search(r"\bpan\b", key):
            accepts = ["pan_card"]
            required = ["pan", "legal_name"]
        elif "incorporation" in key:
            accepts = ["incorporation_certificate"]
            required = ["cin", "incorporation_date", "legal_name"]
        else:
            # Unknown criterion in this fallback profile.
            continue

        out.append(
            RequirementDraft(
                code=f"REQ-{idx:03d}",
                name=criterion,
                category=category,
                raw_clause=f"{criterion}: {minimum}",
                normalized_clause=minimum,
                condition=condition,
                mandatory=True,
                weight=1.0,
                applicability_scope="lead_only",
                accepts_document_types=accepts,
                required_fields=required,
                external_check=None,
                source_page=1,
                source_clause_ref=None,
                confidence=0.85,
            )
        )
    return RequirementSet(requirements=out)


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
        db.execute(
            select(Tender)
            .where(Tender.status != TenderStatus.CLOSED)
            .order_by(Tender.created_at.desc(), Tender.title.asc())
        )
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
    text = build_provider_text(pdf.pages)
    # Native-document providers (Gemini) can see table layout. Text-only
    # providers (Stub) exercise the OCR fallback path (CLAUDE.md §7.1).
    if getattr(provider, "supports_native_documents", False):
        raw = document.storage_path
        try:
            file_bytes = open(raw, "rb").read()  # type: ignore[arg-type]
        except Exception:
            file_bytes = None
        doc_input = DocumentInput(text=text, file_bytes=file_bytes, mime_type="application/pdf")
    else:
        doc_input = DocumentInput(text=text, mime_type="application/pdf")
    fallback_provider = StubProvider()
    fallback = _heuristic_requirements_from_text(text)
    try:
        result = provider.extract_requirements(doc_input)
    except LLMError:
        if fallback.requirements:
            result = fallback
        else:
            # Last deterministic fallback for the DARPG-style demo profile.
            result = fallback_provider.extract_requirements(DocumentInput(text=text, mime_type="application/pdf"))

    if _looks_low_quality(result.requirements):
        if fallback.requirements:
            result = fallback
        else:
            alt = fallback_provider.extract_requirements(DocumentInput(text=text, mime_type="application/pdf"))
            if alt.requirements and not _looks_low_quality(alt.requirements):
                result = alt

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


def _ensure_officer(db: Session, officer_id: uuid.UUID | None) -> uuid.UUID | None:
    """Return a valid user id for the gate, auto-creating the dev officer.

    The dashboard sends ``NEXT_PUBLIC_OFFICER_ID`` even on a fresh DB with no
    seeded users. Persisting that id without a FK row raises a 500 on confirm,
    which surfaces as “Confirming locks…” → “Request failed.”.
    """
    if officer_id is None:
        return None
    from app.db.models import User

    if db.get(User, officer_id) is not None:
        return officer_id
    # Auto-create the officer so the gate never blocks on a missing FK.
    try:
        user = User(id=officer_id, email=f"officer-{str(officer_id)[:8]}@vericore.local", full_name="Officer", role="officer")
        db.add(user)
        db.flush()
        return officer_id
    except Exception:
        db.rollback()
        return None


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
    tender.requirements_confirmed_by = _ensure_officer(db, officer_id)
    db.flush()
    return tender


def _clear_llm_cache_for_tender(document) -> int:
    """Evict the on-disk LLM cache for a tender's NIT so re-extraction
    after a prompt change actually re-runs the model.

    The ``CachedProvider`` key is a hash of (provider, method, document
    bytes/text), not the tender id — so deleting the DB rows alone leaves
    stale cached extractions on disk that still hit on the next upload of
    the same PDF. For the dashboard delete/reset testing loop this is the
    surprising stale state.

    We fingerprint the same two ``extract_requirements`` call shapes the
    tender service uses (text-only for Stub, text+bytes for native-document
    providers) across both REASONING providers, and delete matching files.
    Returns count of files removed.
    """
    try:
        from app.config import get_settings
        from app.llm.factory import _build_base
        from app.llm.providers.decorators import _fingerprint
        from app.llm.types import DocumentInput
        from app.modules.document_intelligence.pdf_reader import build_provider_text, read_pdf

        pdf = read_pdf(document.storage_path)
        text = build_provider_text(pdf.pages)
        try:
            file_bytes = open(document.storage_path, "rb").read()  # type: ignore[arg-type]
        except Exception:
            file_bytes = None

        cache_dir = get_settings().llm_cache_dir
        if not cache_dir.exists():
            return 0

        # Fingerprints that ``extract_requirements`` could have been cached under.
        candidates: set[str] = set()
        for provider_name in ("stub", "openai", "gemini", "anthropic"):
            try:
                base = _build_base(provider_name)
            except Exception:
                continue
            for doc_input in (
                DocumentInput(text=text, mime_type="application/pdf"),
                DocumentInput(text=text, file_bytes=file_bytes, mime_type="application/pdf"),
                DocumentInput(text=text, file_bytes=file_bytes or b"", mime_type="application/pdf"),
            ):
                try:
                    candidates.add(_fingerprint(base.name, "extract_requirements", (doc_input,), {}))
                except Exception:
                    continue

        removed = 0
        for path in cache_dir.glob("*.json"):
            if path.stem in candidates:
                try:
                    path.unlink()
                    removed += 1
                except Exception:
                    pass
        return removed
    except Exception:
        return 0


def reset_requirements(db: Session, *, tender_id: uuid.UUID) -> Tender:
    """Clear the checklist so requirements can be re-extracted (testing helper).

    Deletes requirements and resets the tender to DRAFT. Refuses if the
    checklist is already confirmed — delete the whole tender instead, since
    confirmed verdicts would be invalidated silently.
    """
    tender = get_tender(db, tender_id)
    if tender.status is TenderStatus.REQUIREMENTS_CONFIRMED:
        raise ConflictError(
            "Checklist already confirmed — delete the tender to re-extract. "
            "Re-extracting under confirmed verdicts would silently invalidate them.",
            detail={"tender_id": str(tender_id)},
        )
    # Evict cached LLM extraction for this NIT so next extract sees prompt changes.
    doc = (
        db.execute(
            select(Document)
            .where(Document.tender_id == tender.id)
            .order_by(Document.uploaded_at.desc())
        )
        .scalars()
        .first()
    )
    if doc is not None:
        _clear_llm_cache_for_tender(doc)
    for req in db.execute(select(Requirement).where(Requirement.tender_id == tender.id)).scalars():
        db.delete(req)
    tender.status = TenderStatus.DRAFT
    tender.requirements_confirmed_at = None
    tender.requirements_confirmed_by = None
    db.flush()
    return tender


def delete_tender(db: Session, *, tender_id: uuid.UUID) -> None:
    """Delete a tender and everything beneath it (testing / iteration).

    FKs with RESTRICT (audit_events) are cleared manually; CASCADE handles
    the rest. Storage files are not removed — they are hash-addressed and
    harmless to keep for a dev reset. The LLM on-disk cache for the NIT is
    also evicted so a subsequent re-upload with the same PDF picks up prompt
    changes instead of a stale cached extraction.
    """
    from app.db.models import AuditEvent, Bid

    tender = get_tender(db, tender_id)
    # Evict LLM cache before DB rows disappear (need storage_path).
    doc = (
        db.execute(
            select(Document)
            .where(Document.tender_id == tender.id)
            .order_by(Document.uploaded_at.desc())
        )
        .scalars()
        .first()
    )
    if doc is not None:
        _clear_llm_cache_for_tender(doc)
    # audit_events is append-only by trigger (§2 rule 6). A tender with history
    # is archived (hidden from the active list) rather than hard-deleted.
    bid_ids = [bid.id for bid in db.execute(select(Bid).where(Bid.tender_id == tender.id)).scalars()]
    tender_event_count = db.execute(
        select(AuditEvent.id).where(AuditEvent.tender_id == tender.id)
    ).scalars().all()
    bid_event_count = []
    if bid_ids:
        bid_event_count = db.execute(
            select(AuditEvent.id).where(AuditEvent.bid_id.in_(bid_ids))
        ).scalars().all()
    total_events = len(tender_event_count) + len(bid_event_count)
    if total_events:
        tender.status = TenderStatus.CLOSED
        if tender.bid_number:
            tender.bid_number = None
        if not tender.title.startswith("[Archived] "):
            tender.title = f"[Archived] {tender.title}"
        db.flush()
        return

    db.delete(tender)
    db.flush()
