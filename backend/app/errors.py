"""Typed exceptions and the single place they are mapped to HTTP responses.

CLAUDE.md §13: "Errors are typed exceptions mapped to HTTP responses in one
place." Modules raise these; no module builds an HTTP response itself.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class VericoreError(Exception):
    """Base class for every error the application raises deliberately."""

    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, detail: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class NotFoundError(VericoreError):
    status_code = 404
    code = "not_found"


class ValidationError(VericoreError):
    status_code = 422
    code = "validation_error"


class ConflictError(VericoreError):
    status_code = 409
    code = "conflict"


class PermissionDeniedError(VericoreError):
    status_code = 403
    code = "permission_denied"


class GateNotSatisfiedError(ConflictError):
    """A human confirmation gate has not been passed yet.

    Raised when verification is attempted before the officer confirms the
    requirement checklist (CLAUDE.md §11) or before segmentation is confirmed
    (§19). Both gates are gates, not suggestions.
    """

    code = "gate_not_satisfied"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(VericoreError)
    async def _handle(_: Request, exc: VericoreError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "detail": exc.detail}},
        )
