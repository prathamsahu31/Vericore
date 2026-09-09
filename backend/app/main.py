"""FastAPI application entrypoint.

Day 1 is the spine only: the app, its configuration, and a health check.
Feature routers are added per the build order in CLAUDE.md §15.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.errors import register_exception_handlers

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Vericore",
        version="0.1.0",
        summary="Bid compliance verification for GeM procurement",
        description=(
            "Verifies bidder-submitted evidence against tender-specific requirements. "
            "Government-database cross-checks are a secondary, explicitly-simulated layer. "
            "The officer decides; the system never does."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    from app.api.bids import router as bids_router
    from app.api.reports import router as reports_router
    from app.api.tenders import router as tenders_router
    from app.api.verification import router as verification_router

    app.include_router(tenders_router)
    app.include_router(bids_router)
    app.include_router(verification_router)
    app.include_router(reports_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        """Liveness only. Does not touch the database."""
        return {"status": "ok", "service": "vericore", "version": app.version}

    @app.get("/health/db", tags=["meta"])
    def health_db() -> dict:
        """Readiness. Confirms the database answers and reports the migration head."""
        from app.db.session import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            revision = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        return {"status": "ok", "database": "reachable", "migration_revision": revision}

    @app.get("/meta/provenance", tags=["meta"])
    def provenance() -> dict:
        """What is live and what is simulated in this deployment.

        CLAUDE.md §2 rule 2: a simulated result is never presented as live. This
        endpoint states the posture up front so the frontend can label it
        without guessing.
        """
        return {
            "portal_mode": settings.portal_mode,
            "external_verification_source": (
                "simulated" if settings.portal_mode == "simulated" else "mixed"
            ),
            "llm_provider_extraction": settings.provider_for_role("EXTRACTION"),
            "llm_provider_reasoning": settings.provider_for_role("REASONING"),
        }

    return app


app = create_app()
