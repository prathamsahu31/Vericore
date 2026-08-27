# Vericore

Bid compliance verification for GeM procurement.

An officer uploads a tender document and each bidder's submitted documents.
Vericore extracts the tender's eligibility requirements into a structured
checklist, extracts evidence from the bidder documents, matches evidence
against requirements, cross-checks documents against each other, and produces
a per-requirement verdict traceable to a specific page of a specific document.

**The officer decides. The system recommends.**

SIH 2026 · Problem Statement 26100 · CPCL, Ministry of Petroleum & Natural Gas

---

## Getting started

Requires Docker, Python 3.11+, and Node 20+.

```bash
git clone https://github.com/prathamsahu31/Vericore.git
cd Vericore

cp .env.example .env      # defaults run without any API key
docker compose up -d      # starts Postgres

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload

# in a second terminal
cd frontend
npm install
npm run dev
```

Backend at `http://localhost:8000`, frontend at `http://localhost:3000`,
API docs at `http://localhost:8000/docs`.

## The API key

`LLM_PROVIDER=stub` is the default and needs no key — it returns fixtures,
so a fresh clone runs offline and the test suite never touches the network.

For live runs, get a free Gemini key at `aistudio.google.com/apikey` (no card
required), set `LLM_PROVIDER=gemini` and fill `GEMINI_API_KEY` in `.env`.

Responses cache to `.llm_cache/`, so re-running the pipeline on unchanged
inputs consumes no quota. Requests are rate-limited below the free-tier cap.

The provider is swappable by env var — see §7.8 of `CLAUDE.md` for moving the
reasoning calls to Anthropic without touching any other code.

Never commit `.env`.

## Verifying the schema

The first migration creates all sixteen tables and installs the append-only,
hash-chained audit log. Two ways to check it:

```bash
cd backend

# 1. Render the DDL without a database — useful for review, needs nothing running
alembic upgrade head --sql

# 2. Apply it and prove the guarantees hold, against a real Postgres
docker compose up -d          # from the repository root
alembic upgrade head
pytest tests/test_schema_integrity.py -v
```

The tests assert that the database *refuses* things it must refuse: updating or
deleting an audit event, storing an adapter result without its `live`/`simulated`
label, storing an extracted field without page coordinates, or recording a
decision without a justification. They skip with an explanatory message if no
database is reachable, rather than passing vacuously.

## Documentation

| File | What it covers |
|---|---|
| `CLAUDE.md` | Build rules, architecture, conventions. Read before writing code |
| `docs/architecture.md` | Full system design and requirements traceability |
| `docs/blueprint.md` | Domain research, portal API reality check, day-by-day plan |

## Working on this repo

Branch per feature, never commit to `main`:

```bash
git checkout main && git pull
git checkout -b feat/requirement-extraction
# work, commit
git push -u origin feat/requirement-extraction
# open a pull request
```

Commit format: `type(scope): message` — e.g. `feat(compliance): add turnover threshold rule`
