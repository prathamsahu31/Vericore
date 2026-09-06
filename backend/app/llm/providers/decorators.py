"""Provider decorators. CLAUDE.md §7.2.

Composition order is ``CachedProvider(RateLimitedProvider(ChunkingProvider(provider)))``:
the cache is checked before the limiter, so a cache hit costs no quota.
"""

from __future__ import annotations

import functools
import hashlib
import json
import logging
import random
import re
import threading
import time
from pathlib import Path
from typing import Any

from app.llm.base import LLMError
from app.llm.types import (
    DocumentInput,
    ExtractionResult,
    JudgmentResult,
    LLMRole,
    PageClassification,
    Recommendation,
    RequirementDraft,
    RequirementSet,
)

log = logging.getLogger(__name__)

_PASSTHROUGH = {"name", "supports_native_documents", "is_offline", "model_id_for"}


def _fingerprint(provider_name: str, method: str, args: tuple, kwargs: dict) -> str:
    """Hash of (provider, method, inputs), including raw document bytes.

    Document bytes are hashed rather than stored, so the key is stable and the
    cache never holds document content.
    """
    parts: list[str] = [provider_name, method]
    for value in (*args, *sorted(kwargs.items())):
        if isinstance(value, DocumentInput):
            parts.append(hashlib.sha256(value.file_bytes or b"").hexdigest())
            parts.append(hashlib.sha256((value.text or "").encode()).hexdigest())
            parts.append(str(value.mime_type))
            parts.append(str(value.page_range))
        else:
            parts.append(json.dumps(value, sort_keys=True, default=str))
    return hashlib.sha256("\x1f".join(parts).encode()).hexdigest()


class CachedProvider:
    """Caches results to disk by hash of (provider, model, method, inputs).

    Always in the chain during development: re-running the pipeline on
    unchanged fixtures must consume zero quota (CLAUDE.md §7.7).
    """

    def __init__(self, inner: Any, cache_dir: Path) -> None:
        self._inner = inner
        self._dir = Path(cache_dir)
        self._dir.mkdir(parents=True, exist_ok=True)
        self.name = inner.name

    @property
    def supports_native_documents(self) -> bool:
        return self._inner.supports_native_documents

    @property
    def is_offline(self) -> bool:
        return self._inner.is_offline

    def model_id_for(self, role: LLMRole) -> str:
        return self._inner.model_id_for(role)

    def __getattr__(self, item: str) -> Any:
        if item.startswith("_") or item in _PASSTHROUGH:
            raise AttributeError(item)
        inner_attr = getattr(self._inner, item)
        if not callable(inner_attr):
            return inner_attr

        if item not in RETURN_TYPES:
            return inner_attr

        @functools.wraps(inner_attr)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = _fingerprint(self._inner.name, item, args, kwargs)
            path = self._dir / f"{key}.json"
            if path.exists():
                log.debug("llm cache hit method=%s key=%s", item, key[:12])
                return _rehydrate(item, json.loads(path.read_text()))
            result = inner_attr(*args, **kwargs)
            try:
                path.write_text(json.dumps(_dehydrate(result), default=str))
            except (TypeError, ValueError):
                log.debug("llm result not cacheable method=%s", item)
            return result

        return wrapper


# What each provider method returns, stated explicitly rather than read off a
# type annotation. ``from __future__ import annotations`` turns annotations into
# strings, so reflection here silently returns nothing and the cache hands back
# raw dictionaries — on the second call only, which is the worst kind of bug to
# find later. A method absent from this map is simply not cached.
RETURN_TYPES: dict[str, tuple[Any, bool]] = {
    "extract_requirements": (RequirementSet, False),
    "extract_evidence": (ExtractionResult, False),
    "judge": (JudgmentResult, False),
    "narrate": (Recommendation, False),
    "classify_pages": (PageClassification, True),
}


def _dehydrate(result: Any) -> Any:
    if isinstance(result, list):
        return [_dehydrate(r) for r in result]
    if hasattr(result, "model_dump"):
        return result.model_dump()
    return result


def _rehydrate(method_name: str, payload: Any) -> Any:
    """Rebuild the declared return type from cached JSON.

    A cache hit must return exactly what a live call would. Anything else makes
    the cache a source of type bugs rather than a saving.
    """
    model, is_list = RETURN_TYPES[method_name]
    if is_list:
        return [model.model_validate(p) for p in payload]
    return model.model_validate(payload)


class RateLimitedProvider:
    """Token-bucket limiter plus retry with exponential backoff and jitter.

    The ceiling is set below the published free-tier cap (CLAUDE.md §7.7).
    After the configured number of retries the call raises ``LLMError``, and the
    caller routes the affected requirement to ``NEEDS_HUMAN_REVIEW`` rather than
    crashing the pipeline.
    """

    def __init__(self, inner: Any, requests_per_minute: int, max_retries: int) -> None:
        self._inner = inner
        self._interval = 60.0 / max(requests_per_minute, 1)
        self._max_retries = max_retries
        self._lock = threading.Lock()
        self._last_call = 0.0
        self.name = inner.name

    @property
    def supports_native_documents(self) -> bool:
        return self._inner.supports_native_documents

    @property
    def is_offline(self) -> bool:
        return self._inner.is_offline

    def model_id_for(self, role: LLMRole) -> str:
        return self._inner.model_id_for(role)

    def _wait_turn(self) -> None:
        with self._lock:
            gap = time.monotonic() - self._last_call
            if gap < self._interval:
                time.sleep(self._interval - gap)
            self._last_call = time.monotonic()

    def __getattr__(self, item: str) -> Any:
        if item.startswith("_") or item in _PASSTHROUGH:
            raise AttributeError(item)
        inner_attr = getattr(self._inner, item)
        if not callable(inner_attr):
            return inner_attr

        @functools.wraps(inner_attr)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last: Exception | None = None
            for attempt in range(self._max_retries):
                self._wait_turn()
                try:
                    return inner_attr(*args, **kwargs)
                except Exception as exc:  # noqa: BLE001 - provider errors vary by vendor
                    last = exc
                    backoff = (2**attempt) + random.random()
                    log.warning(
                        "llm call failed method=%s attempt=%d/%d retrying_in=%.1fs",
                        item,
                        attempt + 1,
                        self._max_retries,
                        backoff,
                    )
                    time.sleep(backoff)
            # Carry the provider's own message forward. Without it the caller
            # sees "failed after 3 attempts" and has to read a traceback to
            # learn whether the key is wrong, the model is retired, or the
            # account is simply out of credit.
            raise LLMError(
                f"{item} failed after {self._max_retries} attempts; "
                f"caller must route to NEEDS_HUMAN_REVIEW. Last error: {last}"
            ) from last

        return wrapper


# Page markers injected by document_intelligence so a text-only provider can
# still report which page a span came from (see pdf_reader.build_provider_text).
_PAGE_MARKER = re.compile(r"^\[page (\d+)\]$", re.MULTILINE)

# Rough English-text token density. Used only to size chunks; the provider
# never sees this estimate.
_CHARS_PER_TOKEN = 4


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


def _page_spans(text: str) -> list[tuple[int, int, int]]:
    """``(page number, start offset, end offset)`` of each ``[page N]`` block."""
    marks = [
        (int(m.group(1)), m.start())
        for m in _PAGE_MARKER.finditer(text)
        if text.rfind("\n", 0, m.start()) == -1 or text[m.start() - 1] == "\n"
    ]
    if not marks:
        return [(1, 0, len(text))]
    spans: list[tuple[int, int, int]] = []
    boundaries = [start for _, start in marks] + [len(text)]
    for (number, start), end in zip(marks, boundaries[1:]):
        spans.append((number, start, max(end, start)))
    return spans


def _group_pages(
    text: str, spans: list[tuple[int, int, int]], max_tokens: int
) -> list[tuple[int, int, str]]:
    """Group page-aligned blocks into chunks, each under ``max_tokens``.

    Returns ``(first_page, last_page, chunk_text)``. A block alone larger than
    the budget becomes its own chunk; the caller's retry ladder is the net for
    that, not further splitting mid-page.
    """
    if not spans:
        return []
    groups: list[tuple[int, int, str]] = []
    first_page = spans[0][0]
    last_page = spans[0][0]
    group_text: str | None = None

    def flush_group() -> None:
        nonlocal group_text
        if group_text is not None:
            groups.append((first_page, last_page, group_text))
            group_text = None

    for number, start, end in spans:
        block = text[start:end]
        if group_text is None:
            first_page = number
            group_text = block
            last_page = number
            continue
        candidate = group_text.rstrip() + "\n" + block.lstrip("\n")
        if _estimate_tokens(candidate) <= max_tokens:
            group_text = candidate
            last_page = number
            continue
        flush_group()
        first_page = number
        group_text = block
        last_page = number

    flush_group()
    return groups


def _merge_requirement_sets(sets: list[RequirementSet]) -> RequirementSet:
    """Concatenate chunk results, drop duplicates, renumber deterministically.

    Each chunk restarts its own numbering, so codes mean nothing across chunks
    — the merged list is renumbered ``REQ-001`` upward in reading order.
    """
    drafts: list[RequirementDraft] = []
    seen: set[tuple] = set()
    for requirement_set in sets:
        for draft in requirement_set.requirements:
            key = (
                (draft.name or "").casefold().strip(),
                (draft.normalized_clause or draft.raw_clause or "").casefold().strip(),
            )
            if key in seen:
                log.debug("dropping duplicate requirement %r across chunks", draft.name)
                continue
            seen.add(key)
            drafts.append(draft)
    for index, draft in enumerate(drafts, start=1):
        draft.code = f"REQ-{index:03d}"
    return RequirementSet(
        requirements=drafts,
        provenance=sets[-1].provenance if sets else None,
    )


class ChunkingProvider:
    """Split one oversized requirement-extraction call into page-aligned calls.

    An account's tokens-per-minute cap is a request-size ceiling as well as a
    rolling rate. A single 60k-token NIT is refused before it reaches the model
    (``Request too large ... on tokens per min (TPM)``), so a whole-document
    call can never succeed on this account. The NIT is therefore sent in
    page-aligned chunks under a token budget, and the results are merged with
    duplicates removed.

    Only ``extract_requirements`` is chunked. Evidence documents are already
    one logical document per call, and chunking them would break the span
    locator's page-attribution for no real benefit.

    Chunks stay page-aligned on purpose (CLAUDE.md §7.7): a pre-qualification
    table row split across a chunk boundary would otherwise be lost silently,
    and page alignment is what keeps every row whole in at least one chunk.
    """

    def __init__(
        self,
        inner: Any,
        max_request_tokens: int,
        tokens_per_minute: int,
    ) -> None:
        self._inner = inner
        self._max_request_tokens = max_request_tokens
        self._tokens_per_minute = tokens_per_minute
        self._lock = threading.Lock()
        self._window: list[tuple[float, int]] = []  # (monotonic, tokens) within the last 60s
        self.name = inner.name

    @property
    def supports_native_documents(self) -> bool:
        """Pass-through. Chunking the extracted text works for both flavours."""
        return self._inner.supports_native_documents

    @property
    def is_offline(self) -> bool:
        return self._inner.is_offline

    def model_id_for(self, role: LLMRole) -> str:
        return self._inner.model_id_for(role)

    def _wait_tokens(self, tokens: int) -> None:
        """Rolling-window token bucket: never put more than the per-minute cap
        (input + a fixed prompt/output allowance) into any 60-second window."""
        overhead = 500  # system prompt plus the schema'd output, roughly
        with self._lock:
            now = time.monotonic()
            self._window = [(t, n) for t, n in self._window if now - t < 60.0]
            if not self._window:
                self._window.append((now, tokens + overhead))
                return
            consumed = sum(n for _, n in self._window)
            owed = consumed + tokens + overhead - self._tokens_per_minute
            if owed > 0:
                to_free = 0
                for ts, size in self._window:
                    to_free += size
                    horizon = 60.0 - (now - ts)
                    if to_free >= owed:
                        log.debug(
                            "token window full: sleeping %.1fs to stay under %d/min",
                            horizon,
                            self._tokens_per_minute,
                        )
                        time.sleep(max(0.0, horizon))
                        now = time.monotonic()
                        self._window = [(t, n) for t, n in self._window if now - t < 60.0]
                        break
            self._window.append((now, tokens + overhead))

    def extract_requirements(self, doc: DocumentInput) -> RequirementSet:
        text = doc.text or ""
        if _estimate_tokens(text) <= self._max_request_tokens:
            return self._inner.extract_requirements(doc)

        sets: list[RequirementSet] = []
        for first_page, last_page, chunk in _group_pages(
            text, _page_spans(text), self._max_request_tokens
        ):
            self._wait_tokens(_estimate_tokens(chunk))
            sets.append(
                self._inner.extract_requirements(
                    DocumentInput(
                        text=chunk,
                        file_bytes=doc.file_bytes,
                        mime_type=doc.mime_type,
                        page_range=(first_page, last_page),
                    )
                )
            )

        return _merge_requirement_sets(sets)

    def __getattr__(self, item: str) -> Any:
        """Everything else passes straight through to the wrapped provider."""
        if item.startswith("_"):
            raise AttributeError(item)
        return getattr(self._inner, item)
