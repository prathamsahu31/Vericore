# Vericore — frontend handover

**For the frontend team. Written 31 August 2026.**

What is built, what the API gives you, what still needs building, and the rules
the interface must not break. Everything here was read out of the running code,
not from memory.

---

## 1. In one paragraph

An officer uploads a tender and each bidder's documents. The backend turns the
tender's eligibility conditions into a checklist, reads the bidder's documents,
matches evidence against each condition, and produces a verdict per condition
that always points at a page of a specific document. **The officer decides. The
system never does** — there is no code path that qualifies or disqualifies a
bidder, and the UI must never imply otherwise.

---

## 2. Running it

```bash
# 1. Database  (from the repo root)
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload            # http://localhost:8000

# 3. Frontend
cd frontend
npm install
npm run dev                              # http://localhost:3000
```

`frontend/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_OFFICER_ID=<a users.id with role 'officer'>
```

There is **no login yet**. `NEXT_PUBLIC_OFFICER_ID` stands in for the signed-in
officer. When it is absent the decision bar disables itself and says so, rather
than recording an action against nobody — keep that behaviour.

Interactive API docs: **http://localhost:8000/docs**. That page is generated
from the code, so it is always current; this document explains the parts that
need judgement.

---

## 3. Screens — built and not built

| # | Screen | Route | State |
|---|---|---|---|
| 1 | Tender setup — upload NIT, confirm the checklist | — | **Not built.** API ready |
| 2 | Bidder upload — documents, run verification | — | **Not built.** API ready |
| 3 | Compliance dashboard | `/bids/[bidId]` | Built |
| 4 | Findings & evidence | `/bids/[bidId]/findings` | Built |
| 5 | Audit trail | `/bids/[bidId]/audit` | Built |
| 6 | Comparison across bidders | `/tenders/[tenderId]` | Built |
| — | Landing | `/` | Placeholder only |

**Screens 1 and 2 are the work in front of you.** Every endpoint they need
already exists and is tested; only the interface is missing. Until they are
built, tenders and bids are created through the API.

There is no report export yet.

---

## 4. The API

Base URL from `NEXT_PUBLIC_API_BASE_URL`. All JSON unless marked otherwise.

### Tender setup — for screen 1

```
POST   /tenders                                  -> TenderOut
POST   /tenders/{id}/document                    -> DocumentOut     multipart: file
POST   /tenders/{id}/extract-requirements        -> RequirementOut[]
GET    /tenders/{id}/requirements                -> RequirementOut[]
PATCH  /requirements/{id}                        -> RequirementOut
POST   /tenders/{id}/confirm-requirements        -> TenderOut
GET    /tenders/{id}                             -> TenderOut
```

The flow is strictly: create → upload NIT → extract → officer edits → confirm.

### Bidders and documents — for screen 2

```
POST   /bidders                                  -> BidderOut
GET    /bidders                                  -> BidderOut[]
POST   /bids                                     -> BidOut         {tender_id, bidder_id}
POST   /bids/{id}/documents                      -> UploadResult   multipart: file,
                                                                   ingestion_mode, doc_type?
GET    /bids/{id}/documents                      -> DocumentOut[]
GET    /documents/{id}/fields                    -> ExtractedFieldOut[]
```

`ingestion_mode` is `separate` | `auto_classify` | `merged`, and **the officer
picks it** — never infer it. `separate` requires `doc_type`; the other two
reject it. `merged` is not really implemented yet: it returns one unclassified
segment flagged for review rather than splitting the bundle.

Upload is synchronous and runs extraction inline, so expect a slow response on a
large file. Show a skeleton, not a spinner.

### Verification and review — screens 3–5

```
POST   /bids/{id}/verify                         -> VerificationSummary
GET    /bids/{id}/compliance                     -> VerificationSummary
POST   /bids/{id}/review                         -> VerificationSummary
GET    /bids/{id}/audit                          -> AuditTrailOut
GET    /tenders/{id}/comparison                  -> ComparisonOut
```

`POST /review` returns the **whole updated summary**, so re-render from its
response rather than refetching.

### Meta

```
GET /health · GET /health/db · GET /meta/provenance
```

`/meta/provenance` reports whether external checks are simulated and which LLM
provider is active. Worth surfacing somewhere in the chrome.

### Errors

Every deliberate error has the same shape, and the message is written to be
shown to an officer:

```json
{ "error": { "code": "gate_not_satisfied", "message": "…", "detail": {} } }
```

| Code | HTTP | When |
|---|---|---|
| `not_found` | 404 | |
| `validation_error` | 422 | bad upload type, blank reason, wrong review action |
| `conflict` | 409 | duplicate bid, re-extracting a confirmed checklist |
| `gate_not_satisfied` | 409 | verify called before the checklist is confirmed |
| `permission_denied` | 403 | reserved for the auth gate |

Display `error.message` directly. Do not invent your own copy — these strings
were written to tell an officer what to do next.

---

## 5. The two gates — the thing most likely to be got wrong

`VerificationSummary` carries **two separate lists**, and collapsing them would
tell an officer that a good bidder had failed.

```
mandatory_failed[]   evaluated and found wanting        only an override clears it
pending_review[]     unresolved — nobody has looked yet  an acceptance clears it
qualifiable          both lists empty
mandatory_gate_passed   true when mandatory_failed is empty (says nothing about pending)
```

`NON_COMPLIANT`, `EXPIRED`, `INCONSISTENT` are failures. `NEEDS_HUMAN_REVIEW`,
`UNVERIFIED`, `PARTIALLY_COMPLIANT`, `MISSING_EVIDENCE` are pending — including
missing evidence, because real procurement asks for a shortfall document rather
than rejecting.

Read `qualifiable` for "can this bidder be qualified", never `compliance_score`.
A high score with an outstanding mandatory item is still not qualifiable.

---

## 6. The nine states

`status` is what the system concluded. `override_status` is the officer's
verdict, stored **alongside** it. `effective_status` is what the gate and the
score count — use it for display, and keep `status` visible wherever an override
exists, because the record must show both.

| Status | Label in the UI | Meaning |
|---|---|---|
| `COMPLIANT` | Compliant | met |
| `NON_COMPLIANT` | Not met | evidence found, falls short |
| `PARTIALLY_COMPLIANT` | Partial | some sub-conditions met |
| `MISSING_EVIDENCE` | No document | nothing submitted that could answer it |
| `INCONSISTENT` | Inconsistent | the bidder's documents contradict each other |
| `EXPIRED` | Expired | would have satisfied, but lapsed by the bid due date |
| `UNVERIFIED` | Unverified | an external check could not run — **not** a failure |
| `NOT_APPLICABLE` | N/A | excluded from the score entirely |
| `NEEDS_HUMAN_REVIEW` | Your review | a judgement call, referred by policy |

Never show a raw enum. `NeedsYou.tsx` has a `plainReason()` that restates each
state in a sentence — reuse it.

---

## 7. Design system — CLAUDE.md §11, non-negotiable

Tokens live in `app/globals.css`. Use the CSS variables, not hex literals.

```
--ink #111827   --ink-muted #4B5563   --ink-faint #9CA3AF
--paper #FBFBF9 --surface #FFFFFF     --rule #E5E3DE
--seal #1E3A5F  --seal-tint #EEF2F7
--verified #0F6E56   --review #B45309   --failed #9F1239   --inactive #6B7280
```

- **Status colour only ever appears on status.** Never as decoration, never as a
  chart palette.
- **Type: three roles.** Source Serif 4 for headings (600, 20–32px), Inter for
  body (13–15px), **IBM Plex Mono for every identifier** — GSTIN, PAN, Udyam
  URN, CIN, hashes, requirement codes, dates in tables. Use the `Identifier`
  component or the `.identifier` class. Officers read these character by
  character; monospace keeps `0`/`O` and `1`/`I` apart and aligns them for
  column comparison. This is the single most important typographic rule here.
- Scale 32 / 24 / 20 / 16 / 15 / 13 / 11. Sentence case. 8px grid.
- **6px radii**, not 12. Sharper reads institutional.
- **1px hairlines in `--rule`, not shadows.** The one shadow in the whole
  interface lifts the sticky decision bar; do not add another.
- Status is **never colour alone** — every chip carries a mark, a text label and
  a colour, so it survives greyscale and colour-blindness.
- Visible focus rings, AA contrast, reduced motion respected, skeletons not
  spinners.

The reference is a court filing portal, not a startup dashboard.

---

## 8. Components you can reuse

`app/components/`

| Component | Use |
|---|---|
| `StatusChip` | any compliance status; `overridden` marks an officer verdict |
| `RiskChip` | risk level |
| `SeverityMark` | finding / flag severity |
| `SourceChip` | the `live` / `simulated` label — see §9 |
| `Identifier` | **every** identifier, hash and code |
| `Masthead` | page header + the three tabs |
| `Verdict` | "where this bid stands" banner |
| `NeedsYou` | outstanding items with plain-language reasons and actions |
| `ComplianceMatrix` | the checklist table |
| `EvidenceLedger` | the two-column slide-over |
| `DecisionBar` | sticky accept / override bar |

`app/lib/api.ts` holds every call; `app/lib/types.ts` mirrors the API models.
Add new calls there rather than fetching inline.

---

## 9. Rules the interface must not break

These come from the build spec and are the product's credibility argument.

1. **A simulated result is always labelled.** Anything with
   `external_check_source: "simulated"` shows the `SourceChip`, in the UI and in
   anything printed or exported. There must be no state in which simulated data
   reads as live.
2. **An override never replaces the machine verdict.** Show both. `status` is
   what the system found; `override_status` is what the officer decided;
   `override_reason` is why. All three stay visible.
3. **No justification, no action.** Accept and override both require a reason.
   The database rejects a blank one, so do not build a path that tries.
4. **`accept` and `override` are different acts.** `accept` is only valid on a
   pending state; the API returns 422 telling you to use `override` otherwise.
   Disable the button and explain, rather than letting the call fail.
5. **The recommendation is advisory.** Style it as a quotation, label it, and
   never as a button or a pre-selected option. It describes findings; it does
   not recommend an outcome.
6. **Missing evidence is not failure.** Copy should point at asking the bidder
   for the document.
7. **Every verdict opens its evidence.** A status with no route to the values
   behind it is a bug.

---

## 10. Evidence and page coordinates

`ExtractedFieldOut` carries `page` and a box `x0,y0,x1,y1`, plus
`locator_status`:

| `locator_status` | Meaning for the UI |
|---|---|
| `exact` / `normalized` / `fuzzy` | a real highlight — draw the box |
| `page_fallback` / `segment_fallback` | **the box is the whole page.** Open the page, draw no highlight, say the value could not be pinpointed |

`bbox_rects` is a per-line array when a value wraps across lines; the top-level
box is their union. Outline the rects, scroll to the union.

A field on a fallback rung can never produce an automatic pass, so it will
always appear as something needing the officer.

**The document viewer is not built.** Today the ledger names the page; it does
not render the PDF with the box drawn on it. That is a real gap and a good
candidate for the next piece of work after screens 1 and 2.

---

## 11. What is real and what is simulated

Real: upload and storage, PDF text extraction with coordinates, document
classification, every arithmetic and date comparison, GSTIN-embeds-PAN and the
other structural checks, cross-document comparison, the score, the risk flags,
the append-only audit chain.

Simulated: **every government register** — GST, Udyam, PAN, MCA21, DigiLocker,
DPIIT, NSIC, blacklist. None of them offer an API obtainable without
institutional credentials. They sit behind one adapter interface so a real one
drops in later, and every result is stamped `simulated` in the database itself.

The LLM currently runs on a stub for evidence extraction. Tender parsing has
been run against real documents; see §13.

---

## 12. Demo data

One tender and **three bidders**, each built to exercise different states so you
have real data for every case the dashboard has to render.

| | Bidder | What it shows |
|---|---|---|
| **A** | ABC Infrastructure Private Limited | Clean. One `NEEDS_HUMAN_REVIEW` on a materials specification. Accepting it makes the bid `qualifiable`. |
| **B** | ABC Engineers Private Limited | Clearly problematic. Turnover shortfall (`NON_COMPLIANT`), lapsed ISO certificate (`EXPIRED`), no OEM letter (`MISSING_EVIDENCE`), a name that differs between the PAN card and the GST certificate, and a GSTIN embedding a different PAN than the card shows — a critical contradiction. Expect the red band and a high risk level. |
| **C** | Coastal Marine Works Private Limited | Genuinely ambiguous. Every document is in order; the turnover certificate belongs to its holding company. The figure passes, the entity does not, so it routes to the officer naming the other company. |

Regenerate with `python scripts/generate_fixtures.py` and
`scripts/generate_tender.py` from `backend/`. Run all three end to end with
`python scripts/run_demo.py`.

## 13. Known gaps

Honest list, so nothing is discovered late.

- **Screens 1 and 2 do not exist.** The largest item.
- **No auth.** Officer identity comes from an env var. Roles (officer,
  reviewer, auditor, admin) exist in the database but nothing enforces them.
- **No document viewer**, so evidence cannot yet be seen highlighted on the page.
- **Requirement extraction does not return `source_page`.** The confirmation
  gate in screen 1 is supposed to show each requirement beside the source text
  it came from; the backend does not supply the page yet. Design the screen for
  it, and expect it to arrive.
- **Scanned documents are not read.** Typed PDFs only, by decision. A scan
  yields `page_fallback` for every value on it.
- **Merged-PDF splitting is not implemented**, and neither is the segmentation
  review screen.
- **No report export.**
- **LLM provider unsettled.** The Gemini free key reaches only a weak model; the
  OpenAI key supplied has no credit. Run `python scripts/check_llm.py` from
  `backend/` to see the current state in one line. This affects tender parsing
  quality, not any screen's contract.

---

## 14. Where things are

```
backend/app/api/          routers — the endpoints above
backend/app/db/models.py  17 tables, the source of truth for every shape
docs/how-it-works.md      plain-language description of every feature, no jargon
CLAUDE.md                 the build rules; §11 is the design brief in full
frontend/app/             the app
```

`docs/how-it-works.md` is the best thing to read for *why* a screen behaves the
way it does. It is written for a non-technical reader and is kept current with
every feature.

Questions about a contract: check `http://localhost:8000/docs` first — it is
generated from the code and cannot go stale.
