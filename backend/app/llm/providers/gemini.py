"""Google Gemini. CLAUDE.md §7.2.

The only file in the repository that knows this vendor exists, alongside its
two rows in ``app/llm/config.py``. Callers ask for a role and get something
satisfying ``LLMProvider``; nothing outside ``app/llm/`` learns which one.

Uses the REST endpoint through the standard library rather than a vendor SDK.
One endpoint is all this needs, and adding a large dependency for it would be
scope the project did not ask for (§2 rule 7).
"""

from __future__ import annotations

import base64
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
    ExtractionResult,
    JudgmentResult,
    LLMRole,
    PageClassification,
    Recommendation,
    RequirementSet,
)

log = logging.getLogger(__name__)

PROMPTS = Path(__file__).resolve().parents[1] / "prompts"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# The requirement shape, as an OpenAPI subset Gemini will constrain output to.
# Schema-constrained output is what makes a parse failure rare rather than
# routine (CLAUDE.md §7.6).
REQUIREMENT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "requirements": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "code": {"type": "STRING"},
                    "name": {"type": "STRING"},
                    "category": {"type": "STRING"},
                    "raw_clause": {"type": "STRING"},
                    "normalized_clause": {"type": "STRING"},
                    "condition": {"type": "STRING"},
                    "mandatory": {"type": "BOOLEAN"},
                    "weight": {"type": "NUMBER"},
                    "applicability_scope": {
                        "type": "STRING",
                        "enum": ["lead_only", "any_member", "all_members", "aggregate"],
                    },
                    "accepts_document_types": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "required_fields": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "external_check": {"type": "STRING"},
                    "source_page": {"type": "INTEGER"},
                    "source_clause_ref": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"},
                },
                "required": ["code", "name", "raw_clause", "applicability_scope"],
            },
        }
    },
    "required": ["requirements"],
}

RECOMMENDATION_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING"},
        "action": {
            "type": "STRING",
            "enum": [
                "RECOMMEND_QUALIFY",
                "SEEK_CLARIFICATION",
                "RECOMMEND_DISQUALIFY",
                "MANUAL_REVIEW_REQUIRED",
            ],
        },
        "cited_requirement_codes": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["summary", "action", "cited_requirement_codes"],
}

JUDGMENT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "status": {
            "type": "STRING",
            "enum": ["NEEDS_HUMAN_REVIEW", "PARTIALLY_COMPLIANT", "COMPLIANT", "NON_COMPLIANT"],
        },
        "confidence": {"type": "NUMBER"},
        "reasoning": {"type": "STRING"},
        "cited_field_names": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["status", "confidence", "reasoning"],
}


def _read_prompt(name: str) -> str:
    return (PROMPTS / name).read_text()


class GeminiProvider:
    """Primary provider. Reads PDFs natively, so no separate OCR step."""

    name: ClassVar[str] = "gemini"

    def __init__(self, api_key: str, timeout: int = 180) -> None:
        if not api_key:
            raise LLMError(
                "LLM_PROVIDER is set to gemini but GEMINI_API_KEY is empty. "
                "Set it in .env, or set LLM_PROVIDER=stub to run offline."
            )
        self._key = api_key
        self._timeout = timeout

    @property
    def is_offline(self) -> bool:
        return False

    @property
    def supports_native_documents(self) -> bool:
        """True — PDFs and images go straight in, so the OCR fallback in the
        provider layer is not used for this provider (CLAUDE.md §7.1)."""
        return True

    def model_id_for(self, role: LLMRole) -> str:
        return resolve_model_id(self.name, role)

    def _provenance(self, role: LLMRole) -> CallProvenance:
        return CallProvenance(provider=self.name, model_id=self.model_id_for(role), role=str(role))

    # ── Transport ────────────────────────────────────────────────────────
    def _call(
        self,
        *,
        role: LLMRole,
        prompt: str,
        doc: DocumentInput,
        response_schema: dict | None,
    ) -> dict:
        model = self.model_id_for(role)
        parts: list[dict] = [{"text": prompt}]

        if doc.file_bytes:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": doc.mime_type or "application/pdf",
                        "data": base64.b64encode(doc.file_bytes).decode(),
                    }
                }
            )
        elif doc.text:
            parts.append({"text": doc.text})

        body: dict[str, Any] = {
            "contents": [{"role": "user", "parts": parts}],
            "systemInstruction": {
                "parts": [{"text": _read_prompt("system_untrusted_content.txt")}]
            },
            "generationConfig": {
                # Deterministic-as-possible: the same tender should parse the
                # same way twice, or the confirmation gate is reviewing a
                # moving target.
                "temperature": 0.0,
                "responseMimeType": "application/json",
            },
        }
        if response_schema:
            body["generationConfig"]["responseSchema"] = response_schema

        request = urllib.request.Request(
            ENDPOINT.format(model=model),
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": self._key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode()[:400]
            # Never log the key, and never log document content (§17).
            raise LLMError(f"Gemini returned HTTP {exc.code}: {detail}") from exc
        except Exception as exc:
            raise LLMError(f"Gemini call failed: {type(exc).__name__}: {exc}") from exc

        try:
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            finish = (payload.get("candidates") or [{}])[0].get("finishReason")
            raise LLMError(f"Gemini returned no usable content (finishReason={finish}).") from exc

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"Gemini returned malformed JSON: {text[:200]}") from exc

    # ── Requirement extraction (layer 1) ─────────────────────────────────
    def extract_requirements(self, doc: DocumentInput) -> RequirementSet:
        """Parse a tender into requirement drafts, by profile (§6.1).

        On a parse failure the call is retried once with a stricter instruction,
        then gives up rather than guessing — the caller surfaces an empty
        checklist, which an officer can see is wrong (§7.6).
        """
        profile = detect_profile(doc.text or "")
        prompt = _read_prompt(PROMPT_FOR_PROFILE[profile]).replace(
            "{allowed_types}", ", ".join(KNOWN_DOCUMENT_TYPES)
        )
        log.info("requirement extraction profile=%s", profile)

        last: LLMError | None = None
        for attempt in range(2):
            try:
                payload = self._call(
                    role=LLMRole.REASONING,
                    prompt=(
                        prompt
                        if attempt == 0
                        else prompt + "\n\nReturn ONLY valid JSON matching the schema."
                    ),
                    doc=doc,
                    response_schema=REQUIREMENT_SCHEMA,
                )
                return self._to_requirement_set(payload, profile)
            except LLMError as exc:
                last = exc
                log.warning("requirement extraction attempt %d failed: %s", attempt + 1, exc)
        raise LLMError(f"Requirement extraction failed after 2 attempts: {last}")

    def _to_requirement_set(self, payload: dict, profile) -> RequirementSet:
        from app.llm.types import RequirementDraft

        drafts = []
        for index, raw in enumerate(payload.get("requirements", []), start=1):
            condition = raw.get("condition")
            # The schema types condition as a string so the model cannot invent
            # arbitrary structure; parse it back, and drop it if it is not a
            # usable object rather than passing a guess to the rule engine.
            if isinstance(condition, str):
                try:
                    condition = json.loads(condition) if condition.strip() else None
                except json.JSONDecodeError:
                    condition = None
            if not isinstance(condition, dict):
                condition = None

            allowed = set(KNOWN_DOCUMENT_TYPES)
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
                    # Silently discard any type outside the vocabulary: routing
                    # is a lookup, and a lookup against an invented key finds
                    # nothing and reports MISSING_EVIDENCE forever.
                    accepts_document_types=[
                        t for t in (raw.get("accepts_document_types") or []) if t in allowed
                    ],
                    required_fields=[
                        f for f in (raw.get("required_fields") or []) if isinstance(f, str) and f.strip()
                    ],
                    external_check=raw.get("external_check") or None,
                    source_page=raw.get("source_page"),
                    source_clause_ref=raw.get("source_clause_ref"),
                    confidence=float(raw.get("confidence") or 0.5),
                )
            )
        return RequirementSet(requirements=drafts, provenance=self._provenance(LLMRole.REASONING))

    # ── Evidence extraction (layer 3) ────────────────────────────────────
    def extract_evidence(self, doc: DocumentInput, schema: dict, doc_type: str) -> ExtractionResult:
        from app.llm.types import ExtractedFieldResult

        prompt = (
            _read_prompt("extract_evidence.txt")
            .replace("{doc_type}", doc_type)
            .replace("{page_range}", str(doc.page_range or "all"))
            .replace("{schema}", json.dumps(schema or schema_for(doc_type), indent=2))
            .replace("{document_text}", "" if doc.file_bytes else (doc.text or ""))
        )
        payload = self._call(role=LLMRole.EXTRACTION, prompt=prompt, doc=doc, response_schema=None)
        fields = []
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
            .replace("{document_text}", "" if doc.file_bytes else (doc.text or ""))
        )
        payload = self._call(role=LLMRole.EXTRACTION, prompt=prompt, doc=doc, response_schema=None)
        out = []
        for raw in payload.get("pages", []):
            try:
                out.append(PageClassification(**raw))
            except Exception:  # noqa: BLE001
                continue
        return out

    # ── Officer-facing recommendation (layer 8) ────────────────────────────
    def narrate(self, results: list[dict]) -> Recommendation:
        """Advisory narrative from structured results only (§7.6)."""
        from app.llm.types import recommendation_from_payload

        doc = DocumentInput(
            text=json.dumps(results, indent=2, default=str),
            file_bytes=None,
            mime_type=None,
            page_range=None,
        )
        payload = self._call(
            role=LLMRole.REASONING,
            prompt=_read_prompt("narrate.txt"),
            doc=doc,
            response_schema=RECOMMENDATION_SCHEMA,
        )
        return recommendation_from_payload(
            payload, results=results, provenance=self._provenance(LLMRole.REASONING)
        )

    def judge(self, requirement: str, evidence: list[dict]) -> JudgmentResult:
        """Semantic judgement for prose requirements (§7.4). Advisory — caller
        routes the verdict to NEEDS_HUMAN_REVIEW regardless, but the reasoning
        is the useful output (improvement_roadmap §2)."""
        evidence_block = json.dumps(evidence, indent=2, default=str) if evidence else "(no evidence extracted)"
        prompt = (
            _read_prompt("judge.txt")
            .replace("{requirement}", requirement)
            .replace("{evidence}", evidence_block)
        )
        doc = DocumentInput(text=prompt, file_bytes=None, mime_type=None, page_range=None)
        try:
            payload = self._call(
                role=LLMRole.REASONING,
                prompt=prompt,
                doc=doc,
                response_schema=JUDGMENT_SCHEMA,
            )
        except LLMError:
            raise
        except Exception as exc:
            raise LLMError(f"judge call failed: {exc}") from exc

        status = str(payload.get("status") or "NEEDS_HUMAN_REVIEW").strip().upper()
        if status not in {"NEEDS_HUMAN_REVIEW", "PARTIALLY_COMPLIANT", "COMPLIANT", "NON_COMPLIANT"}:
            status = "NEEDS_HUMAN_REVIEW"
        # Prose judgement is advisory by policy (§7.4) — never emit a hard
        # COMPLIANT/NON_COMPLIANT as an automated verdict.
        if status in {"COMPLIANT", "NON_COMPLIANT", "PARTIALLY_COMPLIANT"}:
            status = "NEEDS_HUMAN_REVIEW"

        reasoning = str(payload.get("reasoning") or "").strip()
        if not reasoning:
            reasoning = "The requirement is worded as a judgement rather than a measurement, so it was referred to you by policy."

        cited = [str(c) for c in (payload.get("cited_field_names") or []) if isinstance(c, str) and c.strip()]
        confidence = payload.get("confidence")
        try:
            confidence_f = float(confidence) if confidence is not None else 0.5
        except Exception:
            confidence_f = 0.5
        confidence_f = max(0.0, min(1.0, confidence_f))

        return JudgmentResult(
            status=status,
            confidence=confidence_f,
            reasoning=reasoning,
            cited_field_names=cited,
            provenance=self._provenance(LLMRole.REASONING),
        )
