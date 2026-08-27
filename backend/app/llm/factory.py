"""Builds the provider chain from settings.

The only place in the application that knows which provider is active. Callers
ask for a role and receive something satisfying ``LLMProvider``; they never
learn its vendor (CLAUDE.md §7).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.llm.providers.decorators import CachedProvider, RateLimitedProvider
from app.llm.providers.stub import StubProvider
from app.llm.types import LLMRole


class UnknownProviderError(ValueError):
    """The configured provider has no implementation."""


def _build_base(provider_name: str) -> Any:
    if provider_name == "stub":
        return StubProvider()
    # 'gemini' and 'anthropic' land here as they are implemented (§7.2, §7.8).
    raise UnknownProviderError(
        f"LLM provider {provider_name!r} is configured but not implemented. "
        f"Implement it in app/llm/providers/ and add its rows to app/llm/config.py, "
        f"or set LLM_PROVIDER=stub."
    )


@lru_cache(maxsize=4)
def get_provider(role: LLMRole) -> Any:
    """The provider for a role, wrapped in cache and rate limiter.

    Cache outermost, so a hit costs no quota (§7.2).
    """
    settings = get_settings()
    name = settings.provider_for_role(str(role))
    base = _build_base(name)

    # An offline provider has no published cap to stay under, so wrapping it in
    # a token bucket buys nothing and costs six seconds a call in the test suite.
    chain = (
        base
        if base.is_offline
        else RateLimitedProvider(
            base,
            requests_per_minute=settings.llm_max_requests_per_minute,
            max_retries=settings.llm_max_retries,
        )
    )
    return CachedProvider(chain, cache_dir=settings.llm_cache_dir)
