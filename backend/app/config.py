"""Application configuration, read from the environment.

Model IDs deliberately do NOT live here. Per CLAUDE.md §14 they belong in
``app/llm/config.py`` as a ``(provider, role) -> model_id`` map, so switching
providers is a reviewed config edit rather than an untracked local change.
"""

from __future__ import annotations

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Environment-backed settings. See ``.env.example`` for the full list."""

    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── LLM ──────────────────────────────────────────────────────────────
    # Default 'stub' so a fresh clone runs keyless and offline (CLAUDE.md §14).
    llm_provider: Literal["stub", "openai", "gemini", "anthropic"] = "stub"
    llm_provider_extraction: Literal["stub", "openai", "gemini", "anthropic"] | None = None
    llm_provider_reasoning: Literal["stub", "openai", "gemini", "anthropic"] | None = None

    # Read from .env, which is the single place a key is configured.
    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None

    def api_key_for(self, provider: str) -> str | None:
        """The key for a provider. One lookup, so keys are never read elsewhere."""
        return {
            "openai": self.openai_api_key,
            "gemini": self.gemini_api_key,
            "anthropic": self.anthropic_api_key,
        }.get(provider)

    llm_cache_dir: Path = Path(".llm_cache")
    llm_max_requests_per_minute: int = 10
    llm_max_retries: int = 3

    # Token budgets for oversized-document handling. The tokens-per-minute cap
    # on the REASONING model is both a rolling rate and a *per-request size*
    # ceiling — a request refused as "Request too large ... on tokens per min"
    # can never succeed whole, so requirement extraction is sent in page-aligned
    # chunks. Keep the default below the account's published TPM cap.
    #   llm_chunk_max_tokens:     estimated input tokens per chunk/request
    #   llm_chunk_tokens_per_min: rolling-window budget across chunked calls
    llm_chunk_max_tokens: int = 24000
    llm_chunk_tokens_per_min: int = 28000

    # ── Database ─────────────────────────────────────────────────────────
    database_url: str = "postgresql://vericore:vericore@localhost:5432/vericore"

    # ── Storage ──────────────────────────────────────────────────────────
    storage_path: Path = Path("./storage")

    # ── Verification adapters ────────────────────────────────────────────
    portal_mode: Literal["simulated", "hybrid"] = "simulated"

    # ── Demo determinism ─────────────────────────────────────────────────
    # Pin the bid due date so certificate-expiry checks are reproducible.
    bid_due_date_override: date | None = None

    # ── App ──────────────────────────────────────────────────────────────
    api_base_url: str = "http://localhost:8000"

    @field_validator("bid_due_date_override", mode="before")
    @classmethod
    def _blank_date_is_none(cls, v: object) -> object:
        return None if isinstance(v, str) and not v.strip() else v

    @field_validator("llm_provider_extraction", "llm_provider_reasoning", mode="before")
    @classmethod
    def _blank_provider_is_none(cls, v: object) -> object:
        return None if isinstance(v, str) and not v.strip() else v

    @property
    def sqlalchemy_url(self) -> str:
        """``DATABASE_URL`` normalised onto the psycopg 3 driver."""
        url = self.database_url
        if url.startswith("postgresql+"):
            return url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        return url

    def provider_for_role(self, role: str) -> str:
        """Resolve the provider for an LLM role, honouring per-role overrides."""
        if role.upper() == "EXTRACTION" and self.llm_provider_extraction:
            return self.llm_provider_extraction
        if role.upper() == "REASONING" and self.llm_provider_reasoning:
            return self.llm_provider_reasoning
        return self.llm_provider


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
