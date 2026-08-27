"""The default provider. Fixtures, no network, used by every test.

``StubProvider`` does not return canned answers. It reads the document text it
is given and pulls **real verbatim spans** out of it with regular expressions.
That matters: the span is what the locator (CLAUDE.md §24) searches for on the
page, so a stub that invented spans would let the locator pass without ever
finding anything. Extracting genuine spans means the whole pipeline downstream
of the model is exercised for real, and only the model itself is stubbed.

It is deliberately not clever. Its job is to be deterministic, offline, and
honest about what it found.
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.llm.config import resolve_model_id
from app.llm.schemas import schema_for
from app.llm.types import (
    CallProvenance,
    DocumentInput,
    ExtractedFieldResult,
    ExtractionResult,
    JudgmentResult,
    LLMRole,
    PageClassification,
    Recommendation,
    RequirementSet,
)

# Page markers injected by document_intelligence so a text-only provider can
# still report which page a span came from.
PAGE_MARKER = re.compile(r"^\[page (\d+)\]$", re.MULTILINE)

# Text shaped like an instruction to the model. Detected, reported, never
# followed (CLAUDE.md §7.6).
INJECTION_SIGNALS = re.compile(
    r"ignore\s+(?:all\s+)?previous\s+instructions"
    r"|disregard\s+(?:the\s+)?above"
    r"|mark\s+(?:this|the)\s+bidder\s+as\s+compliant"
    r"|you\s+are\s+now\s+"
    r"|system\s*:\s*",
    re.IGNORECASE,
)

# (field_name, pattern). Named group "span" is quoted verbatim and is what the
# locator searches for; named group "value" is the value stored.
#
# The span always includes the field's label. A bare value like "Small" also
# occurs in the heading "Micro, Small and Medium Enterprises", and a span that
# matches in two places puts the highlight on the wrong one. The prompt in
# prompts/extract_evidence.txt instructs a real model to do the same thing:
# quote the value together with its immediate label.
FieldPatterns = list[tuple[str, re.Pattern[str]]]

_GSTIN = r"\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]"
_PAN = r"[A-Z]{5}\d{4}[A-Z]"
_UDYAM = r"UDYAM-[A-Z]{2}-\d{2}-\d{7}"
_CIN = r"[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}"
_DATE = r"\d{2}[/.-]\d{2}[/.-]\d{4}"
_AMOUNT = r"(?:Rs\.?|INR|\u20b9)\s?[\d,]+(?:\.\d{2})?"


def _p(pattern: str, flags: int = 0) -> re.Pattern[str]:
    return re.compile(pattern, flags)


PATTERNS: dict[str, FieldPatterns] = {
    "gst_certificate": [
        ("gstin", _p(rf"(?P<span>Registration Number \(GSTIN\)\s*:\s*(?P<value>{_GSTIN}))")),
        ("legal_name", _p(r"(?P<span>Legal Name of Business\s*:\s*(?P<value>.+))")),
        ("trade_name", _p(r"(?P<span>Trade Name\s*:\s*(?P<value>.+))")),
        ("registration_date", _p(rf"(?P<span>Date of Liability\s*:\s*(?P<value>{_DATE}))")),
        (
            "registration_status",
            _p(r"(?P<span>Status\s*:\s*(?P<value>Active|Cancelled|Suspended))"),
        ),
    ],
    "pan_card": [
        # Label and value sit on separate lines here, so this span wraps — which
        # is what produces per-line rectangles rather than one union box.
        ("pan", _p(rf"(?P<span>Permanent Account Number\s+(?P<value>{_PAN}))")),
        ("legal_name", _p(r"(?P<span>Name\s*:\s*(?P<value>.+))")),
    ],
    "udyam_certificate": [
        ("udyam_urn", _p(rf"(?P<span>Udyam Registration Number\s*:\s*(?P<value>{_UDYAM}))")),
        ("enterprise_name", _p(r"(?P<span>Name of Enterprise\s*:\s*(?P<value>.+))")),
        (
            "enterprise_type",
            _p(r"(?P<span>Type of Enterprise\s*:\s*(?P<value>Micro|Small|Medium))"),
        ),
        (
            "registration_date",
            _p(rf"(?P<span>Date of Udyam Registration\s*:\s*(?P<value>{_DATE}))"),
        ),
    ],
    "incorporation_certificate": [
        ("cin", _p(rf"(?P<span>Corporate Identity Number\s*:\s*(?P<value>{_CIN}))")),
        ("legal_name", _p(r"(?P<span>Name of Company\s*:\s*(?P<value>.+))")),
        ("incorporation_date", _p(rf"(?P<span>Date of Incorporation\s*:\s*(?P<value>{_DATE}))")),
    ],
    "work_order": [
        ("order_number", _p(r"(?P<span>Work Order No\.\s*:\s*(?P<value>\S+))")),
        ("order_value", _p(rf"(?P<span>Order Value\s*:\s*(?P<value>{_AMOUNT}))")),
        ("client_name", _p(r"(?P<span>Awarded By\s*:\s*(?P<value>.+))")),
        ("completion_date", _p(rf"(?P<span>Date of Completion\s*:\s*(?P<value>{_DATE}))")),
        # Deliberately spans lines: a wrapped description exercises the
        # per-line rectangles in the locator (§24).
        ("work_description", _p(r"(?P<span>Description of Work\s*:\s*(?P<value>.+))", re.DOTALL)),
    ],
    "financial_statement": [
        ("legal_name", _p(r"(?P<span>Name of (?:Entity|Company)\s*:\s*(?P<value>.+))")),
        ("turnover_fy1", _p(rf"(?P<span>FY\s?20\d\d-\d\d\s*:\s*(?P<value>{_AMOUNT}))")),
    ],
}


# Keyword rules for page classification. First match wins, so order matters.
CLASSIFY_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("gst_certificate", re.compile(r"goods and services tax|gstin", re.I)),
    ("udyam_certificate", re.compile(r"udyam|micro,?\s*small", re.I)),
    (
        "incorporation_certificate",
        re.compile(r"certificate of incorporation|registrar of companies", re.I),
    ),
    ("pan_card", re.compile(r"permanent account number|income tax department", re.I)),
    ("work_order", re.compile(r"work order|completion certificate|purchase order", re.I)),
    (
        "financial_statement",
        re.compile(r"balance sheet|profit and loss|turnover|chartered accountant", re.I),
    ),
]


def _page_spans(text: str) -> list[tuple[int, int, int]]:
    """``(page_number, body_start, body_end)`` for each page marker in the text."""
    marks = [(int(m.group(1)), m.end()) for m in PAGE_MARKER.finditer(text)]
    if not marks:
        return [(1, 0, len(text))]
    spans = []
    for i, (page, start) in enumerate(marks):
        end = (
            marks[i + 1][1] - len(f"[page {marks[i + 1][0]}]") if i + 1 < len(marks) else len(text)
        )
        spans.append((page, start, end))
    return spans


class StubProvider:
    """Deterministic, offline, fixture-driven. The default (CLAUDE.md §7.2)."""

    name: ClassVar[str] = "stub"

    @property
    def supports_native_documents(self) -> bool:
        """False, so the OCR fallback path in the provider layer is exercised by
        the default provider rather than only by a provider nobody runs in CI."""
        return False

    def model_id_for(self, role: LLMRole) -> str:
        return resolve_model_id(self.name, role)

    def _provenance(self, role: LLMRole) -> CallProvenance:
        return CallProvenance(provider=self.name, model_id=self.model_id_for(role), role=str(role))

    # ── Evidence extraction (layer 3) ────────────────────────────────────
    def extract_evidence(self, doc: DocumentInput, schema: dict, doc_type: str) -> ExtractionResult:
        text = doc.text or ""
        requested = set(schema or schema_for(doc_type))
        fields: list[ExtractedFieldResult] = []
        seen: set[str] = set()

        for page, start, end in _page_spans(text):
            body = text[start:end]
            for field_name, pattern in PATTERNS.get(doc_type, []):
                if field_name in seen or (requested and field_name not in requested):
                    continue
                match = pattern.search(body)
                if not match:
                    continue
                span = (match.groupdict().get("span") or match.group(0)).strip()
                value = (match.groupdict().get("value") or span).strip()
                if not span or not value:
                    continue
                seen.add(field_name)
                fields.append(
                    ExtractedFieldResult(
                        field_name=field_name,
                        value=value,
                        # Verbatim, exactly as printed, label included — the
                        # locator's anchor.
                        source_span=span,
                        page=page,
                        confidence=0.92,
                    )
                )

        return ExtractionResult(
            doc_type=doc_type,
            fields=fields,
            injection_suspected=bool(INJECTION_SIGNALS.search(text)),
            provenance=self._provenance(LLMRole.EXTRACTION),
        )

    # ── Page classification (layer 2) ────────────────────────────────────
    def classify_pages(self, doc: DocumentInput) -> list[PageClassification]:
        text = doc.text or ""
        out: list[PageClassification] = []
        previous: str | None = None
        for page, start, end in _page_spans(text):
            body = text[start:end]
            doc_type, confidence = "unclassified", 0.2
            for candidate, rule in CLASSIFY_RULES:
                if rule.search(body):
                    doc_type, confidence = candidate, 0.88
                    break
            if doc_type == "unclassified" and previous is not None:
                # A page with no signals of its own most likely continues the
                # page before it, which is what makes boundaries findable (§19).
                doc_type, confidence = "continuation", 0.4
            else:
                previous = doc_type
            out.append(PageClassification(page=page, doc_type=doc_type, confidence=confidence))
        return out

    # ── Not exercised on Day 2; present so the Protocol is satisfied ─────
    def extract_requirements(self, doc: DocumentInput) -> RequirementSet:
        return RequirementSet(requirements=[], provenance=self._provenance(LLMRole.REASONING))

    def judge(self, requirement: str, evidence: list[dict]) -> JudgmentResult:
        return JudgmentResult(
            status="NEEDS_HUMAN_REVIEW",
            confidence=0.0,
            reasoning="StubProvider does not perform semantic judgement.",
            cited_field_names=[],
            provenance=self._provenance(LLMRole.REASONING),
        )

    def narrate(self, results: list[dict]) -> Recommendation:
        return Recommendation(
            summary="StubProvider does not generate narrative.",
            action="MANUAL_REVIEW_REQUIRED",
            cited_requirement_codes=[],
            provenance=self._provenance(LLMRole.REASONING),
        )
