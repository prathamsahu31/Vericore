"""SQLAlchemy models for the seventeen tables named in CLAUDE.md §6.

Three schema rules from that section are load-bearing and are enforced here as
database constraints rather than as application convention:

* ``extracted_fields`` stores ``page`` and a bounding box, all NOT NULL. Without
  coordinates the evidence drill-down is impossible, and the drill-down is the
  product.
* Everything downstream cites ``document_segment_id``, never ``document_id``, so
  a page-3 citation is unambiguous about which logical document that page is in.
* ``audit_events`` is append-only and hash-chained, enforced by a trigger
  installed in the first migration.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import enums
from app.db.base import Base, created_at_col, uuid_pk


def _enum(py_enum: type, name: str) -> SAEnum:
    """Postgres native ENUM storing member *values*, not member names."""
    return SAEnum(
        py_enum,
        name=name,
        values_callable=lambda e: [m.value for m in e],
        native_enum=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    """CLAUDE.md §17. Roles gate what a person may do; only OFFICER decides."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[enums.UserRole] = mapped_column(_enum(enums.UserRole, "user_role"), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = created_at_col()


# ─────────────────────────────────────────────────────────────────────────────
# Tenders and requirements
# ─────────────────────────────────────────────────────────────────────────────
class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_number: Mapped[str | None] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    buyer_organisation: Mapped[str | None] = mapped_column(String(300))
    category: Mapped[str | None] = mapped_column(String(120))
    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default=text("'INR'")
    )

    # Certificate validity is checked against this date, never against today
    # (CLAUDE.md §9). BID_DUE_DATE_OVERRIDE pins it for deterministic demo runs.
    bid_due_date: Mapped[date | None] = mapped_column(Date)
    contract_start_date: Mapped[date | None] = mapped_column(Date)
    emd_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # Relaxation flags read from tender metadata (architecture.md §6.6).
    mse_relaxation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    startup_relaxation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    status: Mapped[enums.TenderStatus] = mapped_column(
        _enum(enums.TenderStatus, "tender_status"),
        nullable=False,
        default=enums.TenderStatus.DRAFT,
        server_default=text("'draft'"),
    )
    # The requirement confirmation gate (CLAUDE.md §11). Verification must not
    # run until an officer has confirmed the extracted checklist.
    requirements_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requirements_confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        UniqueConstraint("bid_number", name="uq_tenders_bid_number"),
        CheckConstraint(
            "(status <> 'requirements_confirmed') OR (requirements_confirmed_at IS NOT NULL)",
            name="confirmed_requires_timestamp",
        ),
    )


class Requirement(Base):
    """One eligibility requirement extracted from the tender, CLAUDE.md §21.

    ``accepts_document_types`` is the routing lookup: only evidence from a
    segment whose type is in this list is ever considered. Routing is a lookup,
    and a lookup cannot hallucinate.
    """

    __tablename__ = "requirements"

    id: Mapped[uuid.UUID] = uuid_pk()
    tender_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenders.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. REQ-003
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(80))

    raw_clause: Mapped[str | None] = mapped_column(Text)
    normalized_clause: Mapped[str | None] = mapped_column(Text)
    condition: Mapped[dict | None] = mapped_column(JSONB)

    mandatory: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    weight: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=0, server_default=text("0")
    )

    applicability_scope: Mapped[enums.ApplicabilityScope] = mapped_column(
        _enum(enums.ApplicabilityScope, "applicability_scope"),
        nullable=False,
        # The stricter reading is the safe error: if the extractor is unsure,
        # default to lead_only and let the officer widen it (CLAUDE.md §20).
        default=enums.ApplicabilityScope.LEAD_ONLY,
        server_default=text("'lead_only'"),
    )

    accepts_document_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(80)), nullable=False, default=list, server_default=text("'{}'::varchar[]")
    )
    required_fields: Mapped[list[str]] = mapped_column(
        ARRAY(String(80)), nullable=False, default=list, server_default=text("'{}'::varchar[]")
    )
    external_check: Mapped[str | None] = mapped_column(String(40))  # portal_id, or NULL

    source_page: Mapped[int | None] = mapped_column(Integer)
    source_clause_ref: Mapped[str | None] = mapped_column(String(120))
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    # Per-requirement half of the confirmation gate.
    confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    edited_by_officer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    extraction_confidence: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        UniqueConstraint("tender_id", "code", name="uq_requirements_tender_id_code"),
        CheckConstraint("weight >= 0", name="weight_non_negative"),
        Index("ix_requirements_tender_id", "tender_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Bidders, bids, members
# ─────────────────────────────────────────────────────────────────────────────
class Bidder(Base):
    """A company. Deduplicated across tenders by PAN so history accumulates."""

    __tablename__ = "bidders"

    id: Mapped[uuid.UUID] = uuid_pk()
    legal_name: Mapped[str] = mapped_column(String(300), nullable=False)
    normalized_name: Mapped[str | None] = mapped_column(String(300))

    # CLAUDE.md §6: bidders are deduplicated across tenders by PAN.
    pan: Mapped[str | None] = mapped_column(String(10), unique=True)
    gstin: Mapped[str | None] = mapped_column(String(15))
    udyam_urn: Mapped[str | None] = mapped_column(String(25))
    cin: Mapped[str | None] = mapped_column(String(21))

    registered_address: Mapped[str | None] = mapped_column(Text)
    state_code: Mapped[str | None] = mapped_column(String(2))
    pincode: Mapped[str | None] = mapped_column(String(6))
    incorporation_date: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (Index("ix_bidders_normalized_name", "normalized_name"),)


class Bid(Base):
    """One submission against one tender. Carries the assessment and the decision.

    The decision columns are the only place a bidder's outcome is recorded, and
    nothing writes them except an authenticated officer action (CLAUDE.md §2).
    """

    __tablename__ = "bids"

    id: Mapped[uuid.UUID] = uuid_pk()
    tender_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenders.id", ondelete="CASCADE"), nullable=False
    )
    reference: Mapped[str | None] = mapped_column(String(80))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ── Assessment (CLAUDE.md §10) — arithmetic, not a model output ──────
    compliance_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    mandatory_gate_passed: Mapped[bool | None] = mapped_column(Boolean)
    score_breakdown: Mapped[dict | None] = mapped_column(JSONB)
    risk_level: Mapped[enums.RiskLevel | None] = mapped_column(_enum(enums.RiskLevel, "risk_level"))

    # ── Recommendation — advisory, never a control (CLAUDE.md §11) ───────
    recommendation_text: Mapped[str | None] = mapped_column(Text)
    recommendation_action: Mapped[enums.RecommendationAction | None] = mapped_column(
        _enum(enums.RecommendationAction, "recommendation_action")
    )
    recommendation_cited_requirements: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(PGUUID(as_uuid=True))
    )

    # ── Officer decision — the only place a decision is made (§4 layer 9) ─
    decision: Mapped[enums.DecisionOutcome | None] = mapped_column(
        _enum(enums.DecisionOutcome, "decision_outcome")
    )
    decision_justification: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        Index("ix_bids_tender_id", "tender_id"),
        CheckConstraint(
            "compliance_score IS NULL OR (compliance_score >= 0 AND compliance_score <= 100)",
            name="score_within_range",
        ),
        # A decision is never recorded without an actor and a justification.
        CheckConstraint(
            "decision IS NULL OR ("
            "decided_by IS NOT NULL AND decided_at IS NOT NULL "
            "AND decision_justification IS NOT NULL "
            "AND length(btrim(decision_justification)) > 0)",
            name="decision_requires_actor_and_justification",
        ),
    )


class BidMember(Base):
    """Links a bid to one or more bidders, CLAUDE.md §6 and §20.

    A sole bid has exactly one row with role ``sole``. Consortium logic arrives
    on Day 4, but the column goes in now because retrofitting it would touch
    every evaluation.
    """

    __tablename__ = "bid_members"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )
    bidder_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bidders.id", ondelete="RESTRICT"), nullable=False
    )
    role: Mapped[enums.BidMemberRole] = mapped_column(
        _enum(enums.BidMemberRole, "bid_member_role"), nullable=False
    )
    member_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    share_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        # The same company cannot appear twice within one bid.
        UniqueConstraint("bid_id", "bidder_id", name="uq_bid_members_bid_id_bidder_id"),
        Index("ix_bid_members_bid_id", "bid_id"),
        Index("ix_bid_members_bidder_id", "bidder_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Documents, segments, extracted fields
# ─────────────────────────────────────────────────────────────────────────────
class Document(Base):
    """One uploaded file. Belongs to a tender (the NIT) or to a bid, never both.

    ``sha256`` is recorded on upload and is the immutable reference used in
    every downstream citation. It is deliberately not globally unique: detecting
    a duplicate document is a check the system performs (CLAUDE.md §9), so
    duplicates must be storable in order to be flagged.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    tender_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenders.id", ondelete="CASCADE")
    )
    bid_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE")
    )
    # Which consortium member submitted it. NULL for a sole bid or a tender doc.
    bid_member_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bid_members.id", ondelete="SET NULL")
    )

    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer)

    # The officer chooses this per upload; it is never inferred (CLAUDE.md §19).
    ingestion_mode: Mapped[enums.IngestionMode] = mapped_column(
        _enum(enums.IngestionMode, "ingestion_mode"), nullable=False
    )
    segmentation_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    segmentation_confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )

    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    uploaded_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        CheckConstraint(
            "(tender_id IS NOT NULL)::int + (bid_id IS NOT NULL)::int = 1",
            name="belongs_to_exactly_one_owner",
        ),
        CheckConstraint("size_bytes > 0", name="size_positive"),
        CheckConstraint("sha256 ~ '^[0-9a-f]{64}$'", name="sha256_is_lowercase_hex"),
        Index("ix_documents_bid_id", "bid_id"),
        Index("ix_documents_tender_id", "tender_id"),
        # Duplicate-document detection by SHA-256 (CLAUDE.md §9).
        Index("ix_documents_sha256", "sha256"),
    )


class DocumentSegment(Base):
    """A logical document found inside one uploaded file, CLAUDE.md §19.

    A single-document upload produces exactly one segment spanning all pages,
    so the rest of the pipeline has one shape to handle rather than two.
    """

    __tablename__ = "document_segments"

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    segment_index: Mapped[int] = mapped_column(Integer, nullable=False)

    doc_type: Mapped[str] = mapped_column(
        String(80), nullable=False, default="unclassified", server_default=text("'unclassified'")
    )
    classification_confidence: Mapped[float | None] = mapped_column(Float)

    page_start: Mapped[int] = mapped_column(Integer, nullable=False)
    page_end: Mapped[int] = mapped_column(Integer, nullable=False)

    boundary_method: Mapped[enums.BoundaryMethod] = mapped_column(
        _enum(enums.BoundaryMethod, "boundary_method"), nullable=False
    )
    # Below threshold the segment is flagged and surfaces in the review UI.
    boundary_confidence: Mapped[float | None] = mapped_column(Float)
    needs_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        UniqueConstraint(
            "document_id", "segment_index", name="uq_document_segments_document_id_segment_index"
        ),
        CheckConstraint("page_start >= 1", name="page_start_is_one_based"),
        CheckConstraint("page_end >= page_start", name="page_range_ordered"),
        CheckConstraint(
            "boundary_confidence IS NULL OR (boundary_confidence >= 0 "
            "AND boundary_confidence <= 1)",
            name="boundary_confidence_within_range",
        ),
        Index("ix_document_segments_document_id", "document_id"),
        Index("ix_document_segments_doc_type", "doc_type"),
    )


class ExtractedField(Base):
    """One field pulled out of a segment, with the coordinates that make the
    evidence drill-down possible.

    ``page`` and the bounding box are NOT NULL by deliberate choice
    (CLAUDE.md §6): a field that cannot be pointed at on the page cannot be
    cited, and an uncitable field is not evidence.
    """

    __tablename__ = "extracted_fields"

    id: Mapped[uuid.UUID] = uuid_pk()
    document_segment_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("document_segments.id", ondelete="CASCADE"), nullable=False
    )

    field_name: Mapped[str] = mapped_column(String(80), nullable=False)
    field_value: Mapped[str | None] = mapped_column(Text)
    value_normalized: Mapped[str | None] = mapped_column(Text)
    value_numeric: Mapped[Decimal | None] = mapped_column(Numeric(20, 4))
    value_date: Mapped[date | None] = mapped_column(Date)

    # Mandatory. Without these the evidence ledger cannot highlight the source.
    # Always populated: when the locator cannot find the value in the page text,
    # the box degrades to the page rectangle rather than to NULL, so a citation
    # always opens *somewhere* the officer can read.
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    x0: Mapped[float] = mapped_column(Float, nullable=False)
    y0: Mapped[float] = mapped_column(Float, nullable=False)
    x1: Mapped[float] = mapped_column(Float, nullable=False)
    y1: Mapped[float] = mapped_column(Float, nullable=False)

    # How that box was arrived at, and how well. Read `locator_status` before
    # trusting the rectangle: the two fallback values mean "this is a page, not
    # a highlight".
    locator_status: Mapped[enums.LocatorStatus] = mapped_column(
        _enum(enums.LocatorStatus, "locator_status"), nullable=False
    )
    locator_score: Mapped[float | None] = mapped_column(Float)
    # Per-line rectangles when the matched span wraps across lines. The columns
    # above hold their union, which is what the viewer scrolls to; these are
    # what it outlines, so a two-line span does not highlight the text between.
    bbox_rects: Mapped[list | None] = mapped_column(JSONB)

    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    extraction_method: Mapped[str] = mapped_column(String(40), nullable=False)
    source_span: Mapped[str | None] = mapped_column(Text)

    # A verdict must stay attributable to the exact model that produced it,
    # forever — including after a provider switch (CLAUDE.md §7.6).
    llm_provider: Mapped[str | None] = mapped_column(String(40))
    llm_model_id: Mapped[str | None] = mapped_column(String(120))
    llm_role: Mapped[str | None] = mapped_column(String(20))

    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        CheckConstraint("page >= 1", name="page_is_one_based"),
        CheckConstraint("x1 >= x0 AND y1 >= y0", name="bbox_ordered"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_within_range"),
        CheckConstraint(
            "locator_score IS NULL OR (locator_score >= 0 AND locator_score <= 1)",
            name="locator_score_within_range",
        ),
        Index("ix_extracted_fields_document_segment_id", "document_segment_id"),
        Index("ix_extracted_fields_field_name", "field_name"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Evidence and verdicts
# ─────────────────────────────────────────────────────────────────────────────
class Evidence(Base):
    """Links a requirement to the segment and fields that speak to it.

    CLAUDE.md §2 rule 1: a verdict object without evidence references is a bug.
    """

    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    # Cites the segment, never the file (CLAUDE.md §6).
    document_segment_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("document_segments.id", ondelete="CASCADE"), nullable=False
    )
    # Which member this evidence is attributed to, for consortium scopes.
    bid_member_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bid_members.id", ondelete="SET NULL")
    )

    extracted_field_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(PGUUID(as_uuid=True)),
        nullable=False,
        default=list,
        server_default=text("'{}'::uuid[]"),
    )
    # Value snapshot at the time the verdict was formed, so a later re-extraction
    # cannot silently rewrite what an officer saw.
    field_snapshot: Mapped[dict | None] = mapped_column(JSONB)
    confidence: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        Index("ix_evidence_bid_id", "bid_id"),
        Index("ix_evidence_requirement_id", "requirement_id"),
        Index("ix_evidence_bid_id_requirement_id", "bid_id", "requirement_id"),
    )


class ComplianceResult(Base):
    """The verdict for one requirement x bid pair.

    ``status`` is the machine verdict. An officer override is stored in the
    ``override_*`` columns *alongside* it, never replacing it, so the trail
    shows both what the system found and what the officer decided
    (CLAUDE.md §5).
    """

    __tablename__ = "compliance_results"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )

    # Every requirement starts here (CLAUDE.md §5).
    status: Mapped[enums.ComplianceStatus] = mapped_column(
        _enum(enums.ComplianceStatus, "compliance_status"),
        nullable=False,
        default=enums.ComplianceStatus.MISSING_EVIDENCE,
        server_default=text("'MISSING_EVIDENCE'"),
    )
    applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    confidence: Mapped[float | None] = mapped_column(Float)
    reasoning: Mapped[str | None] = mapped_column(Text)
    verification_method: Mapped[str | None] = mapped_column(String(60))

    # Which member satisfied it, e.g. "COMPLIANT via member 2 of 3".
    satisfied_by_bid_member_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bid_members.id", ondelete="SET NULL")
    )

    # Never presented as live. NULL when no external check applies.
    external_check_portal: Mapped[str | None] = mapped_column(String(40))
    external_check_status: Mapped[enums.VerificationResultStatus | None] = mapped_column(
        _enum(enums.VerificationResultStatus, "verification_result_status")
    )
    external_check_source: Mapped[enums.VerificationSource | None] = mapped_column(
        _enum(enums.VerificationSource, "verification_source")
    )

    # ── Officer override, stored alongside the machine verdict ────────────
    override_status: Mapped[enums.ComplianceStatus | None] = mapped_column(
        _enum(enums.ComplianceStatus, "compliance_status")
    )
    override_reason: Mapped[str | None] = mapped_column(Text)
    override_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    override_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    llm_provider: Mapped[str | None] = mapped_column(String(40))
    llm_model_id: Mapped[str | None] = mapped_column(String(120))
    llm_role: Mapped[str | None] = mapped_column(String(20))

    evaluated_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        UniqueConstraint(
            "bid_id", "requirement_id", name="uq_compliance_results_bid_id_requirement_id"
        ),
        # An override is never anonymous and never unexplained.
        CheckConstraint(
            "override_status IS NULL OR ("
            "override_by IS NOT NULL AND override_at IS NOT NULL "
            "AND override_reason IS NOT NULL AND length(btrim(override_reason)) > 0)",
            name="override_requires_actor_and_reason",
        ),
        # An external result is never stored without its live/simulated label.
        CheckConstraint(
            "external_check_status IS NULL OR external_check_source IS NOT NULL",
            name="external_result_must_declare_source",
        ),
        Index("ix_compliance_results_bid_id", "bid_id"),
        Index("ix_compliance_results_requirement_id", "requirement_id"),
    )


class CrossDocumentFinding(Base):
    """A contradiction between a bidder's own documents, CLAUDE.md §13 / §20.

    Checked *within* each member's own documents. Different companies in a
    consortium legitimately have different names and PANs, so a cross-member
    name difference is not a finding.
    """

    __tablename__ = "cross_document_findings"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )
    bid_member_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bid_members.id", ondelete="SET NULL")
    )

    finding_type: Mapped[str] = mapped_column(String(60), nullable=False)
    severity: Mapped[enums.Severity] = mapped_column(
        _enum(enums.Severity, "severity"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    field_name: Mapped[str | None] = mapped_column(String(80))
    value_a: Mapped[str | None] = mapped_column(Text)
    value_b: Mapped[str | None] = mapped_column(Text)
    segment_a_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("document_segments.id", ondelete="CASCADE")
    )
    segment_b_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("document_segments.id", ondelete="CASCADE")
    )

    # Shown in the UI so a variance is never a bare boolean (CLAUDE.md §9).
    similarity_score: Mapped[float | None] = mapped_column(Float)
    normalization_steps: Mapped[dict | None] = mapped_column(JSONB)

    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_reason: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        CheckConstraint(
            "resolved_at IS NULL OR ("
            "resolved_by IS NOT NULL AND resolution_reason IS NOT NULL "
            "AND length(btrim(resolution_reason)) > 0)",
            name="resolution_requires_actor_and_reason",
        ),
        Index("ix_cross_document_findings_bid_id", "bid_id"),
    )


class RiskFlag(Base):
    """One counted red flag, CLAUDE.md §10. The UI always lists which fired."""

    __tablename__ = "risk_flags"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    category: Mapped[str | None] = mapped_column(String(60))
    severity: Mapped[enums.Severity] = mapped_column(
        _enum(enums.Severity, "severity"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # What made it fire, so the flag is traceable rather than asserted.
    evidence_refs: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        UniqueConstraint("bid_id", "code", name="uq_risk_flags_bid_id_code"),
        Index("ix_risk_flags_bid_id", "bid_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Verification runs
# ─────────────────────────────────────────────────────────────────────────────
class VerificationRun(Base):
    """One run of the verification pipeline over one bid — the progress row.

    CLAUDE.md §3: background work runs as FastAPI ``BackgroundTasks`` with
    progress written here for the frontend to poll. This table says *how far
    along* a run is; what each adapter actually returned lives in
    ``portal_checks``.
    """

    __tablename__ = "verification_runs"

    id: Mapped[uuid.UUID] = uuid_pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )

    status: Mapped[enums.VerificationRunStatus] = mapped_column(
        _enum(enums.VerificationRunStatus, "verification_run_status"),
        nullable=False,
        default=enums.VerificationRunStatus.QUEUED,
        server_default=text("'queued'"),
    )
    # Streamed to the officer per adapter rather than as a spinner (§11).
    phase: Mapped[str | None] = mapped_column(String(60))
    progress_completed: Mapped[int | None] = mapped_column(Integer)
    progress_total: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime] = created_at_col()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "progress_completed IS NULL OR progress_completed >= 0",
            name="progress_completed_non_negative",
        ),
        CheckConstraint(
            "progress_total IS NULL OR progress_completed IS NULL "
            "OR progress_completed <= progress_total",
            name="progress_within_total",
        ),
        Index("ix_verification_runs_bid_id", "bid_id"),
    )


class PortalCheck(Base):
    """One call to one verification adapter — the ``VerificationResult`` of §8.

    Named to match ``PortalCheck`` in architecture.md §7. Split out from
    ``verification_runs`` so that ``source`` can be a plain NOT NULL column
    rather than a conditional CHECK: CLAUDE.md §2 rule 2 says the field is
    "never omitted, never hidden", and a column that is NOT NULL for every row
    in the table says that far more plainly than a constraint predicated on a
    discriminator.

    A ``status`` of ``unavailable`` maps to ``ComplianceStatus.UNVERIFIED``,
    never to ``NON_COMPLIANT``. A portal being down must never cost a bidder
    their tender.
    """

    __tablename__ = "portal_checks"

    id: Mapped[uuid.UUID] = uuid_pk()
    # Bidder-scoped, per architecture.md §7.
    bid_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE"), nullable=False
    )
    # Which member's identifier was looked up. NULL for a sole bid.
    bid_member_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bid_members.id", ondelete="SET NULL")
    )
    # Which requirement prompted the lookup, and which run it belonged to.
    requirement_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("requirements.id", ondelete="CASCADE")
    )
    verification_run_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("verification_runs.id", ondelete="SET NULL")
    )

    portal_id: Mapped[str] = mapped_column(String(40), nullable=False)
    identifier: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[enums.VerificationResultStatus] = mapped_column(
        _enum(enums.VerificationResultStatus, "verification_result_status"), nullable=False
    )

    # Never omitted, never hidden. Rendered in the UI and printed in every
    # export (CLAUDE.md §2 rule 2).
    source: Mapped[enums.VerificationSource] = mapped_column(
        _enum(enums.VerificationSource, "verification_source"), nullable=False
    )

    data: Mapped[dict | None] = mapped_column(JSONB)
    raw_response_hash: Mapped[str | None] = mapped_column(String(64))
    retrieved_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        Index("ix_portal_checks_bid_id", "bid_id"),
        Index("ix_portal_checks_verification_run_id", "verification_run_id"),
        Index("ix_portal_checks_portal_id_identifier", "portal_id", "identifier"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Audit
# ─────────────────────────────────────────────────────────────────────────────
class AuditEvent(Base):
    """Append-only, hash-chained. CLAUDE.md §2 rule 6 and §6.

    ``prev_hash`` and ``row_hash`` are populated by a BEFORE INSERT trigger, and
    UPDATE / DELETE / TRUNCATE are rejected by further triggers. All of that is
    installed in the first migration, so tamper-evidence does not depend on
    application discipline.
    """

    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    # Chain order. The trigger reads the highest seq to find the previous link.
    # GENERATED ALWAYS: the application cannot choose its own position in the
    # chain, so ordering is the database's to assign.
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=True), nullable=False, unique=True)

    tender_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenders.id", ondelete="RESTRICT")
    )
    bid_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="RESTRICT")
    )
    requirement_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("requirements.id", ondelete="RESTRICT")
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("documents.id", ondelete="RESTRICT")
    )

    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    actor_type: Mapped[enums.ActorType] = mapped_column(
        _enum(enums.ActorType, "actor_type"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    actor_component: Mapped[str | None] = mapped_column(String(60))

    previous_state: Mapped[str | None] = mapped_column(String(40))
    new_state: Mapped[str | None] = mapped_column(String(40))
    reason: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    input_hash: Mapped[str | None] = mapped_column(String(64))

    # Model attributability, CLAUDE.md §7.6 and §17.
    llm_provider: Mapped[str | None] = mapped_column(String(40))
    llm_model_id: Mapped[str | None] = mapped_column(String(120))
    llm_role: Mapped[str | None] = mapped_column(String(20))

    # Written by the trigger, not by the application.
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    row_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    created_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        CheckConstraint(
            "(actor_type <> 'officer') OR (actor_id IS NOT NULL)",
            name="officer_events_name_the_officer",
        ),
        Index("ix_audit_events_bid_id", "bid_id"),
        Index("ix_audit_events_tender_id", "tender_id"),
        Index("ix_audit_events_created_at", "created_at"),
    )


class Report(Base):
    """A generated evaluation report, CLAUDE.md §6.

    ``audit_chain_head`` records the row_hash at the head of the chain when the
    report was produced, so the export is pinned to a verifiable point in the
    audit history.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = uuid_pk()
    tender_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenders.id", ondelete="CASCADE")
    )
    bid_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bids.id", ondelete="CASCADE")
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    audit_chain_head: Mapped[str | None] = mapped_column(String(64))
    # Whether any simulated result appears in this report (CLAUDE.md §2 rule 2).
    contains_simulated_results: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    generated_at: Mapped[datetime] = created_at_col()

    __table_args__ = (
        CheckConstraint(
            "(tender_id IS NOT NULL)::int + (bid_id IS NOT NULL)::int >= 1",
            name="report_has_a_subject",
        ),
        Index("ix_reports_bid_id", "bid_id"),
        Index("ix_reports_tender_id", "tender_id"),
    )
