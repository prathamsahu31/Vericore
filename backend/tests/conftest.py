"""Test fixtures.

Every test that touches the database runs against a real PostgreSQL, because
the properties being tested — triggers, CHECK constraints, native enums — are
database behaviour and cannot be exercised in SQLite or in a mock. If no
database is reachable the suite skips with an explanation rather than passing
vacuously.

No test may make a network call to an LLM provider (CLAUDE.md §7.7).
``LLM_PROVIDER`` stays at its ``stub`` default, and the assertion that the
active provider is the stub lives in ``test_stub_provider.py``.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

# Set before any app import: settings are read once and cached, so pointing
# storage and the cache at throwaway directories has to happen first.
_TMP = Path(tempfile.mkdtemp(prefix="vericore-tests-"))
os.environ.setdefault("STORAGE_PATH", str(_TMP / "storage"))
os.environ.setdefault("LLM_CACHE_DIR", str(_TMP / "llm_cache"))
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

import pytest  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

BACKEND_ROOT = Path(__file__).resolve().parents[1]

SKIP_REASON = (
    "No PostgreSQL reachable at DATABASE_URL. Start one with `docker compose up -d` "
    "from the repository root, then re-run. These tests verify database-enforced "
    "behaviour and cannot be faked."
)


def _database_url() -> str:
    from app.config import get_settings

    return get_settings().sqlalchemy_url


@pytest.fixture(scope="session")
def engine() -> Engine:
    url = _database_url()
    eng = create_engine(url)
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


@pytest.fixture
def db_session(conn) -> Session:
    """A session sharing the test's transaction.

    ``create_savepoint`` means the application's own ``commit()`` calls succeed
    — they release a savepoint — while the outer transaction still rolls back
    at the end of the test.
    """
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session):
    """A TestClient whose requests run inside the test's transaction."""
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def bid(client, conn) -> str:
    """A tender, a bidder and a sole bid, ready to receive documents.

    ``POST /tenders`` is still outstanding from Day 1, so the tender is inserted
    directly. This fixture is where that changes when the endpoint lands.
    """
    tender_id = conn.execute(
        text(
            "INSERT INTO tenders (title, bid_due_date) "
            "VALUES ('Supply and Installation of Corrosion-Resistant Piping System', "
            "'2026-09-15') RETURNING id"
        )
    ).scalar_one()
    bidder = client.post(
        "/bidders",
        json={
            "legal_name": "ABC Infrastructure Private Limited",
            "pan": "AABCA1234C",
            "gstin": "33AABCA1234C1ZM",
        },
    ).json()
    response = client.post("/bids", json={"tender_id": str(tender_id), "bidder_id": bidder["id"]})
    return response.json()["id"]
