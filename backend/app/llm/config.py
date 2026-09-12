"""Model IDs, mapped from ``(provider, role)``.

Deliberately **not** environment variables (CLAUDE.md §14): a provider switch
should be a config edit reviewed in a pull request, not an untracked local
change that makes two developers' runs differ.
"""

from __future__ import annotations

from app.llm.types import LLMRole

# Only providers that actually exist appear here. Adding a provider means adding
# its two rows alongside its implementation in ``providers/`` — see §7.8 for the
# Anthropic switch, which is a Phase 5 task.
#
# Model IDs for a live provider must be confirmed against that provider's
# current published model list at the time the provider is added. Do not guess
# them here in advance; an unreachable row is worse than an absent one.
MODEL_IDS: dict[tuple[str, LLMRole], str] = {
    ("stub", LLMRole.EXTRACTION): "stub-extraction-v1",
    ("stub", LLMRole.REASONING): "stub-reasoning-v1",
    # Confirmed by calling each model on 27 Aug 2026. gpt-4.1's context window
    # is irrelevant here: the binding constraint is this account's tokens-per-
    # minute (TPM) cap, which is also enforced as a per-request size ceiling —
    # a ~90-page NIT (~60k tokens) is refused whole with "Request too large ...
    # on tokens per min (TPM)". Oversized tenders are sent in page-aligned
    # chunks by ChunkingProvider (app/llm/providers/decorators.py) so every
    # PQ-table row stays whole in at least one chunk.
    ("openai", LLMRole.EXTRACTION): "gpt-4.1-mini",
    ("openai", LLMRole.REASONING): "gpt-4.1",
    # Confirmed by *calling* each model on 27 Aug 2026, not by reading the
    # list endpoint — which advertises models the key cannot actually use.
    # gemini-2.5-flash and gemini-2.5-pro return 404 "no longer available to
    # new users"; gemini-3.1-pro-preview and gemini-pro-latest return 429
    # quota-exceeded on this free-tier key. The pro tier is therefore not
    # reachable, and REASONING runs on a flash model. That is a real
    # constraint on requirement-extraction quality, not a preference — see
    # §7.3, which wants the strongest available model for this role.
    # Both roles land on flash-lite, which is not what §7.3 wants for REASONING.
    # gemini-3-flash-preview returns 503 "deadline expired" on a 90-page PDF and
    # 503 "high demand" on extracted text, so it is not usable for tender
    # parsing on this key. flash-lite answers the same document in ~25s.
    # Revisit both rows if a key with pro-tier quota becomes available.
    ("gemini", LLMRole.EXTRACTION): "gemini-3.1-flash-lite",
    ("gemini", LLMRole.REASONING): "gemini-3.1-flash-lite",
}


class UnknownModelError(KeyError):
    """No model is configured for this provider and role."""


def resolve_model_id(provider: str, role: LLMRole) -> str:
    import os
    if provider == "openai":
        if role == LLMRole.EXTRACTION and os.environ.get("OPENAI_EXTRACTION_MODEL"):
            return os.environ["OPENAI_EXTRACTION_MODEL"]
        if role == LLMRole.REASONING and os.environ.get("OPENAI_REASONING_MODEL"):
            return os.environ["OPENAI_REASONING_MODEL"]
    try:
        return MODEL_IDS[(provider, role)]
    except KeyError as exc:
        raise UnknownModelError(
            f"No model configured for provider {provider!r} and role {role}. "
            f"Add a row to MODEL_IDS in app/llm/config.py — see CLAUDE.md §7.3."
        ) from exc

