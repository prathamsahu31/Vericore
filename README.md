# Vericore

Bid compliance verification for GeM procurement.

An officer uploads a tender document and each bidder's submitted documents.
Vericore extracts the tender's eligibility requirements into a structured
checklist, extracts evidence from the bidder documents, matches evidence
against requirements, cross-checks documents against each other, and produces
a per-requirement verdict traceable to a specific page of a specific document.
Cross-checks against government portals (GSTN, PAN, Udyam/MSME, MCA21,
DigiLocker, DPIIT/Startup India, NSIC, blacklisting) are mocked and clearly
labelled `simulated`.

**The officer decides. The system recommends.**

SIH 2026 · Problem Statement 26100 · CPCL, Ministry of Petroleum & Natural Gas

---

## Clone and run

Requires **Docker** (for Postgres), **Python 3.11+**, and **Node 20+**.

```bash
git clone https://github.com/prathamsahu31/Vericore.git
cd Vericore 

# Configuration — the defaults need no API key and run fully offline.
cp .env.example .env

# 1. Start Postgres
docker compose up -d

# 2. Backend  (http://localhost:8000, API docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload

# 3. Frontend, in a second terminal  (http://localhost:3000)
cd frontend
npm install
npm run dev
```

That is everything. With `LLM_PROVIDER=stub` the full pipeline runs keyless and
offline; a seed tender and three demo bidder bundles are included.

## Run the demo

All the demo data lives in `seed/` — a DARPG-style NIT and three bidder bundles.
One command verifies the whole pipeline end to end (tender → requirements →
bidders → documents → verdicts → score → risk → report):

```bash
cd backend
python scripts/run_demo.py
```

Or drive it yourself from the frontend: create a tender, upload
`seed/tender/nit_darpg_style.pdf`, upload one bidder's folder of PDFs, and run
the checks.

## Run the tests

```bash
cd backend
docker compose up -d          # from the repository root — tests need Postgres
pytest
```

If no database is reachable, the database-dependent tests **skip with an
explanation** rather than failing — the pure-logic suites (rule engine, routing,
risk, locator) still run. Tests always use the stub LLM and never touch the
network.

## Using a live language model

The default `stub` provider reads documents with fixed rules so a fresh clone
works offline. For real output, point the pipeline at one of:

| Provider | Env var + key |
|---|---|
| OpenAI | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` |
| Google Gemini | `LLM_PROVIDER=gemini` + `GEMINI_API_KEY` |
| Anthropic | `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` |

Responses cache to `.llm_cache/`, so re-running on unchanged inputs consumes no
quota. Requests are rate-limited below the free-tier cap. Extraction and
reasoning can use different providers (`LLM_PROVIDER_EXTRACTION`,
`LLM_PROVIDER_REASONING`).

**Never commit `.env`** — it holds your keys and is gitignored.

## Verifying the schema

The first migration creates all **seventeen** tables and installs the
append-only, hash-chained audit log. Two ways to check it:

```bash
cd backend

# 1. Render the DDL without a database — nothing needs to be running
alembic upgrade head --sql

# 2. Apply it and prove the guarantees hold, against a real Postgres
docker compose up -d          # from the repository root
alembic upgrade head
pytest tests/test_schema_integrity.py -v
```

The tests assert the database *refuses* things it must refuse: updating or
deleting an audit event, storing an adapter result without its
`live`/`simulated` label, storing an extracted field without page coordinates,
or recording a decision without a justification.

## Documentation

| File | What it covers |
|---|---|
| `docs/how-it-works.md` | Plain-language explainer — how the checks work and their limits |
| `docs/architecture.md` | Full system design and requirements traceability |
| `CLAUDE.md` | Build rules, architecture, conventions. Read before writing code |

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
