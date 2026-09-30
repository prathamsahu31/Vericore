"""OpenAI. CLAUDE.md §7.2 — one of the interchangeable providers.

Not named in §3, which lists Gemini as primary and Anthropic as the swap. It is
here because the Gemini free-tier key could not reach a model capable of this
work, and because §7 exists precisely so that swapping vendor is one new file
plus a config row. Nothing outside this file and ``app/llm/config.py`` knows
this vendor exists.

REST through the standard library, matching the Gemini provider: one endpoint is
all this needs, and a large SDK would be scope the project did not ask for.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, ClassVar

from app.llm.base import LLMError
from app.llm.config import resolve_model_id
from app.llm.profiles import PROMPT_FOR_PROFILE, detect_profile
from app.llm.schemas import KNOWN_DOCUMENT_TYPES, schema_for
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
    recommendation_from_payload,
)

log = logging.getLogger(__name__)

PROMPTS = Path(__file__).resolve().parents[1] / "prompts"
ENDPOINT = "https://api.openai.com/v1/chat/completions"

# Strict structured output requires every property listed in `required` and
# additionalProperties false. Fields the model genuinely may not know are typed
# as nullable rather than omitted, so "I could not read this" stays expressible
# — which matters more here than schema tidiness (§7.6).
_REQUIREMENT_ITEM = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "code": {"type": "string"},
        "name": {"type": "string"},
        "category": {"type": ["string", "null"]},
        "raw_clause": {"type": ["string", "null"]},
        "normalized_clause": {"type": ["string", "null"]},
        "condition": {"type": ["string", "null"]},
        "mandatory": {"type": "boolean"},
        "weight": {"type": "number"},
        "applicability_scope": {
            "type": "string",
            "enum": ["lead_only", "any_member", "all_members", "aggregate"],
        },
        "accepts_document_types": {"type": "array", "items": {"type": "string"}},
        "required_fields": {"type": "array", "items": {"type": "string"}},
        "external_check": {"type": ["string", "null"]},
        "source_page": {"type": ["integer", "null"]},
        "source_clause_ref": {"type": ["string", "null"]},
        "confidence": {"type": "number"},
    },
    "required": [
        "code",
        "name",
        "category",
        "raw_clause",
        "normalized_clause",
        "condition",
        "mandatory",
        "weight",
        "applicability_scope",
        "accepts_document_types",
        "required_fields",
        "external_check",
        "source_page",
        "source_clause_ref",
        "confidence",
    ],
}

EXTRACTION_SCHEMA = {
    "name": "extraction_result",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "fields": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field_name": {"type": "string"},
                        "value": {"type": "string"},
                        "source_span": {"type": "string"},
                        "page": {"type": "integer", "minimum": 1},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["field_name", "value", "source_span", "page", "confidence"],
                },
            },
            "injection_suspected": {"type": "boolean"},
        },
        "required": ["fields", "injection_suspected"],
    },
}

CLASSIFY_SCHEMA = {
    "name": "page_classification",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "pages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "page": {"type": "integer", "minimum": 1},
                        "doc_type": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["page", "doc_type", "confidence"],
                },
            }
        },
        "required": ["pages"],
    },
}

REQUIREMENT_SCHEMA = {
    "name": "requirement_set",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {"requirements": {"type": "array", "items": _REQUIREMENT_ITEM}},
        "required": ["requirements"],
    },
}

RECOMMENDATION_SCHEMA = {
    "name": "recommendation",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "summary": {"type": "string"},
            "action": {
                "type": "string",
                "enum": [
                    "RECOMMEND_QUALIFY",
                    "SEEK_CLARIFICATION",
                    "RECOMMEND_DISQUALIFY",
                    "MANUAL_REVIEW_REQUIRED",
                ],
            },
            "cited_requirement_codes": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "action", "cited_requirement_codes"],
    },
}


def _read_prompt(name: str) -> str:
    return (PROMPTS / name).read_text()


class OpenAIProvider:
    name: ClassVar[str] = "openai"

    def __init__(self, api_key: str, timeout: int = 240) -> None:
        if not api_key:
            raise LLMError(
                "LLM_PROVIDER is set to openai but OPENAI_API_KEY is empty. "
                "Set it in .env — that is the only place a key is configured — "
                "or set LLM_PROVIDER=stub to run offline."
            )
        self._key = api_key
        self._timeout = timeout

    @property
    def is_offline(self) -> bool:
        return False

    @property
    def supports_native_documents(self) -> bool:
        """False: this provider is given the extracted text.

        The text layer is already read with coordinates for the locator (§24),
        so handing the same text to the model costs nothing and keeps the two
        looking at exactly the same characters.
        """
        return False

    def model_id_for(self, role: LLMRole) -> str:
        return resolve_model_id(self.name, role)

    def _provenance(self, role: LLMRole) -> CallProvenance:
        return CallProvenance(provider=self.name, model_id=self.model_id_for(role), role=str(role))

    # ── Transport ────────────────────────────────────────────────────────
    def _call(self, *, role: LLMRole, prompt: str, content: str, schema: dict | None) -> dict:
        body: dict[str, Any] = {
            "model": self.model_id_for(role),
            "temperature": 0,
            "top_p": 1,
            "messages": [
                {"role": "system", "content": _read_prompt("system_untrusted_content.txt")},
                {"role": "user", "content": f"{prompt}\n\n{content}"},
            ],
        }
        body["response_format"] = (
            {"type": "json_schema", "json_schema": schema} if schema else {"type": "json_object"}
        )

        request = urllib.request.Request(
            ENDPOINT,
            data=json.dumps(body).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            # Never log the key, and never log document content (§17).
            raise LLMError(f"OpenAI returned HTTP {exc.code}: {exc.read().decode()[:400]}") from exc
        except Exception as exc:
            raise LLMError(f"OpenAI call failed: {type(exc).__name__}: {exc}") from exc

        choice = (payload.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content")
        if not text:
            raise LLMError(
                f"OpenAI returned no content (finish_reason={choice.get('finish_reason')})."
            )
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"OpenAI returned malformed JSON: {text[:200]}") from exc

    # ── Requirement extraction (layer 1) ─────────────────────────────────
    def extract_requirements(self, doc: DocumentInput) -> RequirementSet:
        text = doc.text or ""
        profile = detect_profile(text)
        prompt = _read_prompt(PROMPT_FOR_PROFILE[profile]).replace(
            "{allowed_types}", ", ".join(KNOWN_DOCUMENT_TYPES)
        )
        log.info("requirement extraction provider=openai profile=%s", profile)

        last: LLMError | None = None
        for attempt in range(2):
            try:
                payload = self._call(
                    role=LLMRole.REASONING,
                    prompt=prompt if attempt == 0 else prompt + "\n\nReturn ONLY valid JSON.",
                    content=text,
                    schema=REQUIREMENT_SCHEMA,
                )
                return self._to_requirement_set(payload)
            except LLMError as exc:
                last = exc
                log.warning("requirement extraction attempt %d failed: %s", attempt + 1, exc)
        raise LLMError(f"Requirement extraction failed after 2 attempts: {last}")

    def _to_requirement_set(self, payload: dict) -> RequirementSet:
        allowed = set(KNOWN_DOCUMENT_TYPES)
        drafts: list[RequirementDraft] = []

        for index, raw in enumerate(payload.get("requirements", []), start=1):
            condition = raw.get("condition")
            if isinstance(condition, str):
                try:
                    condition = json.loads(condition) if condition.strip() else None
                except json.JSONDecodeError:
                    condition = None
            if not isinstance(condition, dict):
                condition = None

            drafts.append(
                RequirementDraft(
                    code=raw.get("code") or f"REQ-{index:03d}",
                    name=raw.get("name") or "(unnamed)",
                    category=raw.get("category"),
                    raw_clause=raw.get("raw_clause"),
                    normalized_clause=raw.get("normalized_clause"),
                    condition=condition,
                    mandatory=bool(raw.get("mandatory", True)),
                    weight=float(raw.get("weight") or 0),
                    applicability_scope=raw.get("applicability_scope") or "lead_only",
                    # Anything outside the vocabulary is dropped: routing is a
                    # lookup, and a lookup against an invented key would report
                    # MISSING_EVIDENCE forever (§21).
                    accepts_document_types=[
                        t for t in (raw.get("accepts_document_types") or []) if t in allowed
                    ],
                    required_fields=[str(f) for f in (raw.get("required_fields") or []) if str(f).strip()],
                    external_check=raw.get("external_check") or None,
                    source_page=raw.get("source_page"),
                    source_clause_ref=raw.get("source_clause_ref"),
                    confidence=float(raw.get("confidence") or 0.5),
                )
            )
        return RequirementSet(requirements=drafts, provenance=self._provenance(LLMRole.REASONING))

    # ── Evidence extraction (layer 3) ────────────────────────────────────
    def extract_evidence(self, doc: DocumentInput, schema: dict, doc_type: str) -> ExtractionResult:
        prompt = (
            _read_prompt("extract_evidence.txt")
            .replace("{doc_type}", doc_type)
            .replace("{page_range}", str(doc.page_range or "all"))
            .replace("{schema}", json.dumps(schema or schema_for(doc_type), indent=2))
            .replace("{document_text}", "")
        )
        payload = self._call(
            role=LLMRole.EXTRACTION,
            prompt=prompt,
            content=doc.text or "",
            schema=EXTRACTION_SCHEMA,
        )
        fields: list[ExtractedFieldResult] = []
        for raw in payload.get("fields", []):
            try:
                fields.append(ExtractedFieldResult(**raw))
            except Exception:  # noqa: BLE001 - a malformed field is dropped, not guessed at
                log.warning("dropping malformed extracted field for doc_type=%s", doc_type)
        return ExtractionResult(
            doc_type=doc_type,
            fields=fields,
            injection_suspected=bool(payload.get("injection_suspected")),
            provenance=self._provenance(LLMRole.EXTRACTION),
        )

    def classify_pages(self, doc: DocumentInput) -> list[PageClassification]:
        prompt = (
            _read_prompt("classify_pages.txt")
            .replace("{allowed_types}", ", ".join(KNOWN_DOCUMENT_TYPES))
            .replace("{document_text}", "")
        )
        payload = self._call(
            role=LLMRole.EXTRACTION,
            prompt=prompt,
            content=doc.text or "",
            schema=CLASSIFY_SCHEMA,
        )
        out: list[PageClassification] = []
        for raw in payload.get("pages", []):
            try:
                out.append(PageClassification(**raw))
            except Exception:  # noqa: BLE001
                continue
        return out

    # ── Officer-facing recommendation (layer 8) ───────────────────────────
    def narrate(self, results: list[dict]) -> Recommendation:
        """Turn structured compliance results into an advisory narrative.

        ``results`` are exactly the stored per-requirement verdicts — never raw
        documents. Anything the narrative claims must be traceable to a
        requirement code in this input (§7.6).
        """
        prompt = _read_prompt("narrate.txt")
        payload = self._call(
            role=LLMRole.REASONING,
            prompt=prompt,
            content=json.dumps(results, indent=2, default=str),
            schema=RECOMMENDATION_SCHEMA,
        )
        return recommendation_from_payload(
            payload,
            results=results,
            provenance=self._provenance(LLMRole.REASONING),
        )

    # ── Not yet used; present so the Protocol is satisfied ───────────────
    def judge(self, requirement: str, evidence: list[dict]) -> JudgmentResult:
        raise LLMError("OpenAIProvider.judge is not implemented yet.")
