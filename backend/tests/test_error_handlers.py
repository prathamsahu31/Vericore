from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.errors import register_exception_handlers
from app.llm.base import LLMError


def _app_for(exc: Exception) -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    def boom() -> dict:
        raise exc

    return app


def test_llm_error_handler_maps_rate_limit_to_retryable_hint() -> None:
    app = _app_for(LLMError("OpenAI returned HTTP 429: rate limit exceeded"))
    with TestClient(app) as client:
        response = client.get("/boom")

    assert response.status_code == 503
    payload = response.json()["error"]
    assert payload["code"] == "llm_provider_error"
    assert payload["detail"]["retryable"] is True
    assert "switch to LLM_PROVIDER=stub" in payload["detail"]["hint"]


def test_llm_error_handler_maps_non_retryable_to_generic_hint() -> None:
    app = _app_for(LLMError("OpenAI returned malformed JSON"))
    with TestClient(app) as client:
        response = client.get("/boom")

    assert response.status_code == 503
    payload = response.json()["error"]
    assert payload["code"] == "llm_provider_error"
    assert payload["detail"]["retryable"] is False
    assert "Retry once" in payload["detail"]["hint"]
