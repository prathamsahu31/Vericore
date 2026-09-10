# SIH 2026 Project Repository

This repository contains **Vericore**, an AI-powered integrated bid compliance verification and decision-support platform designed for GeM procurement.

---

## 1. Project Information

* **Project Title:** `Vericore`
* **PS ID:** `SIH26100` / `26100`
* **PS Title:** `AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement`
* **Organization:** Ministry of Petroleum & Natural Gas
* **Department:** Chennai Petroleum Corporation Limited (CPCL)
* **Category:** Software
* **Theme:** Smart Automation

> **Tagline:** *Verifiable, evidence-backed bid compliance and decision support for public procurement officers.*

---

## 2. Problem Statement

Government procurement through the Government e-Marketplace (GeM) involves rigorous verification of statutory, regulatory, and technical eligibility requirements across multiple bidders. Procurement officers must manually examine and validate dense tender documents (NIT/RFP) and massive bidder document bundles containing:

- Udyam / MSME registration & relaxations
- GST registration, state codes, and return filing status
- PAN and Income Tax compliance
- Make in India (MII) local content declarations
- EPFO / ESIC statutory compliance
- Startup India, NSIC, and OEM authorizations
- DigiLocker credentials and document validity dates
- Debarment, suspension, and blacklisting status
- Tender-specific financial turnovers, net worth, and past experience certificates

### Core Challenges
* **Manual & Document-Intensive:** High volume of submitted PDFs requires hours of manual cross-referencing against multi-page tender clauses.
* **Portal Fragmentation:** Evaluating compliance demands checking disparate government databases (GSTN, PAN, MCA21, EPFO, etc.).
* **Risk of Inconsistencies & Human Errors:** Overlooking a clause or missing cross-document discrepancies (e.g. mismatched PAN between GST certificate and PAN card) can lead to unfair disqualifications or flawed contract awards.
* **Auditability & Legal Scrutiny:** Every decision must withstand legal audits and CVC/CAG inquiries with verifiable evidence trails.

> **Guiding Principle:** **The officer decides. The system never does.** Vericore does not qualify or disqualify bidders autonomously; it provides verifiable citations, transparent calculations, and decision support.

---

## 3. Proposed Solution

**Vericore** is a modern, modular bid compliance verification platform designed specifically for GeM procurement workflows:

1. **Automated Tender Requirement Extraction:** Parses free-text Notice Inviting Tender (NIT) documents into a structured, clause-by-clause eligibility checklist with human confirmation gates.
2. **Deterministic Evidence Extraction & OCR:** Extracts key values (GSTIN, PAN, dates, financials, turnover) with exact page bounding-box coordinates for 1-click drill-down audits.
3. **Multi-Portal Verification (Simulated/Hybrid Adapter):** Validates bidder identifiers against Udyam, GSTN, MCA21, PAN, DigiLocker, and debarment registries (clearly stamped `simulated` or `live`).
4. **Deterministic Compliance & Cross-Document Engine:** Performs threshold evaluations, turnover averaging, certificate expiry checks, and detects contradictions across a bidder’s own documents.
5. **Arithmetic Scoring & Risk Assessment:** Computes an un-hallucinated, weighted arithmetic compliance score and categorizes risk levels based on count and severity of discrepancies.
6. **Append-Only Hash-Chained Audit Trail:** Cryptographically secures every officer action and verification step in PostgreSQL with SHA-256 hash chains.

---

## 4. Key Features

* **Tender Requirement Extraction:** Structured clause checklist extracted using an LLM reasoning layer with human officer review and confirmation locks.
* **Exact Evidence Pinpointing:** Every verdict is linked to `{document, page, coordinates}` bounding boxes so officers can inspect the original PDF in one click.
* **Cross-Document Contradiction Detection:** Spots critical discrepancies (e.g., mismatched entity names, differing PANs embedded inside GSTIN vs PAN card).
* **Deterministic Rule Engine:** Financial averages, date validity relative to bid due dates, and mathematical thresholds are executed in deterministic code—never hallucinated by an LLM.
* **Multi-Portal Adapter Layer:** Integrates Udyam, GSTN, MCA21, PAN, EPFO/ESIC, DigiLocker, and blacklisting checks behind a unified interface with transparent `live` / `simulated` labeling.
* **Two-Gate Evaluation System:** Distinguishes between verified failures (`mandatory_failed[]`) and pending human reviews (`pending_review[]`), preventing premature bidder rejection.
* **Advisory AI Recommendations:** Provides plain-language summaries of findings without pre-empting the procurement officer’s statutory authority.
* **Tamper-Evident Audit Trail:** Hash-chained Postgres audit log that cryptographically verifies log continuity and guarantees accountability.
* **Exportable Evaluation Reports:** Generates structured JSON summaries and printable HTML reports (`/tenders/{id}/report.html`) for official tender committee proceedings.

---

## 5. Technology Stack

* **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
* **Frontend Design System:** Institutional, AA contrast, 8px grid, typography featuring Source Serif 4, Inter, and IBM Plex Mono
* **Backend:** FastAPI (Python 3.11+), Modular Monolith Architecture
* **Database:** PostgreSQL 16 (via Docker or Supabase / Neon)
* **ORM & Migrations:** SQLAlchemy 2.0, Alembic
* **Document Processing & OCR:** PyMuPDF, pdfplumber, Tesseract OCR fallback
* **Fuzzy Text Matching:** `rapidfuzz`
* **LLM Engine:** Multi-provider interface supporting Google Gemini, OpenAI (`gpt-4o`/`gpt-4o-mini`), Anthropic Claude, and offline `stub`
* **Object Storage:** Local hash-addressed filesystem with optional Supabase Cloud Storage synchronization
* **Testing:** `pytest` (240+ unit & integration tests)

---

## 6. Architecture

### High-Level Architecture

```text
                  ┌─────────────────────────────────┐
                  │      Procurement Officer        │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │       Next.js 16 Frontend       │
                  │  (Dashboard, Matrix, Ledger)    │
                  └────────────────┬────────────────┘
                                   │ REST API
                                   ▼
                  ┌─────────────────────────────────┐
                  │         FastAPI Backend         │
                  └─┬──────────────┬──────────────┬─┘
                    │              │              │
       ┌────────────┴──┐    ┌──────┴──────┐ ┌─────┴──────────┐
       │ Document      │    │ Compliance  │ │ External       │
       │ Intelligence  │    │ Rule Engine │ │ Portal Adapter │
       └───────┬───────┘    └──────┬──────┘ └─────┬──────────┘
               │                   │              │
               ▼                   ▼              ▼
       ┌───────────────┐    ┌─────────────┐ ┌─────────────┐
       │ LLM Provider  │    │ PostgreSQL  │ │ Multi-Portal│
       │ (Gemini/OpenAI│    │ Hash-Audit  │ │ Verification│
       │  /Anthropic)  │    │  Database   │ │ (Simulated) │
       └───────────────┘    └─────────────┘ └─────────────┘
```

### The Nine-Layer Pipeline Flow

```text
[NIT Document] ──> 1. Requirement Extraction ──> Officer Confirms Checklist
                                                           │
                                                           ▼
[Bidder PDFs]  ──> 2. Document Classification
                         │
                         ▼
                   3. Evidence Extraction (OCR + Coordinates)
                         │
                         ▼
                   4. Requirement-to-Evidence Matching
                         │
                         ▼
                   5. Cross-Document Verification
                         │
                         ▼
                   6. External Register Verification (GSTN/PAN/Udyam)
                         │
                         ▼
                   7. Compliance Determination (State Machine)
                         │
                         ▼
                   8. Risk Assessment & Transparent Scoring
                         │
                         ▼
                   9. Procurement Officer Final Decision & Audit Log
```

---

## 7. Repository Structure

```text
Vericore/
├── README.md                          # Project documentation and setup guide
├── CLAUDE.md                          # Engineering conventions & core rules
├── docker-compose.yml                 # Local PostgreSQL container service
├── render.yaml                        # Cloud deployment configuration
├── docs/                              # Detailed architectural documentation
│   ├── architecture.md                # System design & specification mapping
│   ├── blueprint.md                   # Complete implementation plan
│   ├── how-it-works.md                # Plain-language guide for evaluators
│   └── frontend-handover.md           # API contracts & screen layouts
├── backend/                           # FastAPI backend
│   ├── pyproject.toml                 # Dependencies and packaging
│   ├── alembic/                       # Database migrations & audit trigger
│   ├── app/
│   │   ├── api/                       # REST routes (tenders, bids, verification)
│   │   ├── db/                        # SQLAlchemy 17-table schema & enums
│   │   ├── llm/                       # LLM providers (Gemini, OpenAI, Anthropic, Stub)
│   │   ├── modules/
│   │   │   ├── tender_service/        # NIT ingestion & checklist confirmation
│   │   │   ├── document_intelligence/ # OCR, parsing & segment classification
│   │   │   ├── evidence_extraction/   # Field extraction & bounding box locator
│   │   │   ├── compliance_engine/     # Deterministic checks, scoring & state machine
│   │   │   ├── risk_engine/           # Discrepancy & risk classification
│   │   │   ├── verification_adapter/  # Multi-portal lookup adapters
│   │   │   ├── audit_service/         # Append-only hash chain audit logger
│   │   │   └── report_service/        # JSON & HTML report generators
│   │   ├── storage.py                 # Hash-addressed immutable file storage
│   │   └── config.py                  # Environment configuration
│   ├── scripts/                       # Demo runner & fixture generators
│   └── tests/                         # Pytest test suites
├── frontend/                          # Next.js 16 frontend
│   ├── package.json                   # Dependencies and scripts
│   ├── next.config.ts                 # Next.js configuration
│   ├── app/                           # App Router routes and pages
│   │   ├── page.tsx                   # Landing page
│   │   ├── tenders/                   # Tender list, creation & setup
│   │   ├── bids/                      # Bidder compliance workspace & audit
│   │   ├── about-us/                  # Project background & context
│   │   └── problem-statement/         # Official problem statement breakdown
│   ├── components/                    # Modular UI components
│   │   ├── analysis/                  # ComplianceMatrix, EvidenceLedger, DecisionBar
│   │   ├── layout/                    # Masthead, SiteHeader, Cards, GlassBox
│   │   └── ui/                        # StatusChip, RiskChip, CustomCursor
│   ├── lib/                           # Typed API client
│   └── types/                         # TypeScript models mirroring backend schemas
└── seed/                              # Seed tender NIT & 3 demo bidder document bundles
```

---

## 8. Compliance & Scoring Engine

Vericore models compliance through a rigorous 9-state compliance state machine:

| Status | Meaning | Treatment in Engine |
|---|---|---|
| `COMPLIANT` | Evidence found, check satisfied, no contradictions | Cleared |
| `NON_COMPLIANT` | Evidence found and clearly falls short of requirement | Mandatory Failure |
| `EXPIRED` | Certificate lapsed prior to tender bid due date | Mandatory Failure |
| `INCONSISTENT` | Documents submitted by bidder contradict each other | Mandatory Failure |
| `PARTIALLY_COMPLIANT`| Satisfies subset of composite requirement | Pending Review |
| `MISSING_EVIDENCE` | No matching document found in bidder bundle | Pending Review (Shortfall request) |
| `UNVERIFIED` | External register check could not be contacted | Pending Review |
| `NEEDS_HUMAN_REVIEW` | Subjective clause requiring officer discretion | Pending Review |
| `NOT_APPLICABLE` | Condition exempted (e.g., MSE/Startup relaxation) | Excluded from Score |

### Scoring Methodology
* The compliance score is a **weighted arithmetic sum** over non-exempt requirements:
  $$\text{Score} = \frac{\sum_{\text{compliant}} \text{Weight}_i}{\sum_{\text{applicable}} \text{Weight}_i} \times 100$$
* **No LLM produces a score or arithmetic.** All calculations are performed in deterministic Python.
* A bidder is only `qualifiable` when both `mandatory_failed` and `pending_review` lists are completely resolved.

---

## 9. Data Integrity & Security

* **Immutable File Storage:** Uploaded PDFs are addressed strictly by SHA-256 digests (`digest[:2]/digest[2:4]/digest.pdf`). Files are never mutated or recomputed.
* **Hash-Chained Append-Only Audit:**
  - Implemented directly in PostgreSQL via table triggers (`vericore_audit_event_payload`).
  - Row modification (`UPDATE`) or deletion (`DELETE`) on `audit_events` is refused at the database level.
  - Every review action records `actor_id`, `previous_state`, `new_state`, and mandatory `reason`.
* **Zero Credential Exposure:**
  - Frontend communicates exclusively with the backend API.
  - LLM API keys, database credentials, and service role secrets are never exposed in browser bundles.

---

## 10. Demo Data

Vericore ships with pre-built test fixtures and document bundles under `seed/`:

| Bidder | Entity Name | Profile / Test Scenario |
|---|---|---|
| **Bidder A** | ABC Infrastructure Pvt. Ltd. | Clean compliance profile. Single subjective materials specification requiring officer acceptance to qualify. |
| **Bidder B** | ABC Engineers Pvt. Ltd. | Problematic profile. Turnover shortfall, expired ISO certificate, missing OEM authorization, and mismatched PAN between GSTIN and PAN card. |
| **Bidder C** | Coastal Marine Works Pvt. Ltd. | Ambiguous profile. Holding company turnover submitted; routes to officer review for parent-entity consideration. |

Run the entire end-to-end demo via CLI:
```bash
cd backend
python scripts/run_demo.py
```

---

## 11. Installation & Setup

### Prerequisites
* **Docker & Docker Compose** (for PostgreSQL)
* **Python 3.11+**
* **Node.js 20+** and **npm**

### 1. Clone Repository
```bash
git clone https://github.com/prathamsahu31/Vericore.git
cd Vericore
```

### 2. Environment Configuration
```bash
cp .env.example .env
```
*(The default `.env` runs out-of-the-box using the offline stub provider and local database).*

### 3. Start Database
```bash
docker compose up -d
```

### 4. Backend Setup
```bash
cd backend
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```
Interactive backend API documentation will be available at: **http://localhost:8000/docs**

### 5. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Access the web application at: **http://localhost:3000**

---

## 12. Environment Variables

### Backend (`.env`)
```env
# Provider: stub (offline default) | openai | gemini | anthropic
LLM_PROVIDER=stub
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Database
DATABASE_URL=postgresql://vericore:vericore@localhost:5432/vericore

# Storage
STORAGE_PATH=./storage

# Application
API_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_OFFICER_ID=00000000-0000-0000-0000-000000000001
```

---

## 13. Available Scripts

| Scope | Command | Description |
|---|---|---|
| Backend | `uvicorn app.main:app --reload` | Run FastAPI backend development server |
| Backend | `alembic upgrade head` | Apply database migrations |
| Backend | `pytest` | Run comprehensive test suite (240+ tests) |
| Backend | `python scripts/run_demo.py` | Execute automated end-to-end verification demo |
| Frontend | `npm run dev` | Start Next.js development server |
| Frontend | `npm run build` | Build optimized Next.js production bundle |
| Frontend | `npm run lint` | Run ESLint across frontend code |

---

## 14. Expected Impact

* **60–80% Reduction in Verification Effort:** Eliminates manual manual cross-referencing between dense bid documents and tender clauses.
* **Faster Tender Evaluation & Award:** Turns multi-day compliance evaluations into streamlined, single-sitting reviews.
* **Elimination of Human Oversight:** Automated cross-document comparison immediately flags subtle contradictions across files.
* **Standardized Evaluation:** Uniform compliance rules and audit trails across CPSEs and government buying entities.
* **Complete Audit Readiness:** 100% evidentiary traceability ensures every decision is defensible under institutional scrutiny.

---

## 15. Important Disclaimer

**Vericore is an AI-powered verification assistant and decision-support system, not an autonomous authority.**

The platform produces structured findings, evidence coordinates, and advisory assessments. The statutory decision to qualify, disqualify, accept, or override any bidder compliance condition rests solely with the designated **Procurement Officer**.

---

## 16. License

This project is developed for the **Smart India Hackathon (SIH) 2026** under Problem Statement **26100**.
All rights reserved.
