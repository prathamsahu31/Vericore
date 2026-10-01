"""Chat widget route: questions about the tender or bid the officer is looking at.

The widget sends the page's tender or bid, and the answer is grounded in what
Vericore already holds for it: the tender's details and checklist, the bid's
recorded verdicts, findings and risk flags, and the documents' text. With
neither, it gets the list of open tenders, so it can point the officer to the
right page instead of guessing.

Runs on the EXTRACTION role, the cheap model, and caps both the question and the
context sent with it, so one question has a small, known worst-case cost. The
provider chain caches answers, so a repeated question costs nothing.
"""

from __future__ import annotations

import logging
import uuid
from collections import Counter
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import extraction_provider
from app.api.verification import _summary
from app.db.models import (
    Bid,
    Bidder,
    BidMember,
    Document,
    Requirement,
    Tender,
    VerificationRun,
)
from app.db.session import get_db
from app.errors import NotFoundError
from app.llm.base import LLMError
from app.llm.types import ChatAnswer, DocumentInput, LLMRole
from app.modules.document_intelligence.pdf_reader import build_provider_text, read_pdf
from app.modules.tender_service import service as tenders

log = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chatbot"])

MAX_QUESTION_CHARS = 1_000
# About 10k tokens in all, at roughly four characters a token. Vericore's own
# records go first and may take up to half; documents share the rest.
MAX_CONTEXT_CHARS = 40_000
MAX_RECORD_CHARS = MAX_CONTEXT_CHARS // 2
TRUNCATED_MARKER = "\n[... rest omitted to limit cost ...]"
# A requirement's clause or a verdict's reasoning, shortened to one line's worth.
LINE_CHARS = 300

UNREADABLE = "(No readable text, probably a scanned image. Open the document to read it.)"


class ChatRequest(BaseModel):
    tender_id: uuid.UUID | None = None
    bid_id: uuid.UUID | None = None
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)


class ChatLink(BaseModel):
    """A page in the app for a tender or bid the answer names."""

    entity: str
    label: str
    href: str


class ChatReply(ChatAnswer):
    """The model's answer plus what the server attaches after it.

    A notice states a fact the code established, such as verdicts being out of
    date; it is not left to the model, which can and does skip such caveats.
    Links come from matching the answer against real tenders and bids, never
    from the model, so a link cannot point at an ID it made up.
    """

    notices: list[str] = Field(default_factory=list)
    links: list[ChatLink] = Field(default_factory=list)


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + TRUNCATED_MARKER


def _short(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= LINE_CHARS else text[:LINE_CHARS] + "…"


def build_context(records: list[str], documents: list[tuple[str, str, str]]) -> str:
    """Vericore's records first, then ``(filename, kind, text)`` documents.

    Records are what the system already concluded and are small, so they go
    first, whole up to their cap. Documents share what is left equally, so one
    long document cannot crowd the others out of the prompt.
    """
    parts = [_clip("\n\n".join(records), MAX_RECORD_CHARS)] if records else []
    if documents:
        share = (MAX_CONTEXT_CHARS - sum(len(p) for p in parts)) // len(documents)
        for filename, kind, text in documents:
            parts.append(f"=== Document: {filename} ===\nType: {kind}\n{_clip(text, share)}")
    return "\n\n".join(parts)


# ── Vericore records ────────────────────────────────────────────────────


def _money(amount: Decimal | None, currency: str) -> str:
    return f"{currency} {amount:,}" if amount is not None else "not recorded"


def _yes_no(value: bool | None) -> str:
    return "not recorded" if value is None else ("yes" if value else "no")


def _members(db: Session, bid_id: uuid.UUID) -> list[tuple[BidMember, Bidder]]:
    return list(
        db.execute(
            select(BidMember, Bidder)
            .join(Bidder, Bidder.id == BidMember.bidder_id)
            .where(BidMember.bid_id == bid_id)
            .order_by(BidMember.member_order)
        ).tuples()
    )


def _bids(db: Session, tender_id: uuid.UUID) -> list[Bid]:
    return list(
        db.execute(select(Bid).where(Bid.tender_id == tender_id).order_by(Bid.created_at)).scalars()
    )


def _tender_record(tender: Tender) -> str:
    return "\n".join(
        [
            "=== Vericore record: Tender details ===",
            f"Title: {tender.title}",
            f"GeM bid number: {tender.bid_number or 'not recorded'}",
            f"Buyer: {tender.buyer_organisation or 'not recorded'}",
            f"Category: {tender.category or 'not recorded'}",
            f"Estimated value: {_money(tender.estimated_value, tender.currency)}",
            f"EMD: {_money(tender.emd_amount, tender.currency)}",
            f"Bid due date: {tender.bid_due_date or 'not recorded'}",
            f"Contract start date: {tender.contract_start_date or 'not recorded'}",
            f"MSE relaxation: {_yes_no(tender.mse_relaxation)}",
            f"Startup relaxation: {_yes_no(tender.startup_relaxation)}",
            f"Status: {tender.status}",
        ]
    )


def _checklist_record(db: Session, tender: Tender) -> str:
    requirements: list[Requirement] = tenders.list_requirements(db, tender.id)
    state = (
        "confirmed by the officer"
        if tender.requirements_confirmed_at
        else "draft, not yet confirmed by the officer"
    )
    lines = [
        "=== Vericore record: Requirements checklist ===",
        f"{len(requirements)} requirements, {state}.",
    ]
    for r in requirements:
        tags = ["mandatory" if r.mandatory else "optional", f"applies to {r.applicability_scope}"]
        if r.accepts_document_types:
            tags.append("satisfied by " + ", ".join(r.accepts_document_types))
        lines.append(f"{r.code} {r.name} ({'; '.join(tags)})")
        if clause := r.normalized_clause or r.raw_clause:
            lines.append(f"  Clause: {_short(clause)}")
    return "\n".join(lines)


def _uploaded_since_last_run(db: Session, bid_id: uuid.UUID) -> int:
    """Documents uploaded after the bid was last verified, which its verdicts miss."""
    last_run = db.execute(
        select(func.max(VerificationRun.started_at)).where(VerificationRun.bid_id == bid_id)
    ).scalar()
    if last_run is None:
        return 0
    return db.execute(
        select(func.count())
        .select_from(Document)
        .where(Document.bid_id == bid_id, Document.uploaded_at > last_run)
    ).scalar_one()


def _gate(passed: bool | None, failed: list[str]) -> str:
    if passed is None:
        return "not evaluated"
    return "passed" if passed else f"failed on {', '.join(failed) or 'a mandatory requirement'}"


def _bid_record(db: Session, bid: Bid) -> str:
    summary = _summary(db, bid.id)
    lines = [f"=== Vericore record: Verification results for {summary.bidder_name} ==="]
    for member, bidder in _members(db, bid.id):
        ids = [
            f"{label} {value}"
            for label, value in (
                ("PAN", bidder.pan),
                ("GSTIN", bidder.gstin),
                ("Udyam", bidder.udyam_urn),
                ("CIN", bidder.cin),
            )
            if value
        ]
        lines.append(f"Bidder ({member.role}): {bidder.legal_name}; {'; '.join(ids) or 'no IDs'}")
    lines.append(f"Verification run: {summary.run_status}")
    if newer := _uploaded_since_last_run(db, bid.id):
        lines.append(
            f"OUT OF DATE: {newer} documents were uploaded after the last verification run, "
            "so the verdicts below do not take them into account. Re-running verification "
            "will update them."
        )
    if summary.compliance_score is not None:
        lines.append(f"Compliance score: {summary.compliance_score} out of 100")
    lines.append(
        f"Mandatory gate: {_gate(summary.mandatory_gate_passed, summary.mandatory_failed)}"
    )
    if summary.pending_review:
        lines.append(f"Waiting for officer review: {', '.join(summary.pending_review)}")
    if summary.risk_level:
        lines.append(f"Risk level: {summary.risk_level}")
    lines.append(
        f"Government portal checks: {summary.external_checks_simulated} simulated, "
        f"{summary.external_checks_live} live"
    )

    if summary.requirements:
        stale = " (OUT OF DATE, see above)" if newer else ""
        lines.append(f"Verdict per requirement, recorded by Vericore's rule engine{stale}:")
    else:
        lines.append("No verdicts yet: verification has not run for this bid.")
    for row in summary.requirements:
        line = f"{row.requirement_code} {row.requirement_name}: {row.status}"
        if row.override_status:
            reason = f", reason: {_short(row.override_reason)}" if row.override_reason else ""
            line += f" (officer override to {row.override_status}{reason})"
        lines.append(line)
        if row.reasoning:
            lines.append(f"  Why: {_short(row.reasoning)}")

    for finding in summary.cross_document_findings:
        lines.append(f"Cross-document finding ({finding.severity}): {_short(finding.description)}")
    for flag in summary.risk_flags:
        lines.append(f"Risk flag ({flag.severity}) {flag.code}: {_short(flag.description)}")
    if summary.recommendation_text:
        lines.append(
            "Vericore recommendation (advisory only, not a decision): "
            f"{_short(summary.recommendation_text)}"
        )
    if bid.decision:
        reason = bid.decision_justification
        lines.append(f"Officer decision: {bid.decision}{f': {_short(reason)}' if reason else ''}")
    return "\n".join(lines)


def _bids_overview(db: Session, tender: Tender) -> str:
    bids = _bids(db, tender.id)
    lines = ["=== Vericore record: Bids on this tender ===", f"{len(bids)} bids."]
    for bid in bids:
        summary = _summary(db, bid.id)
        counts = ", ".join(f"{status} {n}" for status, n in sorted(summary.status_counts.items()))
        score = summary.compliance_score if summary.compliance_score is not None else "none"
        line = (
            f"{summary.bidder_name}: run {summary.run_status}; score {score}; "
            f"mandatory gate {_gate(summary.mandatory_gate_passed, summary.mandatory_failed)}; "
            f"risk {summary.risk_level or 'not assessed'}; verdicts: {counts or 'none yet'}"
        )
        if newer := _uploaded_since_last_run(db, bid.id):
            line += f"; verdicts OUT OF DATE, {newer} documents uploaded since the last run"
        if bid.decision:
            line += f"; officer decision {bid.decision}"
        lines.append(line)
    return "\n".join(lines)


def _tenders_overview(db: Session) -> str:
    open_tenders = tenders.list_tenders(db)
    lines = ["=== Vericore record: Open tenders ===", f"{len(open_tenders)} open tenders."]
    for tender in open_tenders:
        bidders = [
            bidder.legal_name
            for bid in _bids(db, tender.id)
            for member, bidder in _members(db, bid.id)[:1]
        ]
        has_document = (
            db.execute(select(Document.id).where(Document.tender_id == tender.id).limit(1)).first()
            is not None
        )
        lines.append(
            f"{tender.title} (GeM bid number {tender.bid_number or 'not recorded'}): "
            f"due {tender.bid_due_date or 'not recorded'}; status {tender.status}; "
            f"{len(tenders.list_requirements(db, tender.id))} requirements; tender document "
            f"{'uploaded' if has_document else 'not uploaded'}; bids from "
            f"{', '.join(bidders) or 'nobody yet'}"
        )
    lines.append(
        "Details of one tender or bid are not loaded here; they are on that tender's or bid's page."
    )
    return "\n".join(lines)


# ── Documents ───────────────────────────────────────────────────────────


def _documents(db: Session, owner: Any, kind: str) -> list[tuple[str, str, str]]:
    """The text of each distinct document, oldest first.

    A file uploaded twice is sent once: the same text twice would only double
    the cost of the question.
    """
    rows = db.execute(select(Document).where(owner).order_by(Document.uploaded_at)).scalars()
    documents: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for doc in rows:
        if doc.sha256 in seen:
            continue
        seen.add(doc.sha256)
        try:
            pages = read_pdf(doc.storage_path).pages
        except Exception as exc:  # noqa: BLE001 - one unreadable file must not sink the rest
            log.warning("chat could not read document %s: %s", doc.id, type(exc).__name__)
            documents.append((doc.original_filename, kind, UNREADABLE))
            continue
        # Page markers alone are not text: a scan with no text layer still has them.
        text = build_provider_text(pages) if any(p.text.strip() for p in pages) else UNREADABLE
        documents.append((doc.original_filename, kind, text))
    return documents


# ── Links ───────────────────────────────────────────────────────────────


def _normalise(text: str) -> str:
    return " ".join(text.casefold().split())


def _answer_text(answer: ChatAnswer) -> str:
    """Everything the officer reads in an answer, to match names against."""
    parts = [answer.summary]
    for section in answer.sections:
        parts.append(section.heading)
        parts.extend(point.text for point in section.points)
    return _normalise(" ".join(parts))


def _tender_links(db: Session, answer_text: str, candidates: list[Tender]) -> list[ChatLink]:
    """The comparison and checklist pages of each candidate the answer names.

    The tender page is where its bidders are compared side by side. A title can
    repeat, so a repeated one is told apart by its GeM bid number.
    """
    titles = Counter(tender.title for tender in candidates)
    links: list[ChatLink] = []
    for tender in candidates:
        if _normalise(tender.title) not in answer_text:
            continue
        entity = tender.title
        if titles[tender.title] > 1:
            entity += f" ({tender.bid_number or f'created {tender.created_at:%d %b %Y, %H:%M}'})"
        compared = len(_bids(db, tender.id)) > 1
        links += [
            ChatLink(
                entity=entity,
                label="Bid comparison" if compared else "Open tender",
                href=f"/tenders/{tender.id}",
            ),
            ChatLink(entity=entity, label="Checklist", href=f"/tenders/{tender.id}/setup"),
        ]
    return links


def _bid_links(db: Session, answer_text: str, candidates: list[Bid]) -> list[ChatLink]:
    """The page of each candidate bid whose bidder the answer names."""
    return [
        ChatLink(entity=bidder.legal_name, label="Open bid", href=f"/bids/{bid.id}")
        for bid in candidates
        for _, bidder in _members(db, bid.id)[:1]
        if _normalise(bidder.legal_name) in answer_text
    ]


def _stale_notices(db: Session, bids: list[Bid]) -> list[str]:
    """One notice per bid whose verdicts predate some of its documents."""
    notices = []
    for bid in bids:
        if newer := _uploaded_since_last_run(db, bid.id):
            name = next((bidder.legal_name for _, bidder in _members(db, bid.id)), "this bid")
            notices.append(
                f"Verdicts for {name} are out of date: {newer} documents were uploaded after "
                "its last verification run. Re-run verification to update them."
            )
    return notices


@router.post("", response_model=ChatReply)
def ask_document_question(
    request: ChatRequest,
    db: Annotated[Session, Depends(get_db)],
    provider: Annotated[Any, Depends(extraction_provider)],
) -> ChatReply:
    records: list[str] = []
    documents: list[tuple[str, str, str]] = []
    notices: list[str] = []
    # What the answer may link to: tenders and bids the officer is not already on.
    link_tenders: list[Tender] = []
    link_bids: list[Bid] = []
    if request.bid_id:
        bid = db.get(Bid, request.bid_id)
        if bid is None:
            raise NotFoundError(f"Bid {request.bid_id} not found")
        tender = tenders.get_tender(db, bid.tender_id)
        records = [_tender_record(tender), _checklist_record(db, tender), _bid_record(db, bid)]
        documents = _documents(db, Document.bid_id == bid.id, "bidder document") + _documents(
            db, Document.tender_id == tender.id, "tender document"
        )
        notices = _stale_notices(db, [bid])
        link_tenders = [tender]
    elif request.tender_id:
        tender = tenders.get_tender(db, request.tender_id)
        records = [
            _tender_record(tender),
            _checklist_record(db, tender),
            _bids_overview(db, tender),
        ]
        documents = _documents(db, Document.tender_id == tender.id, "tender document")
        link_bids = _bids(db, tender.id)
        notices = _stale_notices(db, link_bids)
    else:
        records = [_tenders_overview(db)]
        link_tenders = tenders.list_tenders(db)

    try:
        answer = provider.generate_chat(
            request.question,
            DocumentInput(text=build_context(records, documents)),
            role=LLMRole.EXTRACTION,
        )
    except LLMError as exc:
        log.error("chat LLM call failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily unavailable. Please try again in a moment.",
        ) from exc

    named = _answer_text(answer)
    links = _tender_links(db, named, link_tenders) + _bid_links(db, named, link_bids)
    return ChatReply(**answer.model_dump(), notices=notices, links=links)
