"""Vendor-neutral types crossing the LLM boundary.

Nothing in this module — or anywhere outside ``app/llm/providers/`` — may name a
vendor, an SDK type, or a model ID (CLAUDE.md §7). Switching providers is an
env var change plus one new file.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass

from pydantic import BaseModel, Field


class LLMRole(enum.StrEnum):
    """Model roles, not model names (CLAUDE.md §7.3).

    ``EXTRACTION`` is high-volume and low-difficulty — 36+ calls per pipeline
    run. ``REASONING`` is low-volume and high-difficulty — about five per
    tender. They resolve to different models, and may resolve to different
    providers entirely (§7.8).
    """

    EXTRACTION = "EXTRACTION"
    REASONING = "REASONING"


@dataclass(frozen=True)
class DocumentInput:
    """A document on its way to a provider.

    Carries extracted text *or* raw bytes plus a MIME type. Callers always
    populate ``file_bytes`` when the source is a PDF or an image; if the active
    provider cannot accept documents natively, the provider layer fills in
    ``text`` by running OCR. Callers never branch on provider capability
    (CLAUDE.md §7.1).
    """

    text: str | None = None
    file_bytes: bytes | None = None
    mime_type: str | None = None
    page_range: tuple[int, int] | None = None


@dataclass(frozen=True)
class CallProvenance:
    """Which model produced a result.

    Recorded against every extracted field and every verdict, so a finding
    stays attributable to the exact model that produced it — including after a
    provider switch (CLAUDE.md §7.6).
    """

    provider: str
    model_id: str
    role: str


class ExtractedFieldResult(BaseModel):
    """One field a provider claims to have found.

    ``source_span`` is the anchor the locator uses to recover coordinates
    (CLAUDE.md §24), and it must be **verbatim as printed** — not the
    normalised value. A date stored as ``2024-03-31`` may be printed
    ``31.03.2024``; the span is what appeared on the page.
    """

    field_name: str
    value: str
    source_span: str
    page: int = Field(ge=1)
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractionResult(BaseModel):
    """The result of reading one document segment."""

    doc_type: str
    fields: list[ExtractedFieldResult] = Field(default_factory=list)
    # Raised when the document contains text shaped like an instruction to the
    # model. Recorded and surfaced, never acted on (CLAUDE.md §7.6, §17).
    injection_suspected: bool = False
    # Set by the provider layer, never by the model itself.
    provenance: CallProvenance | None = None

    model_config = {"arbitrary_types_allowed": True}


class PageClassification(BaseModel):
    """What one page appears to be. ``continuation`` means "same document as the
    page before", which is how merged-bundle boundaries are found (§19)."""

    page: int = Field(ge=1)
    doc_type: str
    confidence: float = Field(ge=0.0, le=1.0)


class RequirementDraft(BaseModel):
    """One requirement as the model read it out of the tender.

    A draft, deliberately: nothing is evaluated against it until an officer
    confirms the checklist (CLAUDE.md §11).
    """

    code: str
    name: str
    category: str | None = None
    raw_clause: str | None = None
    normalized_clause: str | None = None
    condition: dict | None = None
    mandatory: bool = True
    weight: float = 0.0
    applicability_scope: str = "lead_only"
    accepts_document_types: list[str] = Field(default_factory=list)
    required_fields: list[str] = Field(default_factory=list)
    external_check: str | None = None
    source_page: int | None = None
    source_clause_ref: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class RequirementSet(BaseModel):
    requirements: list[RequirementDraft] = Field(default_factory=list)
    provenance: CallProvenance | None = None

    model_config = {"arbitrary_types_allowed": True}


class JudgmentResult(BaseModel):
    """A semantic judgement on an inherently prose-based requirement.

    Permitted only where §7.4 allows it. Never for arithmetic, dates, or ID
    comparison — those are the rule engine's, and the rule engine is
    deterministic.
    """

    status: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    cited_field_names: list[str] = Field(default_factory=list)
    provenance: CallProvenance | None = None

    model_config = {"arbitrary_types_allowed": True}


class Recommendation(BaseModel):
    """Officer-facing narrative. Advisory, and labelled as such in the UI."""

    summary: str
    action: str
    cited_requirement_codes: list[str] = Field(default_factory=list)
    provenance: CallProvenance | None = None

    model_config = {"arbitrary_types_allowed": True}


def recommendation_from_payload(
    payload: dict,
    *,
    results: list[dict],
    provenance: CallProvenance,
) -> Recommendation:
    """Build a validated Recommendation, never trusting the model.

    The model chose ``action`` as free text; it is coerced to the fixed
    vocabulary, with anything unknown sent to MANUAL_REVIEW_REQUIRED rather than
    throwing — an unclassifiable narrative still reaches the officer. Cited
    codes that do not exist in the input are dropped, because the rule that
    every claim name a requirement is enforced here, after generation (§7.6).
    """
    valid_actions = {
        "RECOMMEND_QUALIFY",
        "SEEK_CLARIFICATION",
        "RECOMMEND_DISQUALIFY",
        "MANUAL_REVIEW_REQUIRED",
    }
    action = str(payload.get("action") or "").strip().upper()
    if action not in valid_actions:
        action = "MANUAL_REVIEW_REQUIRED"

    known = {str(r.get("code")).strip().upper() for r in results if r.get("code")}
    cited = [str(c) for c in (payload.get("cited_requirement_codes") or []) if str(c) in known]

    return Recommendation(
        summary=str(payload.get("summary") or "").strip(),
        action=action,
        cited_requirement_codes=cited,
        provenance=provenance,
    )
