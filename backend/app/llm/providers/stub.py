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
    RequirementDraft,
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
    "ca_turnover_certificate": [
        ("legal_name", _p(r"(?P<span>Name of Entity\s*:\s*(?P<value>.+))")),
        ("pan", _p(rf"(?P<span>Permanent Account Number\s*:\s*(?P<value>{_PAN}))")),
        ("turnover_fy1", _p(rf"(?P<span>FY 2023-24\s*:\s*(?P<value>{_AMOUNT}))")),
        ("turnover_fy2", _p(rf"(?P<span>FY 2022-23\s*:\s*(?P<value>{_AMOUNT}))")),
        ("turnover_fy3", _p(rf"(?P<span>FY 2021-22\s*:\s*(?P<value>{_AMOUNT}))")),
    ],
    "iso_certificate": [
        ("certificate_number", _p(r"(?P<span>Certificate Number\s*:\s*(?P<value>\S+))")),
        ("legal_name", _p(r"(?P<span>Name of Organisation\s*:\s*(?P<value>.+))")),
        ("standard", _p(r"(?P<span>Standard\s*:\s*(?P<value>.+))")),
        ("valid_until", _p(rf"(?P<span>Valid Until\s*:\s*(?P<value>{_DATE}))")),
    ],
    "oem_authorisation": [
        ("oem_name", _p(r"(?P<span>Issued By OEM\s*:\s*(?P<value>.+))")),
        ("legal_name", _p(r"(?P<span>Authorised Party\s*:\s*(?P<value>.+))")),
        ("product_scope", _p(r"(?P<span>Product Scope\s*:\s*(?P<value>.+))")),
        ("valid_until", _p(rf"(?P<span>Valid Until\s*:\s*(?P<value>{_DATE}))")),
    ],
    "technical_datasheet": [
        ("model", _p(r"(?P<span>Model\s*:\s*(?P<value>\S+))")),
        ("rated_throughput_tpd", _p(r"(?P<span>Rated Throughput\s*:\s*(?P<value>\d+)\s*TPD)")),
        # Wraps across three lines; the prose spec (REQ-010) is judged, not measured.
        (
            "material_of_construction",
            _p(r"(?P<span>Material of Construction\s*:\s*(?P<value>.+))", re.DOTALL),
        ),
    ],
    "declaration_non_blacklisting": [
        ("legal_name", _p(r"(?P<span>Name of Bidder\s*:\s*(?P<value>.+))")),
        ("pan", _p(rf"(?P<span>Permanent Account Number\s*:\s*(?P<value>{_PAN}))")),
        ("declaration_signed", _p(r"(?P<span>Declaration Signed\s*:\s*(?P<value>Yes|No))")),
        ("declaration_date", _p(rf"(?P<span>Date of Declaration\s*:\s*(?P<value>{_DATE}))")),
    ],
    "emd_instrument": [
        ("legal_name", _p(r"(?P<span>Applicant\s*:\s*(?P<value>.+))")),
        ("instrument_type", _p(r"(?P<span>Instrument Type\s*:\s*(?P<value>.+))")),
        ("emd_amount", _p(rf"(?P<span>EMD Amount\s*:\s*(?P<value>{_AMOUNT}))")),
        ("valid_until", _p(rf"(?P<span>Valid Until\s*:\s*(?P<value>{_DATE}))")),
    ],
    "holding_company_undertaking": [
        ("legal_name", _p(r"(?P<span>Bidding Entity\s*:\s*(?P<value>.+))")),
        ("holding_company_name", _p(r"(?P<span>Holding Company\s*:\s*(?P<value>.+))")),
        ("shareholding_percent", _p(r"(?P<span>Shareholding\s*:\s*(?P<value>\d+)\s*percent)")),
        ("board_resolution_ref", _p(r"(?P<span>Board Resolution Reference\s*:\s*(?P<value>\S+))")),
    ],
    "financial_statement": [
        ("legal_name", _p(r"(?P<span>Name of (?:Entity|Company)\s*:\s*(?P<value>.+))")),
        ("turnover_fy1", _p(rf"(?P<span>FY\s?20\d\d-\d\d\s*:\s*(?P<value>{_AMOUNT}))")),
    ],
    "epfo_certificate": [
        (
            "epfo_reg_number",
            _p(r"(?P<span>EPFO Registration Number\s*:\s*(?P<value>[A-Z]{2}/[A-Z]{3}/\d{6}))"),
        ),
        ("legal_name", _p(r"(?P<span>Name of Establishment\s*:\s*(?P<value>.+))")),
        ("establishment_type", _p(r"(?P<span>Type of Establishment\s*:\s*(?P<value>.+))")),
        ("registration_date", _p(rf"(?P<span>Date of Registration\s*:\s*(?P<value>{_DATE}))")),
        ("valid_until", _p(rf"(?P<span>Valid Until\s*:\s*(?P<value>{_DATE}))")),
    ],
    "esic_certificate": [
        (
            "esic_reg_number",
            _p(r"(?P<span>ESIC Registration Number\s*:\s*(?P<value>\d{6,10}))"),
        ),
        ("legal_name", _p(r"(?P<span>Name of Employer\s*:\s*(?P<value>.+))")),
        ("registration_date", _p(rf"(?P<span>Date of Registration\s*:\s*(?P<value>{_DATE}))")),
        ("valid_until", _p(rf"(?P<span>Valid Until\s*:\s*(?P<value>{_DATE}))")),
    ],
    "local_content_certificate": [
        ("legal_name", _p(r"(?P<span>Name of Supplier\s*:\s*(?P<value>.+))")),
        (
            "local_content_percent",
            _p(r"(?P<span>Local Content Percentage\s*:\s*(?P<value>\d+)\s*percent)"),
        ),
        ("declaration_date", _p(rf"(?P<span>Date of Declaration\s*:\s*(?P<value>{_DATE}))")),
    ],
}


# Keyword rules for page classification. First match wins, so order matters.
CLASSIFY_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "holding_company_undertaking",
        re.compile(r"letter of undertaking|holding company", re.I),
    ),
    ("ca_turnover_certificate", re.compile(r"statement of turnover|chartered accountant", re.I)),
    ("iso_certificate", re.compile(r"iso 9001|quality management system", re.I)),
    ("oem_authorisation", re.compile(r"manufacturer's authorisation|authorised party", re.I)),
    ("technical_datasheet", re.compile(r"technical datasheet|rated throughput", re.I)),
    ("declaration_non_blacklisting", re.compile(r"non-blacklisting|not blacklisted", re.I)),
    ("emd_instrument", re.compile(r"earnest money deposit|bank guarantee", re.I)),
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
    (
        "epfo_certificate",
        re.compile(r"employees. provident fund|epfo|pf registration", re.I),
    ),
    (
        "esic_certificate",
        re.compile(r"employees. state insurance|esic", re.I),
    ),
    (
        "local_content_certificate",
        re.compile(r"local content", re.I),
    ),
]


CLAUSE_HEADING = re.compile(
    r"^(?P<clause>\d+\.\d+)\s{1,3}(?P<title>[A-Z][^\n]{3,80})$", re.MULTILINE
)

_LABELS = ("Applicability", "Documents Required", "Mandatory", "Weight")

# Detail-text signals -> document types that could satisfy the criterion. This
# is the vocabulary routing looks up (§21), and a lookup cannot hallucinate.
_DOC_TYPE_WORDS: list[tuple[str, str]] = [
    ("certificate of incorporation", "incorporation_certificate"),
    ("audited financial", "financial_statement"),
    ("turnover certificate", "ca_turnover_certificate"),
    ("gst registration certificate", "gst_certificate"),
    ("pan card", "pan_card"),
    ("work order", "work_order"),
    ("completion certificate", "work_order"),
    ("udyam", "udyam_certificate"),
    ("oem authorisation", "oem_authorisation"),
    ("iso 9001", "iso_certificate"),
    ("technical datasheet", "technical_datasheet"),
    ("emd", "emd_instrument"),
    ("exemption declaration", "emd_instrument"),
    ("non-blacklisting", "declaration_non_blacklisting"),
    ("local content", "local_content_certificate"),
    ("provident fund", "epfo_certificate"),
    ("epfo", "epfo_certificate"),
    ("employees. state insurance", "esic_certificate"),
    ("esic", "esic_certificate"),
]

# Clauses that bind across the whole submission rather than to one document
# type — certificate validity, name/ID consistency. ANY_DOCUMENT_TYPE routes
# them to every segment instead of to none (§21).
ANY_DOCUMENT_TYPE = "*"
_ALL_DOCUMENT_PHRASES = ("all submitted", "all documents", "all certificates")

_SCOPES = [
    ("each consortium member", "all_members"),
    ("all consortium members", "all_members"),
    ("any consortium member", "any_member"),
    ("prime bidder", "lead_only"),
    ("combined", "aggregate"),
    ("aggregate", "aggregate"),
]

_EXTERNAL = [
    ("gst", "gstn"),
    ("udyam", "udyam"),
    ("msme", "udyam"),
    ("permanent account number", "pan"),
    ("blacklist", "blacklist"),
    ("debarred", "blacklist"),
    ("companies act", "mca21"),
]

_AMOUNT_IN_TEXT = re.compile(r"Rs\.?\s?([\d,]{4,})")
_YEARS = re.compile(r"(\d+)\s+(?:financial\s+)?years?")
_PERCENT = re.compile(r"(\d+)\s*percent")
_TPD = re.compile(r"(\d+)\s*TPD")


def _next_clause_start(text: str, after: int) -> int:
    nxt = CLAUSE_HEADING.search(text, after)
    return nxt.start() if nxt else len(text)


def _page_of(text: str, position: int) -> int:
    page = 1
    for match in PAGE_MARKER.finditer(text):
        if match.start() > position:
            break
        page = int(match.group(1))
    return page


def _labelled(body: str, label: str | None) -> str:
    """One labelled line's text, or the detail paragraph when label is None."""
    if label is None:
        lines = []
        for raw in body.splitlines():
            line = raw.strip()
            if not line:
                continue
            if any(line.startswith(f"{lab}:") for lab in _LABELS):
                break
            lines.append(line)
        return " ".join(lines)
    marker = f"{label}:"
    for raw in body.splitlines():
        line = raw.strip()
        if marker not in line:
            continue
        # A PQ row packs two labels onto one line: "Mandatory: Yes  Weight: 0".
        # Search anywhere in the line, then cut at whichever label comes next.
        value = line.split(marker, 1)[1]
        for other in _LABELS:
            if other != label and f"{other}:" in value:
                value = value.split(f"{other}:")[0]
        return value.strip()
    return ""


_REQUIRED_FIELDS_BY_CONDITION: dict[str, list[str]] = {
    "average_annual_turnover": ["turnover_fy1", "turnover_fy2", "turnover_fy3"],
    "order_value": ["order_value", "completion_date"],
    "incorporation_date": ["incorporation_date", "legal_name"],
    "rated_throughput_tpd": ["rated_throughput_tpd"],
    "local_content_percent": ["local_content_percent"],
    "emd_amount": ["emd_amount"],
    "valid_until": ["valid_until"],
}

_DOC_TYPE_REQUIRED_FIELDS: dict[str, list[str]] = {
    "gst_certificate": ["gstin", "legal_name"],
    "pan_card": ["pan", "legal_name"],
    "udyam_certificate": ["udyam_urn", "enterprise_name"],
    "incorporation_certificate": ["cin", "legal_name", "incorporation_date"],
    "work_order": ["order_value", "completion_date", "work_description"],
    "ca_turnover_certificate": ["turnover_fy1", "turnover_fy2", "turnover_fy3"],
    "iso_certificate": ["valid_until"],
    "oem_authorisation": ["valid_until", "oem_name"],
    "technical_datasheet": ["rated_throughput_tpd", "material_of_construction"],
    "declaration_non_blacklisting": ["declaration_signed"],
    "emd_instrument": ["emd_amount"],
    "epfo_certificate": ["valid_until"],
    "esic_certificate": ["valid_until"],
    "local_content_certificate": ["local_content_percent"],
}


def _required_fields_for(condition: dict | None, doc_types: list[str]) -> list[str]:
    if condition and isinstance(condition.get("field"), str):
        mapped = _REQUIRED_FIELDS_BY_CONDITION.get(condition["field"])
        if mapped:
            return mapped
    # Fallback: derive from document types if no arithmetic condition
    fields: list[str] = []
    for dt in doc_types:
        if dt == ANY_DOCUMENT_TYPE:
            continue
        fields.extend(_DOC_TYPE_REQUIRED_FIELDS.get(dt, []))
    # Deduplicate preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for f in fields:
        if f not in seen:
            seen.add(f)
            deduped.append(f)
    return deduped


def _scope_for(applicability: str) -> str:
    lowered = applicability.lower()
    for needle, scope in _SCOPES:
        if needle in lowered:
            return scope
    # The stricter reading is the safe error (CLAUDE.md §20).
    return "lead_only"


def _doc_types_for(documents: str) -> list[str]:
    lowered = documents.lower()
    if any(phrase in lowered for phrase in _ALL_DOCUMENT_PHRASES):
        return [ANY_DOCUMENT_TYPE]
    return sorted({dt for needle, dt in _DOC_TYPE_WORDS if needle in lowered})


def _external_check_for(title: str, detail: str) -> str | None:
    lowered = f"{title} {detail}".lower()
    if "identical across all" in lowered or "consistency" in lowered:
        # Answered by comparing the bidder's own documents, not by a portal.
        return None
    for needle, portal in _EXTERNAL:
        if needle in lowered:
            return portal
    return None


def _category_for(title: str, detail: str) -> str:
    lowered = f"{title} {detail}".lower()
    if "turnover" in lowered or "financial" in lowered:
        return "financial_eligibility"
    if "experience" in lowered or "similar work" in lowered:
        return "experience"
    if "technical" in lowered or "specification" in lowered:
        return "technical"
    if "declaration" in lowered or "blacklist" in lowered:
        return "declarations"
    if "emd" in lowered or "earnest" in lowered:
        return "bid_security"
    return "statutory"


def _condition_for(detail: str) -> dict | None:
    """The machine-checkable part of a clause, where there is one.

    Deliberately conservative. A clause whose numeric content cannot be read
    confidently yields no condition at all, which routes it to human judgement
    rather than to a rule evaluated on a guess.
    """
    lowered = detail.lower()
    amount = _AMOUNT_IN_TEXT.search(detail)
    years = _YEARS.search(lowered)

    if "turnover" in lowered and amount:
        condition = {
            "field": "average_annual_turnover",
            "operator": ">=",
            "threshold": int(amount.group(1).replace(",", "")),
            "unit": "INR",
        }
        if years:
            condition["period_years"] = int(years.group(1))
        return condition

    if ("similar work" in lowered or "experience" in lowered) and amount:
        condition = {
            "field": "order_value",
            "operator": ">=",
            "threshold": int(amount.group(1).replace(",", "")),
            "unit": "INR",
            "min_count": 1,
        }
        if years:
            condition["within_years"] = int(years.group(1))
        return condition

    if "continuous operation" in lowered and years:
        return {
            "field": "incorporation_date",
            "operator": "min_years_before_due_date",
            "threshold": int(years.group(1)),
        }

    tpd = _TPD.search(detail)
    if tpd:
        return {
            "field": "rated_throughput_tpd",
            "operator": ">=",
            "threshold": int(tpd.group(1)),
            "unit": "TPD",
        }

    percent = _PERCENT.search(lowered)
    if percent and "local content" in lowered:
        return {
            "field": "local_content_percent",
            "operator": ">=",
            "threshold": int(percent.group(1)),
            "unit": "percent",
        }

    if amount and "emd" in lowered:
        return {
            "field": "emd_amount",
            "operator": ">=",
            "threshold": int(amount.group(1).replace(",", "")),
            "unit": "INR",
        }

    # "valid ... as on the bid due date", "current authorisation ... valid as on",
    # "shall be valid" — one exact phrase would miss most real wordings.
    if "valid" in lowered and ("due date" in lowered or "expir" in lowered):
        return {"field": "valid_until", "operator": "not_expired_at_due_date"}

    return None


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
    def is_offline(self) -> bool:
        """No network, ever. A test that reaches the network is a broken test."""
        return True

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

    # ── Requirement extraction (layer 1) ─────────────────────────────────
    def extract_requirements(self, doc: DocumentInput) -> RequirementSet:
        """Parse a pre-qualification table into structured requirement drafts.

        Targets the row grammar a section-6 PQ table flattens to: a numbered
        clause and title, a detail paragraph, then labelled Applicability,
        Documents Required, Mandatory and Weight lines. The applicability
        column is read rather than assumed — CLAUDE.md §20 notes real tenders
        state it per criterion, and guessing would silently mis-scope every
        consortium evaluation.

        Everything produced here is a *draft*. Nothing is evaluated against it
        until an officer confirms the checklist (§11).
        """
        text = doc.text or ""
        drafts: list[RequirementDraft] = []

        for index, match in enumerate(CLAUSE_HEADING.finditer(text), start=1):
            clause, title = match.group("clause"), match.group("title").strip()
            body = text[match.end() : _next_clause_start(text, match.end())]

            detail = _labelled(body, None)
            applicability = _labelled(body, "Applicability")
            documents = _labelled(body, "Documents Required")
            mandatory = _labelled(body, "Mandatory")
            weight = _labelled(body, "Weight")

            # Only headings that look like a PQ criterion row have the labelled
            # block. Without this filter every "1.1 Content of the RFP" heading
            # in Volume-I (103 pages of scope) becomes a fake requirement —
            # that's why RFP Volume 1.pdf was producing 52 junk items.
            # A real PQ row always carries Applicability + Documents Required;
            # generic TOC headings have neither.
            if not applicability and not documents:
                continue
            if not detail:
                continue

            condition = _condition_for(detail)
            doc_types = _doc_types_for(documents)
            drafts.append(
                RequirementDraft(
                    code=f"REQ-{index:03d}",
                    name=title,
                    category=_category_for(title, detail),
                    raw_clause=f"{clause} {title}. {detail}".strip(),
                    normalized_clause=detail or title,
                    condition=condition,
                    mandatory=(mandatory or "yes").strip().lower().startswith("y"),
                    weight=float(weight) if weight.strip().isdigit() else 0.0,
                    applicability_scope=_scope_for(applicability),
                    accepts_document_types=doc_types,
                    required_fields=_required_fields_for(condition, doc_types),
                    external_check=_external_check_for(title, detail),
                    source_page=_page_of(text, match.start()),
                    source_clause_ref=clause,
                    confidence=0.86 if applicability else 0.55,
                )
            )

        return RequirementSet(requirements=drafts, provenance=self._provenance(LLMRole.REASONING))

    def judge(self, requirement: str, evidence: list[dict]) -> JudgmentResult:
        # In stub mode we still produce a human-readable advisory so the
        # compliance ledger and tests show *why* prose goes to review.
        if evidence:
            fields = ", ".join(str(e.get("field_name") or e.get("name") or "") for e in evidence[:3] if isinstance(e, dict))
            reasoning = (
                f"This requirement is worded as a judgement rather than a measurement, so it was "
                f"referred to you by policy. The submitted evidence includes {fields or 'relevant fields'} "
                f"related to '{requirement[:80]}'."
            )
            cited = [str(e.get("field_name") or "") for e in evidence[:2] if isinstance(e, dict) and e.get("field_name")]
        else:
            reasoning = (
                f"This requirement is worded as a judgement rather than a measurement, so it was "
                f"referred to you by policy. No relevant evidence was extracted for '{requirement[:80]}'."
            )
            cited = []
        return JudgmentResult(
            status="NEEDS_HUMAN_REVIEW",
            confidence=0.45,
            reasoning=reasoning,
            cited_field_names=[c for c in cited if c],
            provenance=self._provenance(LLMRole.REASONING),
        )

    def narrate(self, results: list[dict]) -> Recommendation:
        return Recommendation(
            summary="StubProvider does not generate narrative.",
            action="MANUAL_REVIEW_REQUIRED",
            cited_requirement_codes=[],
            provenance=self._provenance(LLMRole.REASONING),
        )
