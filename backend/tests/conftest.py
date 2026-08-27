"""Test fixtures.

Every test in this suite runs against a real PostgreSQL, because the properties
being tested — triggers, CHECK constraints, native enums — are database
behaviour and cannot be exercised in SQLite or in a mock. If no database is
reachable the suite skips with an explanatory message rather than passing
vacuously.

No test in this repository may make a network call to an LLM provider
(CLAUDE.md §7.7). ``LLM_PROVIDER`` stays at its ``stub`` default.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

BACKEND_ROOT = Path(__file__).resolve().parents[1]

SKIP_REASON = (
    "No PostgreSQL reachable at DATABASE_URL. Start one with `docker compose up -d` "
    "from the repository root, then re-run. These tests verify database-enforced "
    "behaviour and cannot be faked."
)


def _test_database_url() -> str:
    from app.config import get_settings

    return os.environ.get("TEST_DATABASE_URL") or get_settings().sqlalchemy_url


@pytest.fixture(scope="session")
def engine() -> Engine:
    url = _test_database_url()
    eng = create_engine(url, poolclass=None)
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - any failure means "no database"
        pytest.skip(f"{SKIP_REASON}\nUnderlying error: {type(exc).__name__}: {exc}")

    # Bring the schema to head so the suite tests the migration, not a
    # hand-built copy of it.
    result = subprocess.run(
        [str(BACKEND_ROOT / ".venv" / "bin" / "alembic"), "upgrade", "head"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        env={**os.environ, "DATABASE_URL": url},
    )
    if result.returncode != 0:
        pytest.fail(f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}")

    return eng


@pytest.fixture
def conn(engine: Engine):
    """A connection whose work is rolled back, so tests do not leak state.

    Rows written to ``audit_events`` inside a rolled-back transaction never
    become part of the chain, which keeps the append-only tests independent.
    """
    connection = engine.connect()
    trans = connection.begin()
    try:
        yield connection
    finally:
        trans.rollback()
        connection.close()
