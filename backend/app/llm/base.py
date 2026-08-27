"""The provider interface. CLAUDE.md §7.1."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.llm.types import (
    DocumentInput,
    ExtractionResult,
    JudgmentResult,
    LLMRole,
    PageClassification,
    Recommendation,
    RequirementSet,
)


@runtime_checkable
class LLMProvider(Protocol):
    """Every provider implements exactly this. Callers know nothing else."""

    name: str

    @property
    def is_offline(self) -> bool:
        """Whether this provider makes no network call at all.

        Rate limiting exists to stay under a published API cap. A provider with
        no API has no cap, and throttling it only makes the test suite slow.
        """
        ...

    @property
    def supports_native_documents(self) -> bool:
        """Whether this provider accepts PDFs and images without a separate OCR step.

        Callers never read this. The provider layer does, to decide whether to
        populate ``DocumentInput.text`` before calling out (§7.1).
        """
        ...

    def model_id_for(self, role: LLMRole) -> str: ...

    def extract_requirements(self, doc: DocumentInput) -> RequirementSet: ...

    def extract_evidence(
        self, doc: DocumentInput, schema: dict, doc_type: str
    ) -> ExtractionResult: ...

    def judge(self, requirement: str, evidence: list[dict]) -> JudgmentResult: ...

    def narrate(self, results: list[dict]) -> Recommendation: ...

    def classify_pages(self, doc: DocumentInput) -> list[PageClassification]: ...


class LLMError(Exception):
    """A provider could not produce a usable result.

    Callers respond by routing the affected requirement to
    ``NEEDS_HUMAN_REVIEW`` — never by crashing, and never by guessing (§7.6).
    """
