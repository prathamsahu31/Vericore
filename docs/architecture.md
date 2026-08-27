# AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement

**Problem Statement ID:** 26100
**Organisation:** Ministry of Petroleum & Natural Gas — Chennai Petroleum Corporation Limited (CPCL)
**Category:** Software · Smart Automation
**Document version:** 1.0 — Project Architecture & Design Specification

---

## 1. What this document is

A complete build specification. It states what the system takes in, what it puts out, how every one of the fourteen stated requirements is satisfied by a named component, how those components fit together, and how the interface should look and behave.

Read section 3 first if you only read one section. Everything else is an expansion of it.

---

## 2. The problem, restated in operational terms

A procurement officer evaluating a GeM tender receives bids from N companies. For each bidder they must establish, with evidence, that the company:

- legally exists and is who it claims to be
- holds the statutory registrations the tender requires
- is current on its filings (GST returns, income tax, EPFO/ESIC contributions)
- meets the tender's own eligibility bar (turnover, past experience, certifications)
- is not blacklisted or debarred anywhere
- has whatever category-specific standing it claims — MSME, Startup India, NSIC, OEM authorisation, local content

Each of these requires opening a different government portal, keying in an identifier, and comparing the portal's answer against a PDF the bidder uploaded. For a 30-bidder tender with 12 applicable checks, that is 360 manual lookups, performed with varying rigour by different officers, leaving behind no structured record of what was actually verified.

The platform's job is to perform those lookups automatically, compare them against submitted documents, surface every gap and contradiction, and present the officer with a single reviewable screen per bidder — while leaving the qualify/disqualify decision entirely in human hands.

---

## 3. Input and output contract

This is the spine of the system. Every module exists to move data from the left column to the right.

### 3.1 Inputs

**A. Tender package** (one per tender)

| Item | Format | Example |
|---|---|---|
| Tender / RFP document | PDF (native or scanned) | GeM bid document, RFP Volume II with PQ criteria |
| Tender metadata | Form fields / JSON | Bid number, estimated value, category, contract period, EMD amount |
| Relaxation flags | Boolean | MSE relaxation on experience/turnover: yes/no. Startup relaxation: yes/no |
| Buyer-added ATC | PDF / text | Additional terms that override or extend standard conditions |

**B. Bidder submission** (one per bidder, N per tender)

| Item | Format | Purpose |
|---|---|---|
| Declared identifiers | Form fields | PAN, GSTIN, Udyam Registration Number, CIN/LLPIN, EPFO establishment code, ESIC code |
| Document bundle | PDF / JPG / PNG, multi-file | Incorporation certificate, GST registration certificate, PAN card, Udyam certificate, audited balance sheets, ITR acknowledgements, work orders + completion certificates, CMMI/ISO certificates, OEM authorisation letters, board resolution / power of attorney, self-declarations (non-blacklisting, non-bankruptcy), local content certificate |
| DigiLocker consent | OAuth grant | Optional — lets the system pull issuer-signed documents directly instead of trusting an upload |

**C. External data** (fetched by the system, not supplied by the user)

Live or simulated responses from Udyam, GSTN, Income Tax/PAN, MCA21, Startup India, NSIC, EPFO, ESIC, DigiLocker, BIS/DPIIT, and blacklist/debarment registries.

### 3.2 Outputs

**A. Structured eligibility checklist** — the tender document converted into machine-readable criteria.

```json
{
  "tender_id": "GEM/2026/B/7496914",
  "criteria": [
    { "id": "PQ-01", "type": "legal_entity", "rule": "registered_under_companies_act",
      "min_operating_years": 5, "as_on": "2024-03-31", "mandatory": true, "weight": 0 },
    { "id": "PQ-03", "type": "turnover", "metric": "average_annual_turnover",
      "operator": ">=", "value": 5000000000, "currency": "INR",
      "financial_years": ["2021-22","2022-23","2023-24"], "mandatory": true, "weight": 0 },
    { "id": "TQ-01", "type": "past_experience", "min_project_value": 100000000,
      "min_count": 1, "domain_keywords": ["artificial intelligence","data analytics"],
      "mandatory": false, "weight": 10 }
  ]
}
```

**B. Per-criterion verdict** — for every criterion, for every bidder.

| Field | Values | Notes |
|---|---|---|
| `status` | `PASS` / `FAIL` / `NEEDS_REVIEW` / `NOT_APPLICABLE` | Four states, never three. `NEEDS_REVIEW` is what the system returns when a portal is unreachable, OCR confidence is low, or two sources disagree without a clear winner |
| `evidence` | Array | Each entry: source (document page + bounding box, or portal + response timestamp), extracted value, confidence |
| `reason` | String | Plain-language explanation of why this status |
| `confidence` | 0.0–1.0 | Extraction/match confidence, surfaced to the officer |

**C. Compliance score** — 0 to 100, with full weight decomposition. Never a single opaque number.

**D. Risk level** — `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`, each traced to specific triggering flags.

**E. Recommendation** — natural language, evidence-linked:

> *"Bidder ABC Infrastructure Pvt Ltd — 2 mandatory criteria unmet. GSTR-3B not filed for Q2 and Q3 FY2025-26 (GSTN portal, retrieved 27 Aug 2026). Entity name on Udyam certificate ('ABC Infra Private Ltd') does not match PAN records ('ABC Infrastructure Private Limited') — likely a registration data entry variance, not a distinct entity. Recommended action: seek clarification on GST filing before disqualification."*

**F. Audit record** — append-only, per check: what was checked, when, against which source, what came back, document hash, model version, and every officer override with mandatory reason.

**G. Officer decision** — `QUALIFIED` / `DISQUALIFIED` / `CLARIFICATION_SOUGHT`, captured with timestamp, officer identity, and justification. This is a system input at the end, and it is the only place a final decision is made.

---

## 4. Requirements traceability

Every numbered requirement from the problem statement, mapped to the component that satisfies it. This table is the contract with the evaluator — nothing in the PS should be unaccounted for.

| # | Requirement | Component | How it is satisfied |
|---|---|---|---|
| 1 | Integrate with Government portals for automated verification | **Portal Integration Layer** (§6.4) | Uniform connector interface, one adapter per portal, with circuit breakers, caching, retry and a simulation backend for portals without programmatic access |
| 2 | Verify Udyam/MSME status | `UdyamConnector` + MSME rule set | Udyam number format validation → portal lookup → enterprise name, type (micro/small/medium), NIC codes, date of registration. Cross-checked against PAN and GSTIN |
| 3 | Verify GST registration and return filing | `GstnConnector` | Registration status (active/cancelled/suspended), legal + trade name, registration date, and the filing-history table for GSTR-1 / GSTR-3B over the required period |
| 4 | Verify PAN and Income Tax compliance | `PanConnector` + structural validator | PAN format and check-digit validation, name-against-PAN verification, PAN-embedded-in-GSTIN consistency, ITR acknowledgement number validation against filed returns |
| 5 | Check Make in India / local content | `LocalContentModule` | Extracts declared local content percentage from the bidder's certificate, checks it against the tender's Class-I/Class-II threshold, validates the certifying authority (statutory auditor above ₹10 Cr, self-certification below) |
| 6 | Verify EPFO/ESIC compliance | `EpfoConnector`, `EsicConnector` | Establishment code validity, employee count, contribution payment continuity. Employee count is also cross-checked against the team size the bidder claims for the project |
| 7 | Verify Startup India, NSIC, OEM authorisation | `StartupIndiaConnector`, `NsicConnector`, `OemAuthValidator` | DPIIT recognition number and validity window; NSIC registration and monetary limit; OEM letter parsed for authorised dealer name, product scope, validity, and issuing entity |
| 8 | DigiLocker / document verification | `DigiLockerConnector` + `DocumentIntegrityService` | Issuer-signed document pull via consent; digital signature validation on submitted PDFs; tamper signal detection on scans |
| 9 | Blacklisting and debarment status | `DebarmentRegistryService` | Searches aggregated debarment lists (GeM seller suspension, CPPP, ministry circulars, state PWD lists) by name and by PAN, with fuzzy name matching to catch renamed entities |
| 10 | Other statutory and tender-specific requirements | `RuleEngine` (§6.6) | Declarative rule definitions so a new tender adds YAML, not code. Handles CMMI level, ISO certification, net worth, EMD, integrity pact, power of attorney, consortium constraints |
| 11 | AI identification of missing/inconsistent/non-compliant information | `CrossVerificationEngine` (§6.5) + `GapDetector` | Rule-based consistency checks plus ML-assisted name/address matching and anomaly scoring |
| 12 | Overall Compliance Score and Risk Level | `ScoringService` (§6.7) | Deterministic weighted model with mandatory gates; risk from an independent red-flag model |
| 13 | AI-generated recommendation to the Procurement Officer | `RecommendationService` (§6.8) | LLM narrative generation constrained to the structured verdict set — it can only describe findings, never invent them |
| 14 | Auditable record of verification and compliance checks | `AuditService` (§6.9) | Append-only hash-chained log, exportable as a signed evaluation report |
| — | Final decision remains with the officer | `DecisionWorkflow` | No auto-disqualification path exists in the codebase. The system produces a recommendation; only an authenticated officer action changes bidder status |

---

## 5. System architecture

### 5.1 Layers

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION                                               │
│  Officer dashboard · Bidder comparison · Evidence ledger    │
│  Audit viewer · Report export                               │
├─────────────────────────────────────────────────────────────┤
│  API                                                        │
│  REST (FastAPI) · Auth/RBAC · Rate limiting · WebSocket for │
│  live verification progress                                 │
├─────────────────────────────────────────────────────────────┤
│  ORCHESTRATION                                              │
│  Verification job runner · Task queue · Retry & backoff     │
│  Per-bidder DAG: extract → verify → cross-check → score     │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN SERVICES                                            │
│  TenderParser · DocClassifier · Extractor · RuleEngine      │
│  CrossVerifier · Scoring · Recommendation · Audit           │
├─────────────────────────────────────────────────────────────┤
│  INTEGRATION                                                │
│  Portal connector interface · Live adapters · Simulation    │
│  backend · Response cache · Circuit breaker                 │
├─────────────────────────────────────────────────────────────┤
│  DATA                                                       │
│  PostgreSQL (entities, verdicts, audit) · Object store      │
│  (documents) · Redis (queue, cache) · Vector store (RAG)    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Processing sequence for one bidder

1. **Ingest** — documents land in object storage, each hashed (SHA-256) on arrival. Hash is the immutable reference used everywhere downstream.
2. **Classify** — every file is labelled by document type. Unclassifiable files are flagged, not silently dropped.
3. **Extract** — structured fields pulled from each document, with page coordinates retained so the UI can highlight the source region.
4. **Verify** — parallel fan-out to portal connectors, keyed on the declared identifiers.
5. **Cross-check** — extracted document values vs portal values vs declared values, all three compared.
6. **Evaluate** — the rule engine walks the tender's criteria list and assigns a verdict to each.
7. **Score & flag** — weighted score computed; independent risk model run.
8. **Narrate** — recommendation generated from the verdict set.
9. **Seal** — the whole run is written to the audit chain and surfaced on the dashboard.

Steps 3–5 are the expensive ones and run asynchronously; the dashboard streams progress rather than blocking.

---

## 6. Module specifications

### 6.1 Tender Requirement Parser

**Input:** tender/RFP PDF. **Output:** the structured criteria JSON shown in §3.2A.

Government tender documents are semi-structured — pre-qualification criteria almost always arrive as a table with columns for criterion, detail, applicability, and required documents. The parser works in three passes:

1. **Section location** — find the PQ criteria and technical evaluation sections by heading pattern and table structure.
2. **Table extraction** — recover the table as rows, preserving merged cells and multi-line detail text.
3. **Rule synthesis** — an LLM converts each row into a typed criterion object against a fixed schema, with the raw row text retained for provenance.

**Design decision:** the parser output is *always* shown to the officer for confirmation before verification runs. Misreading a threshold is the one error that would silently corrupt every downstream verdict, so a human confirms the checklist once per tender. This costs two minutes and eliminates the entire class of failure.

**Handling GeM vs RFP formats:** a GeM bid document carries criteria in structured metadata plus attached scope-of-work PDFs; a classical RFP carries them in numbered tables. Two parser profiles, same output schema.

### 6.2 Document Classifier

**Input:** an unlabelled file. **Output:** document type + confidence.

Bidders upload files named `scan_003.pdf`. The classifier assigns one of ~25 types (Udyam certificate, GST registration certificate, PAN card, ITR-V, balance sheet, work order, completion certificate, CMMI certificate, OEM authorisation, board resolution, affidavit, and so on).

Implementation: first-page text extraction → TF-IDF features → gradient-boosted classifier, with a keyword-rule fallback below 0.7 confidence and a visual model (document image classification) for pure scans. Anything still ambiguous goes to a manual-tag queue in the UI rather than being guessed.

### 6.3 Extraction Service

**Input:** classified document. **Output:** typed fields with page coordinates and confidence.

Three extraction paths depending on document character:

| Document character | Method |
|---|---|
| Native-text PDF with predictable layout (GST cert, Udyam cert) | Template-anchored regex + positional rules. Fast, near-perfect, no model needed |
| Native-text PDF with variable layout (work orders, OEM letters) | LLM extraction against a per-type JSON schema, with the source text chunk kept for provenance |
| Scanned image or photo | Preprocessing (deskew, denoise, binarise) → OCR → layout model for tables → LLM normalisation |

**Coordinates are mandatory.** Every extracted field carries `{page, x0, y0, x1, y1}`. This is what makes the evidence ledger in the UI possible: click a value, see it highlighted on the original document. Without it, the officer has to take the system's word, which defeats the purpose.

### 6.4 Portal Integration Layer

The most-discussed and most-misunderstood part of this project. Two honest constraints shape it:

1. Most of these portals do not expose open, freely-usable REST APIs. Some offer public search forms, some offer paid/registered API access through authorised intermediaries, some offer nothing programmatic at all.
2. The problem statement explicitly permits dummy bidder and tender datasets for development and testing.

The architecture therefore treats *how* a portal is reached as a swappable implementation detail behind a fixed interface.

```python
class PortalConnector(Protocol):
    portal_id: str
    def verify(self, identifier: str, context: dict) -> PortalResponse: ...
    def health(self) -> HealthStatus: ...

@dataclass
class PortalResponse:
    portal_id: str
    identifier: str
    status: Literal["found", "not_found", "invalid_format", "unavailable"]
    data: dict
    retrieved_at: datetime
    source: Literal["live", "cached", "simulated"]   # never hidden from the officer
    raw_response_hash: str
```

The `source` field is non-negotiable. A simulated response is labelled as simulated everywhere it appears — in the API, in the dashboard, and in the exported report. Presenting mock data as live verification would be the single most damaging thing this system could do.

**Portal inventory and access strategy**

| Portal | What it establishes | Realistic access route | Notes |
|---|---|---|---|
| DigiLocker | Issuer-signed documents, identity | Partner API with OAuth consent — has a documented sandbox | Best real integration to build. Issuer-signed documents are cryptographically trustworthy in a way uploads never are |
| GSTN | Registration status, filing history | Public taxpayer search; full API via authorised GSP | Public search covers a lot of the demo need |
| Udyam | MSME status, enterprise type | Public verification page keyed on URN | |
| MCA21 | Company existence, directors, charges | Public master-data views; bulk data products | Useful for the shell-company signal |
| PAN / Income Tax | PAN validity, name match | Restricted; routed through authorised agencies | Structural validation (format + check digit + GSTIN embedding) is doable offline and catches most fabrications |
| EPFO / ESIC | Employer registration, contribution continuity | Establishment search interfaces | |
| Startup India | DPIIT recognition | Certificate verification interface | |
| NSIC | Registration, monetary limit | Certificate verification | |
| BIS / DPIIT | Product certification, local content policy class | Public certification directories | |
| Debarment registries | Blacklisting | Aggregated from GeM suspension lists, CPPP, ministry and state circulars | No single national register exists — aggregation plus fuzzy matching is the design |

> **Verify current availability before building.** Government portal access routes change frequently, and terms of use govern automated access. Confirm each portal's current API/terms directly before implementing a live adapter, and never scrape a portal whose terms prohibit it. For anything not cleanly available, the simulation backend is the correct and defensible answer.

**Resilience behaviour:** each connector has a circuit breaker. Three consecutive failures opens the circuit for a cooldown period; during that window the system returns `unavailable`, which maps to a `NEEDS_REVIEW` verdict — never to `FAIL`. A portal being down must never cost a bidder their tender.

**Caching:** portal responses are cached with type-specific TTLs (registration status: 24h; filing history: 6h; debarment: 1h). Every cache hit is recorded in the audit log with its original retrieval time, so an officer always knows how fresh a fact is.

### 6.5 Cross-Verification Engine

Where the real intellectual value sits, and where most of the logic is deterministic rather than learned.

**Structural checks** (pure computation, zero false positives):

- **PAN format** — `[A-Z]{5}[0-9]{4}[A-Z]`, with the 4th character encoding holder type (`C` company, `P` individual, `F` firm, `H` HUF, `T` trust). A bidder claiming to be a company whose PAN has `P` in position 4 is an immediate flag.
- **GSTIN structure** — 15 characters: state code (2) + PAN (10) + entity number (1) + `Z` (1) + checksum (1). **Characters 3–12 of the GSTIN must equal the PAN exactly.** This single check catches a large share of copy-paste and fabrication errors, costs nothing, and is fully explainable.
- **GSTIN checksum** — validate the final check character.
- **Udyam URN format** — `UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}`, state code cross-checked against the registered address.
- **CIN structure** — 21 characters encoding listing status, industry code, state, year of incorporation, ownership type, and registration number. Year of incorporation from the CIN must agree with the incorporation certificate.

**Semantic checks** (need matching intelligence):

- **Entity name consistency** across PAN, GSTIN, Udyam, MCA, bank details and the bid cover letter. Normalisation pipeline: case-fold → strip legal suffixes against a dictionary (`Pvt Ltd`, `Private Limited`, `(P) Ltd`, `LLP`, `& Co.`) → strip honorifics (`M/s`) → collapse whitespace and punctuation → compare with Jaro-Winkler. Below the confidence threshold, fall back to sentence embeddings. Output is a similarity score with an explanation, not a bare boolean.
- **Address consistency** across registrations, with pincode as a hard anchor.
- **Financial consistency** — turnover declared in the bid vs the CA certificate vs the audited balance sheet vs GST annual turnover. Small variances are normal (different accounting treatments); order-of-magnitude gaps are not.
- **Temporal consistency** — incorporation date vs "5 years continuous operation" claim; certificate issue and expiry dates vs bid submission date; claimed project dates vs the eligibility window.
- **Capacity consistency** — EPFO employee count vs the team size the bidder proposes to deploy.

**Output:** a list of discrepancy objects, each with severity (`INFO` / `WARNING` / `CRITICAL`), the two conflicting values, their sources, and a plain-language description.

### 6.6 Compliance Rule Engine

Rules are declarative data, not code. A new tender must never require a deployment.

```yaml
- id: PQ-03
  name: Average annual turnover
  type: threshold
  mandatory: true
  applies_when:
    always: true
  relaxation:
    mse: { applicable: false }        # from tender metadata
  inputs:
    - source: document
      doc_type: ca_turnover_certificate
      field: average_annual_turnover
    - source: portal
      portal: gstn
      field: annual_aggregate_turnover
  evaluate:
    operator: ">="
    value: 5000000000
    prefer_source: document
    on_source_conflict:
      tolerance_pct: 15
      beyond_tolerance: NEEDS_REVIEW
  on_missing_evidence: NEEDS_REVIEW
  weight: 0
```

Key behaviours:

- **Conditional applicability.** A criterion can be scoped — MSME-specific rules only fire for bidders claiming MSME status; OEM authorisation only when the tender procures branded goods; ESIC only above the employee threshold. Non-applicable criteria return `NOT_APPLICABLE` and are excluded from the score denominator, so a bidder is never penalised for a rule that doesn't concern them.
- **Relaxation handling.** MSE and startup relaxations on experience and turnover are read from the tender metadata and applied automatically, because forgetting them is a common human error.
- **Missing evidence is not failure.** Absent documentation yields `NEEDS_REVIEW`, which routes to the clarification workflow — mirroring real procurement practice, where shortfall documents are solicited rather than treated as instant disqualification.

### 6.7 Scoring and Risk

**Two independent outputs. Do not conflate them.**

**Compliance score** answers *"how completely does this bidder satisfy the tender's requirements?"*

```
mandatory_gate = all(c.status == PASS for c in criteria if c.mandatory and c.applicable)

score = 100 × Σ(weightᵢ × statusValueᵢ) / Σ(weightᵢ)
        over applicable criteria

statusValue:  PASS = 1.0 · NEEDS_REVIEW = 0.5 · FAIL = 0.0
```

If `mandatory_gate` is false the bidder cannot be qualified regardless of score — and the UI states which mandatory criterion failed, prominently, rather than burying it behind a percentage.

The score is a transparent weighted sum. It is not a model output. It can be recomputed by hand from the verdict table, which is exactly the property an audit or a tender challenge requires.

**Risk level** answers a different question: *"how likely is this bidder to be misrepresenting itself?"* It is driven by red-flag signals, not by criterion pass rates.

| Signal | Weight | Rationale |
|---|---|---|
| Blacklist/debarment hit | Critical | Disqualifying on its own |
| Document tamper signal | Critical | Forgery indicator |
| Entity name mismatch across statutory registrations | High | Possible identity substitution |
| Company incorporated < 12 months before a high-value bid | High | Shell-company pattern |
| GST return filing gaps | High | Going-concern doubt |
| Turnover-to-bid-value ratio outside normal range | Medium | Capacity overreach |
| Directors shared with a debarred entity | High | Renamed-entity evasion |
| Certificate expiring before contract start | Medium | Continuity risk |
| Address shared with other bidders on the same tender | High | Collusion / bid-rigging indicator |
| EPFO headcount far below proposed team size | Medium | Capability overstatement |

Bands: `CRITICAL` on any critical signal; `HIGH` on two or more high signals; `MEDIUM` on one high or three medium; else `LOW`.

An optional Isolation Forest over the numeric feature set produces a supplementary outlier score. It is presented as an *additional signal for the officer's attention*, never as a rule input — an unsupervised model with no labelled ground truth cannot be allowed to move a compliance verdict.

### 6.8 Recommendation Service

An LLM writes the officer-facing narrative, under strict constraints:

- **Input is only the structured verdict set.** The model never sees raw documents at this stage, so it cannot introduce facts that aren't in the verdicts.
- **Output is schema-constrained** — a summary paragraph, a list of gaps, a suggested action from a fixed enum (`RECOMMEND_QUALIFY`, `SEEK_CLARIFICATION`, `RECOMMEND_DISQUALIFY`, `MANUAL_REVIEW_REQUIRED`), and a mandatory citation array pointing at criterion IDs.
- **Every sentence must cite.** Post-generation validation rejects any claim not traceable to a criterion ID, and regenerates.
- **The suggested action is advisory and labelled as such** in the interface.

### 6.9 Audit Service

Append-only. No updates, no deletes, enforced at the database level.

Each record: event ID, tender ID, bidder ID, event type, actor (system component or officer identity), timestamp, criterion ID where applicable, input hash, output payload, portal response hash, model name and version where an ML component was involved, and the hash of the previous record.

Hash-chaining each record to its predecessor makes tampering detectable: altering any historical record breaks every subsequent hash. This is not blockchain and doesn't need to be — a hash chain in Postgres gives the required tamper-evidence at a fraction of the complexity.

**Exportable evaluation report** — a PDF per bidder or per tender containing the criteria, verdicts, evidence citations, score derivation, officer decision and justification, and the audit chain hash. This is the artefact that survives a tender challenge.

---

## 7. Data model

Core entities:

- **Tender** — bid number, buyer org, value, category, dates, relaxation flags, parsed criteria set, parser confirmation status
- **Criterion** — belongs to tender; type, rule definition, mandatory flag, weight, applicability condition
- **Bidder** — legal name, PAN, GSTIN, Udyam URN, CIN, addresses; deduplicated across tenders so history accumulates
- **Submission** — bidder × tender; submission timestamp, document set
- **Document** — submission-scoped; type, storage key, SHA-256, page count, classification confidence
- **ExtractedField** — document-scoped; field name, value, page coordinates, confidence, extraction method
- **PortalCheck** — bidder-scoped; portal, identifier, status, response payload, retrieval timestamp, source (live/cached/simulated)
- **Verdict** — submission × criterion; status, evidence references, reason, confidence
- **Discrepancy** — submission-scoped; severity, conflicting values, sources, description
- **Assessment** — submission-scoped; score, band decomposition, risk level, triggered flags, recommendation text
- **Decision** — submission-scoped; officer, outcome, justification, timestamp
- **AuditEvent** — append-only, hash-chained, as above

Bidder history across tenders is a deliberate design choice: once a company has been verified for one tender, subsequent tenders reuse cached identity facts and — more usefully — the officer can see that the same entity was flagged before.

---

## 8. AI/ML component inventory

Being precise about what is learned and what is computed is a strength in this domain, not a weakness.

| Component | Technique | Why here | Why not rules |
|---|---|---|---|
| Document classification | TF-IDF + gradient boosting; visual classifier for scans | Filenames are meaningless, layouts vary by issuing authority | Keyword rules break on regional format variants |
| OCR | PaddleOCR / Tesseract with preprocessing | Scanned and photographed certificates are the norm | Not expressible as rules |
| Table extraction | Layout model (LayoutLM-family) or rule-based where layout is stable | Balance sheets and annexures are tables | Rules work for fixed formats, fail on variable ones |
| Field extraction (variable layout) | LLM with JSON schema constraint | Work orders and OEM letters have no standard form | Would need a regex per issuing organisation |
| Entity name matching | Normalisation + Jaro-Winkler, embeddings as fallback | Legal name variants are endless | Exact matching produces unusable false-mismatch rates |
| Anomaly detection | Isolation Forest on bidder features | Catches patterns no single rule encodes | Advisory signal only, never a verdict input |
| Tamper detection | Font consistency analysis, metadata inspection, signature validation, copy-move detection | Forgery detection is inherently statistical | Partly forensics libraries, partly ML |
| Tender parsing | LLM with schema constraint | Tender prose is unstructured | Every tender is worded differently |
| Recommendation narrative | LLM, citation-constrained | Turns a verdict table into readable prose | Templates produce unreadable output at this complexity |

**Deliberately not ML:** the compliance verdict itself, the score, and the mandatory gate. These are deterministic and must be defensible line by line in an audit or a legal challenge. There is also no labelled corpus of historically adjudicated bids to train on — any supervised model for the final decision would be trained on data the team invented, and an evaluator will ask about that.

**The framing:** AI handles messy inputs and messy outputs. Deterministic logic handles the decision.

---

## 9. Frontend design specification

### 9.1 Brief

A procurement officer, at a desk, working through 30 bidders under deadline pressure, producing decisions that may be challenged in court. The interface must feel institutional and trustworthy — closer to a bank's back-office system or a court filing portal than to a startup dashboard. It must never look playful, and it must never look cheap.

The design world to borrow from is not "enterprise SaaS." It is the visual language of the documents themselves: ruled registers, stamped certificates, gazette notifications, ledger columns, seals and countersignatures. Precision, hierarchy, hairlines, and generous whitespace.

### 9.2 Design tokens

**Colour** — restrained, ink-and-paper base with status colour used only where status is the message.

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#111827` | Primary text, headers |
| `--ink-muted` | `#4B5563` | Secondary text |
| `--ink-faint` | `#9CA3AF` | Labels, metadata |
| `--paper` | `#FBFBF9` | Page background — very slightly warm, not pure white |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--rule` | `#E5E3DE` | Hairline dividers |
| `--seal` | `#1E3A5F` | Primary accent — deep official navy. Headers, primary actions |
| `--seal-tint` | `#EEF2F7` | Selected rows, active nav |
| `--verified` | `#0F6E56` | PASS |
| `--review` | `#B45309` | NEEDS_REVIEW |
| `--failed` | `#9F1239` | FAIL |
| `--inactive` | `#6B7280` | NOT_APPLICABLE |

Status colours appear *only* on status. Never as decoration, never as a chart palette. When six things on screen are coloured, colour stops meaning anything.

**Typography** — three roles, chosen for this brief specifically.

| Role | Face | Rationale |
|---|---|---|
| Display / headings | **Source Serif 4** (or Spectral) | A serif signals officialdom without period costume. Used at 20–32px, weight 600, sparingly — page titles and bidder names only |
| Body / UI | **Inter** | Neutral, excellent at 13–15px, wide numeral support |
| Data / identifiers | **IBM Plex Mono** | **The most important typographic decision in this project.** GSTINs, PANs, Udyam URNs and CINs are alphanumeric identifiers that officers read character by character to spot mismatches. Monospace makes `0`/`O` and `1`/`I` distinguishable and aligns identifiers vertically for column comparison. Every identifier in the interface is monospaced |

Type scale: 32 / 24 / 20 / 16 / 15 / 13 / 11. Sentence case everywhere. Never all-caps except two-letter status chips.

**Layout** — 8px spacing grid. Card radius 6px, not 12 — softer corners read as consumer, sharper reads as institutional. Borders are 1px hairlines in `--rule`, never shadows. Shadows are used exactly once, on the sticky decision bar, to lift it off the page.

### 9.3 Signature element — the Evidence Ledger

This is the component the interface should be remembered for, and it is where the design boldness is spent.

For any criterion, the officer sees a two-column ledger: **what the bidder submitted** on the left, **what the government portal returned** on the right, separated by a vertical hairline. Corresponding fields align on the same row. A small marker in the gutter between them indicates agreement or conflict.

```
  SUBMITTED                        │  ⊙  │  RETRIEVED
  Udyam certificate, p.1           │     │  Udyam portal · 27 Aug 2026, 14:32 · live
  ─────────────────────────────────┼─────┼──────────────────────────────────────
  Enterprise name                  │     │  Enterprise name
  ABC Infra Private Ltd            │  ≠  │  ABC Infrastructure Private Limited
                                   │     │
  Registration number              │     │  Registration number
  UDYAM-TN-33-0041827              │  =  │  UDYAM-TN-33-0041827
                                   │     │
  Enterprise type                  │     │  Enterprise type
  Small                            │  =  │  Small
                                   │     │
  Date of registration             │     │  Date of registration
  14-06-2021                       │  =  │  14-06-2021
```

Clicking any submitted value opens the source document at the exact page with the extracted region highlighted. Clicking any retrieved value opens the raw portal response with its timestamp. **Nothing on this screen is unverifiable by the officer in one click.** That property is the entire trust argument for the product.

A mismatch row expands to show the system's reasoning — normalisation steps applied, similarity score, and why it was classified as a variance rather than a distinct entity.

### 9.4 Screens

**1. Tender workspace (landing).** Tender header — bid number, buyer, value, closing date. Below it, the confirmed criteria checklist. Then the bidder table: name, monospaced PAN, score, risk chip, verdict counts (`14 ✓ · 2 ⚠ · 1 ✗`), decision status. Sortable, filterable by risk and by decision state. This is where an officer spends most of their time, so it must be dense and fast.

**2. Criteria confirmation.** Shown once per tender after parsing. Each extracted criterion beside the source text it came from, with inline editing. A single "Confirm checklist" action unlocks verification. Deliberately a gate, not a suggestion.

**3. Bidder detail.** Left rail: criteria list with status icons, grouped as Statutory / Financial / Technical / Declarations. Main pane: the evidence ledger for the selected criterion. Right rail: score derivation and risk flags. Sticky footer: the decision bar.

**4. Discrepancy review.** Every conflict across all bidders in one queue, sorted by severity. Lets an officer clear all the critical items across a tender before going bidder by bidder.

**5. Audit trail.** Chronological, filterable, with chain-integrity status shown at the top. Export to signed PDF.

**6. Comparison view.** Two to four bidders side by side, criteria as rows. For the shortlisting stage.

### 9.5 Interaction principles

- **Verification progress streams.** Portal calls are slow. Show each portal resolving in real time — `Udyam ✓ · GSTN ✓ · EPFO ⋯ · MCA21 ⋯` — rather than a spinner. Officers tolerate slowness they can see the shape of.
- **The decision bar is always visible and always deliberate.** Sticky at the bottom of the bidder detail screen: `Qualify` · `Seek clarification` · `Disqualify`. Every one opens a justification field that cannot be skipped. The AI recommendation sits beside it, clearly labelled `Recommendation — advisory`, styled as a quotation rather than as a control, so it never reads as the system pre-selecting an answer.
- **Simulated data is labelled everywhere.** A distinct chip on any value from the simulation backend, in the UI and in every export. Non-negotiable.
- **Empty and failure states give direction.** "Udyam portal unreachable — this criterion is marked for review. Retry, or verify manually and record the result." Not "Error 503."
- **Keyboard-first.** `j`/`k` between criteria, `n`/`p` between bidders, `⌘K` command palette. An officer doing 30 bidders will learn the shortcuts by bidder four.

### 9.6 Quality floor

Responsive to tablet width (officers review on the move). Visible keyboard focus rings. WCAG AA contrast on all text. Status never conveyed by colour alone — every status chip carries an icon and a text label. Reduced motion respected. Loading skeletons, not spinners, for content areas.

---

## 10. Security and governance

- **Authentication** — SSO-ready, with role-based access: Procurement Officer (decides), Reviewer (reads, comments), Auditor (reads audit only), Administrator (manages tenders and rules, cannot decide).
- **Data classification** — bidder documents contain commercially sensitive and personal data. Encrypted at rest, encrypted in transit, access logged per document view.
- **Consent** — DigiLocker access requires explicit bidder consent, scoped per tender, time-bounded, revocable.
- **Data retention** — aligned to the procurement record-keeping period; documents purged on schedule while audit records persist.
- **Model governance** — every model version recorded against every inference in the audit chain. A verdict produced by v1.2 of the extractor stays attributable to v1.2 forever.
- **No autonomous action** — the system has no code path that qualifies or disqualifies a bidder. Verified by a test that asserts bidder status can only transition via an authenticated officer action.

---

## 11. Technology stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript, Tailwind, TanStack Query/Table | Table-heavy UI; TanStack Table handles the density requirement well |
| API | FastAPI (Python) | Same language as the ML pipeline; async suits fan-out portal calls |
| Async processing | Celery + Redis | Verification jobs run minutes, not milliseconds |
| Primary datastore | PostgreSQL | Relational integrity matters here; append-only audit enforced with triggers and row-level security |
| Object storage | S3-compatible (MinIO locally) | Documents, versioned, hash-addressed |
| Vector store | pgvector | Keeps RAG over tender clauses in the same database |
| OCR | PaddleOCR (primary), Tesseract (fallback) | PaddleOCR handles Indian-language documents better |
| Document parsing | pdfplumber, PyMuPDF, camelot | Native-text extraction with coordinates |
| ML | scikit-learn (classification, anomaly), sentence-transformers (matching) | Small, fast, explainable; no GPU needed for the parts that matter |
| LLM | API-based, with a schema-constrained wrapper | Used only for extraction and narrative, both validated post-generation |
| Reports | WeasyPrint or ReportLab | Signed PDF evaluation reports |

---

## 12. Delivery phases

**Phase 1 — Spine.** Tender upload, criteria parsing, criteria confirmation UI, bidder upload, document classification, extraction for the four highest-volume document types (Udyam, GST, PAN, incorporation certificate). Structural cross-checks. A working end-to-end path for one bidder against three criteria.

**Phase 2 — Verification.** Portal connector interface plus the simulation backend seeded with realistic dummy data. Two live/sandbox integrations. Circuit breakers, caching. Full cross-verification engine.

**Phase 3 — Judgement.** Rule engine with declarative criteria. Scoring, mandatory gates, risk flags. Recommendation service with citation validation. Audit chain.

**Phase 4 — Interface.** Full dashboard, evidence ledger, discrepancy queue, comparison view, decision workflow, PDF export.

**Phase 5 — Depth.** Anomaly detection, tamper signals, bidder history across tenders, remaining portal adapters, keyboard shortcuts, accessibility pass.

If time compresses, cut Phase 5 entirely and cut portals from Phase 2 — never cut the audit chain or the evidence ledger. Those two are what make it a procurement product rather than a document parser.

---

## 13. Demonstration script

Fifteen minutes, told as a story rather than a feature tour:

1. **The problem, quantified.** One tender, five bidders, seventeen applicable criteria. Eighty-five manual verifications. State the current time cost.
2. **Upload the tender.** Show the parser producing the criteria checklist from an actual RFP PQ table. Show the officer confirming it — and say why that confirmation gate exists.
3. **Upload five bidders.** Watch verification stream, portal by portal.
4. **The clean bidder.** Score 94, low risk, all mandatory criteria passed. Thirty seconds, then move on — the boring case is the point.
5. **The interesting bidder.** GSTIN whose embedded PAN doesn't match the submitted PAN card. Open the evidence ledger. Click through to both sources. This is the moment that sells the product.
6. **The subtle bidder.** Entity name variance across registrations. Show the system correctly classifying it as a variance, not a mismatch, and explaining its reasoning. Demonstrates the system doesn't just flag everything.
7. **The risky bidder.** Incorporated four months ago, bidding ₹70 Cr, no GST filing history, address shared with another bidder on the same tender. Risk: CRITICAL, with each flag traced.
8. **The decision.** Officer disqualifies one bidder — with the recommendation visible but clearly advisory, and a mandatory justification. Then override the recommendation on another, to prove the human is genuinely in control.
9. **The audit trail.** Show the chain, show integrity verification, export the signed report.
10. **Close on the impact numbers** from the problem statement, tied to what was just demonstrated.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Portal APIs unavailable or terms prohibit automated access | Connector abstraction with a labelled simulation backend; build live adapters only where access is clean and permitted |
| OCR accuracy on poor scans | Confidence thresholds routing to manual review; never let a low-confidence extraction produce a `FAIL` |
| LLM hallucination in extraction or narrative | Schema-constrained output, post-generation validation, mandatory citations, source text retained for every extracted field |
| Criteria parser misreads a threshold | Mandatory human confirmation gate before verification runs |
| Over-flagging destroys officer trust | Tune name matching and tolerance bands carefully; a system that flags everything gets switched off in week two |
| Perception that AI is deciding | No autonomous decision path in the code; advisory labelling throughout; explicit test asserting the property |
| Scope sprawl across fifteen portals | Depth over breadth — two portals done properly beats fifteen done superficially, and evaluators know it |

---

## 15. The one-line summary

An officer uploads a tender and a stack of bids, and receives — per bidder — a verified, evidence-linked compliance verdict they can defend line by line, produced in minutes instead of days, with the decision still entirely theirs.
