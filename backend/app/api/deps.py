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
