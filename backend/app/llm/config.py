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
}


class UnknownModelError(KeyError):
    """No model is configured for this provider and role."""


def resolve_model_id(provider: str, role: LLMRole) -> str:
    try:
        return MODEL_IDS[(provider, role)]
    except KeyError as exc:
        raise UnknownModelError(
            f"No model configured for provider {provider!r} and role {role}. "
            f"Add a row to MODEL_IDS in app/llm/config.py — see CLAUDE.md §7.3."
        ) from exc
