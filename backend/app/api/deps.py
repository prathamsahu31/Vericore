"""Shared router dependencies."""

from __future__ import annotations

from typing import Any

from app.llm.factory import get_provider
from app.llm.types import LLMRole


def extraction_provider() -> Any:
    """The provider bound to the EXTRACTION role.

    A dependency rather than a module-level import so tests can override it
    without touching the factory's cache.
    """
    return get_provider(LLMRole.EXTRACTION)


def reasoning_provider() -> Any:
    """The provider bound to the REASONING role.

    Independent of the extraction provider by design: the recommended final-demo
    setup keeps high-volume extraction on a free tier and points reasoning at a
    stronger model (CLAUDE.md §7.8).
    """
    return get_provider(LLMRole.REASONING)
