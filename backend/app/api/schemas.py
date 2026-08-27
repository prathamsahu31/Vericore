"""Request and response models. Routers validate and delegate (CLAUDE.md §13)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import (
    ApplicabilityScope,
    ComplianceStatus,
    IngestionMode,
    LocatorStatus,
    RiskLevel,
    Severity,
    TenderStatus,
    VerificationResultStatus,
    VerificationRunStatus,
    VerificationSource,
)


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


# ─────────────────────────────────────────────────────────────────────────────
# Tenders and requirements
# ─────────────────────────────────────────────────────────────────────────────
class TenderCreate(BaseModel):
    title: str = Field(min_length=1)
    bid_number: str | None = None
    buyer_organisation: str | None = None
    bid_due_date: date | None = None
    contract_start_date: date | None = None
    estimated_value: Decimal | None = None


class TenderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    bid_number: str | None
    buyer_organisation: str | None
    bid_due_date: date | None
    estimated_value: Decimal | None
    status: TenderStatus
    requirements_confirmed_at: datetime | None


class RequirementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    category: str | None
    raw_clause: str | None
    condition: dict | None
    mandatory: bool
    weight: Decimal
    applicability_scope: ApplicabilityScope
    accepts_document_types: list[str]
    external_check: str | None
    source_page: int | None
    source_clause_ref: str | None
    confirmed: bool
    edited_by_officer: bool
    extraction_confidence: float | None


class RequirementUpdate(BaseModel):
    """Officer corrections at the confirmation gate (CLAUDE.md §11)."""

    name: str | None = None
    condition: dict | None = None
    mandatory: bool | None = None
    weight: Decimal | None = None
    applicability_scope: ApplicabilityScope | None = None
    accepts_document_types: list[str] | None = None
    external_check: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Verification results
# ─────────────────────────────────────────────────────────────────────────────
class ComplianceRowOut(BaseModel):
    """One cell of the requirement × bidder matrix."""

    requirement_code: str
    requirement_name: str
    category: str | None
    mandatory: bool
    weight: Decimal
    applicability_scope: ApplicabilityScope
    status: ComplianceStatus
    reasoning: str | None
    confidence: float | None
    verification_method: str | None
    external_check_portal: str | None
    external_check_status: VerificationResultStatus | None
    # Rendered wherever the result appears, and printed in every export.
    external_check_source: VerificationSource | None
    evidence_field_ids: list[uuid.UUID] = Field(default_factory=list)
    # The officer's verdict, stored alongside the machine's — never replacing it.
    # Both are rendered; `status` above is always what the system concluded.
    override_status: ComplianceStatus | None = None
    override_reason: str | None = None
    override_at: datetime | None = None
    # What the gate and the score actually count.
    effective_status: ComplianceStatus | None = None


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    finding_type: str
    severity: Severity
    description: str
    field_name: str | None
    value_a: str | None
    value_b: str | None
    similarity_score: float | None


class RiskFlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    category: str | None
    severity: Severity
    description: str


class VerificationSummary(BaseModel):
    """The complete compliance picture for one bid."""

    bid_id: uuid.UUID
    bidder_name: str
    run_status: VerificationRunStatus
    bid_due_date: date | None
    compliance_score: Decimal | None
    # Nothing mandatory has *failed*. Says nothing about what is still pending.
    mandatory_gate_passed: bool | None
    # Evaluated and found wanting. Only an officer override clears these.
    mandatory_failed: list[str] = Field(default_factory=list)
    # Unresolved, not failed. An officer's acceptance clears these.
    pending_review: list[str] = Field(default_factory=list)
    # Both lists empty: the officer could qualify this bidder as things stand.
    qualifiable: bool = False
    risk_level: RiskLevel | None
    status_counts: dict[str, int] = Field(default_factory=dict)
    requirements: list[ComplianceRowOut] = Field(default_factory=list)
    cross_document_findings: list[FindingOut] = Field(default_factory=list)
    risk_flags: list[RiskFlagOut] = Field(default_factory=list)
    # Every external check in this run was simulated unless stated otherwise.
    external_checks_simulated: int = 0
    external_checks_live: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# Officer review and the audit trail
# ─────────────────────────────────────────────────────────────────────────────
class ReviewRequest(BaseModel):
    """One officer action on one requirement. The reason cannot be skipped."""

    requirement_code: str
    action: Literal["accept", "override"]
    officer_id: uuid.UUID
    reason: str = Field(min_length=1)
    # Required for 'override', ignored for 'accept'.
    override_status: ComplianceStatus | None = None


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    seq: int
    id: uuid.UUID
    event_type: str
    actor_type: str
    actor_id: uuid.UUID | None
    actor_component: str | None
    requirement_id: uuid.UUID | None
    previous_state: str | None
    new_state: str | None
    reason: str | None
    llm_provider: str | None
    llm_model_id: str | None
    prev_hash: str
    row_hash: str
    created_at: datetime


class ChainIntegrityOut(BaseModel):
    """Shown at the top of the audit trail (CLAUDE.md §11)."""

    total_events: int
    intact: bool
    first_broken_seq: int | None
    head_hash: str | None


class AuditTrailOut(BaseModel):
    integrity: ChainIntegrityOut
    events: list[AuditEventOut]
