"""Enumerations backing the schema.

Every one of these is named in CLAUDE.md. They are Postgres native ENUM types
so an invalid value is rejected by the database, not merely by the application.
"""

from __future__ import annotations

import enum


class UserRole(enum.StrEnum):
    """CLAUDE.md §17. Only OFFICER may decide; ADMIN explicitly may not."""

    OFFICER = "officer"
    REVIEWER = "reviewer"
    AUDITOR = "auditor"
    ADMIN = "admin"


class ComplianceStatus(enum.StrEnum):
    """The nine-state machine, CLAUDE.md §5.

    Every requirement x bidder pair holds exactly one of these, and every
    requirement starts at ``MISSING_EVIDENCE``.
    """

    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    PARTIALLY_COMPLIANT = "PARTIALLY_COMPLIANT"
    MISSING_EVIDENCE = "MISSING_EVIDENCE"
    INCONSISTENT = "INCONSISTENT"
    EXPIRED = "EXPIRED"
    # Exists so we never claim a check happened when it didn't.
    UNVERIFIED = "UNVERIFIED"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"


class ApplicabilityScope(enum.StrEnum):
    """Which consortium members a requirement is evaluated against, CLAUDE.md §20.

    For a sole bid every scope collapses to the single member, so the engine
    needs no special-casing.
    """

    LEAD_ONLY = "lead_only"
    ANY_MEMBER = "any_member"
    ALL_MEMBERS = "all_members"
    AGGREGATE = "aggregate"


class BidMemberRole(enum.StrEnum):
    """CLAUDE.md §6. A sole bid has exactly one row, with role ``SOLE``."""

    SOLE = "sole"
    LEAD = "lead"
    MEMBER = "member"


class IngestionMode(enum.StrEnum):
    """How a file was uploaded, CLAUDE.md §19. Chosen by the officer, never inferred."""

    SEPARATE = "separate"
    AUTO_CLASSIFY = "auto_classify"
    MERGED = "merged"


class BoundaryMethod(enum.StrEnum):
    """How a document segment's boundary was established, CLAUDE.md §19."""

    # A single-document upload produces one segment spanning all pages.
    WHOLE_FILE = "whole_file"
    PDF_OUTLINE = "pdf_outline"
    PAGE_CLASSIFICATION = "page_classification"
    BOUNDARY_SIGNALS = "boundary_signals"
    LLM_CONFIRMATION = "llm_confirmation"
    OFFICER_CORRECTED = "officer_corrected"
    # Segmentation failed entirely; the whole file is one unclassified segment.
    FALLBACK_UNSEGMENTED = "fallback_unsegmented"


class LocatorStatus(enum.StrEnum):
    """How an extracted field's bounding box was established.

    A language model reading a PDF natively returns text, not coordinates, but
    ``extracted_fields`` requires a box (CLAUDE.md §6). The locator finds the
    model's quoted span back in the page's own text layer and takes the
    coordinates from there. This column records which rung of that ladder
    succeeded, because it determines whether the stored rectangle is a genuine
    highlight or merely a page to open.

    The last two values mean "not located". A field carrying either of them can
    never support an automatic ``COMPLIANT`` verdict; it routes to
    ``NEEDS_HUMAN_REVIEW`` so the officer reads the value themselves (§21).
    """

    EXACT = "exact"
    NORMALIZED = "normalized"
    FUZZY = "fuzzy"
    OCR = "ocr"
    # Not found in the page text. The box is the whole page the model cited.
    PAGE_FALLBACK = "page_fallback"
    # No usable page either. The box is the segment's first page.
    SEGMENT_FALLBACK = "segment_fallback"


class VerificationRunStatus(enum.StrEnum):
    """Progress of a pipeline run (CLAUDE.md §3)."""

    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class VerificationResultStatus(enum.StrEnum):
    """Outcome of one adapter call, CLAUDE.md §8.

    ``UNAVAILABLE`` maps to ``ComplianceStatus.UNVERIFIED``, never to
    ``NON_COMPLIANT``: a portal being down must never cost a bidder their tender.
    """

    FOUND = "found"
    NOT_FOUND = "not_found"
    INVALID_FORMAT = "invalid_format"
    UNAVAILABLE = "unavailable"


class VerificationSource(enum.StrEnum):
    """CLAUDE.md §2 rule 2: never omitted, never hidden, printed in every export."""

    LIVE = "live"
    SIMULATED = "simulated"


class Severity(enum.StrEnum):
    """Severity of a cross-document finding or a risk flag."""

    INFO = "info"
    WARNING = "warning"
    HIGH = "high"
    CRITICAL = "critical"


class RiskLevel(enum.StrEnum):
    """Bands from CLAUDE.md §10. Always shown alongside the flags that fired."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DecisionOutcome(enum.StrEnum):
    """The officer's decision, CLAUDE.md §11. The only place a decision is made."""

    QUALIFY = "qualify"
    SEEK_CLARIFICATION = "seek_clarification"
    DISQUALIFY = "disqualify"


class RecommendationAction(enum.StrEnum):
    """Advisory only. Sits beside the decision bar, never as a control."""

    RECOMMEND_QUALIFY = "RECOMMEND_QUALIFY"
    SEEK_CLARIFICATION = "SEEK_CLARIFICATION"
    RECOMMEND_DISQUALIFY = "RECOMMEND_DISQUALIFY"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"


class ActorType(enum.StrEnum):
    """Who caused an audit event."""

    SYSTEM = "system"
    OFFICER = "officer"


class TenderStatus(enum.StrEnum):
    """Gate state, CLAUDE.md §11: verification cannot run before confirmation."""

    DRAFT = "draft"
    REQUIREMENTS_EXTRACTED = "requirements_extracted"
    REQUIREMENTS_CONFIRMED = "requirements_confirmed"
    CLOSED = "closed"
