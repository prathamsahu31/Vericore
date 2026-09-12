# SIH 2026 Project Repository

This repository contains the official implementation of **Vericore**, an AI-powered integrated bid compliance verification and decision-support platform for GeM procurement, built for the Smart India Hackathon (SIH) 2026.

## 1. Project Information

- **Project Title:** Vericore – AI-Powered Integrated Bid Compliance Verification Platform
- **PS ID:** SIH26100 / 26100
- **PS Title:** AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement
- **Category:** Software
- **Theme:** Smart Automation
- **Organization:** Ministry of Petroleum & Natural Gas
- **Department:** Chennai Petroleum Corporation Limited (CPCL)

> 🔗 **Submission Links:**
> - 📺 **Demo Video:** [Google Drive Demo Folder](https://drive.google.com/drive/folders/1s349utNy1AN2U3Vqu7gzFLQX6H1dwMES) | [Walkthrough Guide](submission/DEMO.md)
> - 📊 **Presentation (PPT/PDF):** [Google Drive Slides Folder](https://drive.google.com/drive/folders/1SJl4-hgV8KyzcWRJqaH-aouzYmXXAPHH) | [Direct PDF](submission/vericore.pdf) | [Presentation Details](submission/PRESENTATION.md)

## 2. Problem Statement

Government procurement through the Government e-Marketplace (GeM) requires rigorous verification of statutory, regulatory, and technical eligibility requirements across multiple bidders. Procurement officers must manually examine and validate dense tender documents (NIT/RFP) and massive bidder document bundles containing:

- Udyam / MSME registration & relaxations
- GST registration, state codes, and return filing status
- PAN and Income Tax compliance
- Make in India (MII) local content declarations
- EPFO / ESIC statutory compliance
- Startup India, NSIC, and OEM authorizations
- Tender-specific financial turnovers, net worth, and past experience certificates

### Core Challenges

- **Manual & Document-Intensive:** Evaluating high volumes of submitted multi-page PDFs requires hours of manual cross-referencing against detailed tender clauses.
- **Portal Fragmentation:** Verifying statutory compliance requires manually checking disparate government portals (GSTN, PAN, MCA21, EPFO, etc.).
- **Risk of Inconsistencies & Human Error:** Overlooking fine print or missing cross-document discrepancies (e.g., mismatched PAN between GST certificate and PAN card) can lead to flawed disqualifications or improper contract awards.
- **Auditability & Legal Scrutiny:** Every decision must withstand legal audits and CVC/CAG inquiries with complete, tamper-evident audit trails.

> **Guiding Principle:** **The officer decides. The system never does.** Vericore does not qualify or disqualify bidders autonomously; it provides verifiable citations, transparent calculations, and decision support.

## 3. Proposed Solution

**Vericore** is a modern, modular bid compliance verification platform designed specifically for GeM procurement workflows:

1. **Automated Tender Requirement Extraction:** Parses free-text Notice Inviting Tender (NIT) documents into a structured, clause-by-clause eligibility checklist with human confirmation gates.
2. **Deterministic Evidence Extraction & OCR:** Extracts key values (GSTIN, PAN, dates, financials, turnover) with exact page bounding-box coordinates for 1-click drill-down audits.
3. **Multi-Portal Verification (Simulated/Hybrid Adapter):** Validates bidder identifiers against Udyam, GSTN, MCA21, PAN, DigiLocker, and debarment registries (clearly stamped `simulated` or `live`).
4. **Deterministic Compliance & Cross-Document Engine:** Performs threshold evaluations, turnover averaging, certificate expiry checks, and detects contradictions across a bidder’s own documents.
5. **Arithmetic Scoring & Risk Assessment:** Computes an un-hallucinated, weighted arithmetic compliance score and categorizes risk levels based on count and severity of discrepancies.
6. **Append-Only Hash-Chained Audit Trail:** Cryptographically secures every officer action and verification step in PostgreSQL with SHA-256 hash chains.

## 4. Key Features

- **Tender Requirement Extraction:** Structured clause checklist extracted using an LLM reasoning layer with human officer review and confirmation locks.
- **Exact Evidence Pinpointing:** Every verdict is linked to `{document, page, coordinates}` bounding boxes so officers can inspect the original PDF in one click.
- **Cross-Document Contradiction Detection:** Spots critical discrepancies (e.g., mismatched entity names, differing PANs embedded inside GSTIN vs PAN card).
- **Deterministic Rule Engine:** Financial averages, date validity relative to bid due dates, and mathematical thresholds are executed in deterministic code—never hallucinated by an LLM.
- **Multi-Portal Adapter Layer:** Integrates Udyam, GSTN, MCA21, PAN, EPFO/ESIC, DigiLocker, and blacklisting checks behind a unified interface with transparent `live` / `simulated` labeling.
- **Two-Gate Evaluation System:** Distinguishes between verified failures (`mandatory_failed[]`) and pending human reviews (`pending_review[]`), preventing premature bidder rejection.
- **Advisory AI Recommendations:** Provides plain-language summaries of findings without pre-empting the procurement officer’s statutory authority.
- **Tamper-Evident Audit Trail:** Hash-chained Postgres audit log that cryptographically verifies log continuity and guarantees accountability.
- **Exportable Evaluation Reports:** Generates structured JSON summaries and printable HTML reports (`/tenders/{id}/report.html`) for official tender committee proceedings.

## 5. Technology Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend:** Python 3.11+, FastAPI (Modular Monolith)
- **Database:** PostgreSQL 16 (via Docker / Neon / Supabase)
- **ORM & Migrations:** SQLAlchemy 2.0, Alembic
- **Document Intelligence & OCR:** PyMuPDF, pdfplumber, Tesseract OCR fallback, rapidfuzz
- **LLM Engine:** Multi-provider interface supporting Google Gemini, OpenAI (`gpt-4o`/`gpt-4o-mini`), Anthropic Claude, and offline `stub`
- **Testing:** `pytest` (240+ unit & integration tests)
- **Deployment:** Docker, Docker Compose, Render

## 6. Architecture

See [docs/architecture.md](docs/architecture.md).

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

## 7. Repository Structure

```text
Vericore/
├── README.md                          # Project overview and documentation
├── CLAUDE.md                          # Engineering conventions & core rules
├── docker-compose.yml                 # Local PostgreSQL container service
├── render.yaml                        # Cloud deployment configuration
├── docs/                              # Detailed architectural documentation
│   ├── architecture.md                # System design & specification mapping
│   ├── blueprint.md                   # Complete implementation plan
│   ├── how-it-works.md                # Plain-language guide for evaluators
│   └── frontend-handover.md           # API contracts & screen layouts
├── submission/                        # SIH 2026 presentation & demo links
│   ├── PRESENTATION.md                # Presentation slides and link
│   └── DEMO.md                        # Video demonstration links
├── assets/                            # Screenshots and media assets
│   └── screenshots/
│       └── README.md                  # Prototype and workflow screenshots
├── backend/                           # FastAPI backend
│   ├── pyproject.toml                 # Dependencies and packaging
│   ├── alembic/                       # Database migrations & audit trigger
│   ├── app/                           # REST routes, DB models, and core modules
│   ├── scripts/                       # Automated demo runner & fixture scripts
│   └── tests/                         # Pytest test suites (240+ tests)
├── frontend/                          # Next.js 16 frontend
│   ├── package.json                   # Dependencies and scripts
│   ├── app/                           # App Router routes and pages
│   ├── components/                    # UI components & compliance ledger
│   └── lib/                           # Typed API client
└── seed/                              # Seed tender NIT & 3 demo bidder document bundles
```

### What goes where?

| Item | Location / Link |
|---|---|
| Source code | `backend/` and `frontend/` |
| Architecture / technical documentation | `docs/` |
| Project screenshots / prototype visuals | `assets/screenshots/` |
| Final PPT / presentation | [Google Drive Folder](https://drive.google.com/drive/folders/1SJl4-hgV8KyzcWRJqaH-aouzYmXXAPHH) \| [Direct PDF](submission/vericore.pdf) \| [submission/PRESENTATION.md](submission/PRESENTATION.md) |
| Demo video | [Google Drive Folder](https://drive.google.com/drive/folders/1s349utNy1AN2U3Vqu7gzFLQX6H1dwMES) \| [submission/DEMO.md](submission/DEMO.md) |
| Project overview | `README.md` |

## 8. Final Presentation

- **Google Drive Presentation Folder:** [Vericore Final Presentation (Google Drive)](https://drive.google.com/drive/folders/1SJl4-hgV8KyzcWRJqaH-aouzYmXXAPHH)
- **Repository Direct PDF:** [submission/vericore.pdf](submission/vericore.pdf)
- Detailed breakdown & slide structure: [submission/PRESENTATION.md](submission/PRESENTATION.md)

## 9. Demo Video

- **Google Drive Demo Video:** [Vericore Demo Video (Google Drive)](https://drive.google.com/drive/folders/1s349utNy1AN2U3Vqu7gzFLQX6H1dwMES)
- Video walkthrough timestamps & feature breakdown: [submission/DEMO.md](submission/DEMO.md)

## 10. Screenshots / Prototype Photos

Add important screenshots or hardware/prototype photos to:

`assets/screenshots/`

See [assets/screenshots/README.md](assets/screenshots/README.md) for examples and naming conventions.

## 11. Installation

```bash
# Clone the repository
git clone https://github.com/prathamsahu31/Vericore.git
cd Vericore

# 1. Environment Configuration
cp .env.example .env

# 2. Start Database (PostgreSQL)
docker compose up -d

# 3. Backend Setup
cd backend
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

pip install -e ".[dev]"
alembic upgrade head
cd ..

# 4. Frontend Setup
cd frontend
npm install
cd ..
```

## 12. Run

### Start Backend API
```bash
cd backend
# With venv activated:
uvicorn app.main:app --reload --port 8000
```
Interactive backend API documentation will be available at: `http://localhost:8000/docs`

### Start Frontend Application
```bash
cd frontend
npm run dev
```
Access the web application at: `http://localhost:3000`

### Automated End-to-End Demo (Optional)
Run the automated verification pipeline across all sample bidders via CLI:
```bash
cd backend
python scripts/run_demo.py
```

## 13. Future Scope

- **Direct GeM API & NIC Integration:** Direct webhook integration with the Government e-Marketplace to ingest live tender bids and auto-sync evaluation outcomes.
- **Cross-Portal Live Verification:** Extending simulated adapters into production API gateways for live GSTN, MCA21, EPFO, and CVC debarment lookups.
- **Multi-Language OCR Support:** Ingestion of state-level bid documents in vernacular Indian languages (Hindi, Tamil, Marathi, etc.) using fine-tuned multilingual OCR models.
- **Federated Tender Committee Collaborative Reviews:** Real-time multi-officer collaborative scoring room with digital signatures and role-based clearance hierarchies.
- **Advanced Anomaly & Collusion Detection:** Cross-bidder pattern analysis to detect potential cartels, shared contact metadata, or synchronized bidding anomalies.

## Important

Before submission, make sure the repository is accessible to reviewers. Do **not** upload passwords, API keys, access tokens, `.env` files containing secrets, or other confidential credentials.
