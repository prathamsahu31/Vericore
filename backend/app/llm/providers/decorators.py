"""Provider decorators. CLAUDE.md §7.2.

Composition order is ``CachedProvider(RateLimitedProvider(provider))``: the
cache is checked before the limiter, so a cache hit costs no quota.
"""

from __future__ import annotations

import functools
import hashlib
import json
import logging
import random
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
