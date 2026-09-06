"""Tender report generation from stored data (CLAUDE.md §15, Day 5).

The report is assembled entirely from rows already in Postgres — compliance
results, evidence, risk flags, findings, audit chain integrity and the
provenance posture. Nothing here calls an LLM and nothing here makes a
decision: it renders what the pipeline and the officer recorded, plus the
real-vs-simulated labels that rule CLAUDE.md §2 rule 2 requires to travel
with every exported result.

Two outputs share one in-memory model:

* ``build_report``    — a structured JSON record for screens and automation.
* ``render_html``     — a printable, self-contained HTML document with the
                        trading-stamp look of an official file (Claude §11).
"""

from __future__ import annotations

import html
import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.enums import TenderStatus
from app.db.models import (
    Bid,
    Bidder,
    BidMember,
    ComplianceResult,
    CrossDocumentFinding,
    Document,
    DocumentSegment,
    Evidence,
    Requirement,
    RiskFlag,
    Tender,
)
from app.errors import NotFoundError
from app.modules.audit_service import service as audit
from app.modules.compliance_engine.scoring import effective_status


# ── In-memory report model ────────────────────────────────────────────────────
@dataclass
class ReportEvidence:
    document_type: str
    filename: str
    page: int
    fields: list[str] = field(default_factory=list)
    snippet: str | None = None


@dataclass
class ReportRequirement:
    code: str
    name: str
    category: str | None
    mandatory: bool
    weight: float
    applicability_scope: str
    status: str | None
    effective_status: str | None
    overridden: bool
    reasoning: str | None
    verification_method: str | None
    external_check_portal: str | None
    external_check_status: str | None
    external_check_source: str | None  # "live" | "simulated" | None
    evidence: list[ReportEvidence] = field(default_factory=list)


@dataclass
class ReportBidder:
    bid_id: uuid.UUID
    legal_name: str
    compliance_score: float | None
    mandatory_gate_passed: bool | None
    risk_level: str | None
    decision: str | None
    decision_justification: str | None
    requirements: list[ReportRequirement] = field(default_factory=list)
    risk_flags: list[dict] = field(default_factory=list)
    findings: list[dict] = field(default_factory=list)
    recommendation_text: str | None = None
    recommendation_action: str | None = None


@dataclass
class TenderReport:
    tender_id: uuid.UUID
    title: str
    bid_number: str | None
    buyer_organisation: str | None
    bid_due_date: str | None
    generated_at: datetime
    checklist_confirmed: bool
    requirements: list[ReportRequirement]
    bidders: list[ReportBidder]
    external_verification_source: str
    llm_provider_extraction: str
    llm_provider_reasoning: str
    audit_chain_integrity: bool

    def as_dict(self) -> dict:
        return {
            "tender_id": str(self.tender_id),
            "title": self.title,
            "bid_number": self.bid_number,
            "buyer_organisation": self.buyer_organisation,
            "bid_due_date": self.bid_due_date,
            "generated_at": self.generated_at.isoformat(),
            "checklist_confirmed": self.checklist_confirmed,
            "requirements": [_req_dict(r) for r in self.requirements],
            "bidders": [_bid_dict(b) for b in self.bidders],
            "external_verification_source": self.external_verification_source,
            "llm_provider_extraction": self.llm_provider_extraction,
            "llm_provider_reasoning": self.llm_provider_reasoning,
            "audit_chain_integrity": self.audit_chain_integrity,
        }


def _req_dict(r: ReportRequirement) -> dict:
    return {
        "code": r.code,
        "name": r.name,
        "category": r.category,
        "mandatory": r.mandatory,
        "weight": r.weight,
        "applicability_scope": r.applicability_scope,
        "status": r.status,
        "effective_status": r.effective_status,
        "overridden": r.overridden,
        "reasoning": r.reasoning,
        "verification_method": r.verification_method,
        "external_check_portal": r.external_check_portal,
        "external_check_status": r.external_check_status,
        "external_check_source": r.external_check_source,
        "evidence": [
            {
                "document_type": e.document_type,
                "filename": e.filename,
                "page": e.page,
                "fields": e.fields,
                "snippet": e.snippet,
            }
            for e in r.evidence
        ],
    }


def _bid_dict(b: ReportBidder) -> dict:
    return {
        "bid_id": str(b.bid_id),
        "legal_name": b.legal_name,
        "compliance_score": b.compliance_score,
        "mandatory_gate_passed": b.mandatory_gate_passed,
        "risk_level": b.risk_level,
        "decision": b.decision,
        "decision_justification": b.decision_justification,
        "recommendation_text": b.recommendation_text,
        "recommendation_action": b.recommendation_action,
        "risk_flags": b.risk_flags,
        "findings": b.findings,
        "requirements": [_req_dict(r) for r in b.requirements],
    }


# ── Assembly ──────────────────────────────────────────────────────────────────
def build_report(db: Session, *, tender_id: uuid.UUID) -> TenderReport:
    """Assemble the full tender report from stored data."""
    tender = db.get(Tender, tender_id)
    if tender is None:
        raise NotFoundError(f"Tender {tender_id} not found")

    requirements = list(
        db.execute(
            select(Requirement).where(Requirement.tender_id == tender_id).order_by(Requirement.display_order)
        ).scalars()
    )
    bids = list(
        db.execute(select(Bid).where(Bid.tender_id == tender_id).order_by(Bid.created_at)).scalars()
    )

    # Evidence cache: bid_id -> requirement_id -> list[Evidence]
    evidence_rows = db.execute(
        select(Evidence).where(Evidence.bid_id.in_([b.id for b in bids] or [uuid.uuid4()]))
    ).scalars()
    evidence_map: dict[tuple[uuid.UUID, uuid.UUID], list[Evidence]] = {}
    for ev in evidence_rows:
        evidence_map.setdefault((ev.bid_id, ev.requirement_id), []).append(ev)

    segment_names: dict[uuid.UUID, tuple[str, str, int]] = {}
    segment_ids = {ev.document_segment_id for ms in evidence_map.values() for ev in ms}
    if segment_ids:
        for seg in db.execute(select(DocumentSegment).where(DocumentSegment.id.in_(segment_ids))).scalars():
            doc = db.get(Document, seg.document_id)
            segment_names[seg.id] = (
                seg.doc_type,
                doc.original_filename if doc else "(unknown)",
                (seg.page_start or 1),
            )

    settings = get_settings()
    integrity = audit.chain_integrity(db)

    checklist_confirmed = tender.status is TenderStatus.REQUIREMENTS_CONFIRMED
    report_requirements = [
        ReportRequirement(
            code=r.code,
            name=r.name,
            category=r.category,
            mandatory=r.mandatory,
            weight=float(r.weight or 0),
            applicability_scope=r.applicability_scope,
            status=None,
            effective_status=None,
            overridden=False,
            reasoning=None,
            verification_method=None,
            external_check_portal=None,
            external_check_status=None,
            external_check_source=None,
        )
        for r in requirements
    ]

    bidders: list[ReportBidder] = []
    for bid in bids:
        member = (
            db.execute(
                select(BidMember).where(BidMember.bid_id == bid.id).order_by(BidMember.member_order)
            )
            .scalars()
            .first()
        )
        bidder = db.get(Bidder, member.bidder_id) if member else None
        results = {
            r.requirement_id: r
            for r in db.execute(
                select(ComplianceResult).where(ComplianceResult.bid_id == bid.id)
            ).scalars()
        }
        flags = list(db.execute(select(RiskFlag).where(RiskFlag.bid_id == bid.id)).scalars())
        findings = list(
            db.execute(select(CrossDocumentFinding).where(CrossDocumentFinding.bid_id == bid.id)).scalars()
        )

        bid_reqs: list[ReportRequirement] = []
        for base, req in zip(report_requirements, requirements, strict=True):
            result = results.get(req.id)
            if result is None:
                bid_reqs.append(base)
                continue
            evs = evidence_map.get((bid.id, req.id), [])
            evidence_list = [
                ReportEvidence(
                    document_type=segment_names.get(ev.document_segment_id, ("", "", 1))[0],
                    filename=segment_names.get(ev.document_segment_id, ("", "", 1))[1],
                    page=segment_names.get(ev.document_segment_id, ("", "", 1))[2],
                    fields=[str(f) for f in (ev.extracted_field_ids or [])],
                    snippet=(
                        json.dumps(ev.field_snapshot, ensure_ascii=False)[:600]
                        if ev.field_snapshot
                        else None
                    ),
                )
                for ev in evs
            ]
            bid_reqs.append(
                ReportRequirement(
                    code=base.code,
                    name=base.name,
                    category=base.category,
                    mandatory=base.mandatory,
                    weight=base.weight,
                    applicability_scope=base.applicability_scope,
                    status=str(result.status),
                    effective_status=str(effective_status(result.status, result.override_status)),
                    overridden=bool(result.override_status),
                    reasoning=result.reasoning,
                    verification_method=result.verification_method,
                    external_check_portal=result.external_check_portal,
                    external_check_status=(
                        str(result.external_check_status) if result.external_check_status else None
                    ),
                    external_check_source=(
                        str(result.external_check_source) if result.external_check_source else None
                    ),
                    evidence=evidence_list,
                )
            )

        bidders.append(
            ReportBidder(
                bid_id=bid.id,
                legal_name=bidder.legal_name if bidder else "(unknown)",
                compliance_score=float(bid.compliance_score) if bid.compliance_score is not None else None,
                mandatory_gate_passed=bid.mandatory_gate_passed,
                risk_level=str(bid.risk_level) if bid.risk_level else None,
                decision=str(bid.decision) if bid.decision else None,
                decision_justification=bid.decision_justification,
                requirements=bid_reqs,
                risk_flags=[
                    {
                        "code": f.code,
                        "category": f.category,
                        "severity": str(f.severity),
                        "description": f.description,
                    }
                    for f in flags
                ],
                findings=[
                    {
                        "finding_type": f.finding_type,
                        "severity": str(f.severity),
                        "description": f.description,
                        "field_name": f.field_name,
                        "value_a": f.value_a,
                        "value_b": f.value_b,
                    }
                    for f in findings
                ],
                recommendation_text=bid.recommendation_text,
                recommendation_action=(
                    str(bid.recommendation_action) if bid.recommendation_action else None
                ),
            )
        )

    return TenderReport(
        tender_id=tender.id,
        title=tender.title,
        bid_number=tender.bid_number,
        buyer_organisation=tender.buyer_organisation,
        bid_due_date=str(tender.bid_due_date) if tender.bid_due_date else None,
        generated_at=datetime.now(UTC),
        checklist_confirmed=checklist_confirmed,
        requirements=report_requirements,
        bidders=bidders,
        external_verification_source=_posture(settings.portal_mode),
        llm_provider_extraction=settings.provider_for_role("EXTRACTION"),
        llm_provider_reasoning=settings.provider_for_role("REASONING"),
        audit_chain_integrity=bool(integrity.intact),
    )


def _posture(portal_mode: str) -> str:
    if portal_mode == "hybrid":
        return "mixed"
    return "simulated"


# ── HTML rendering (print-ready, self-contained) ─────────────────────────────
def render_html(report: TenderReport) -> str:
    """Render the report as a single printable HTML document."""
    esc = html.escape

    def status_legend() -> str:
        legend = "<p class='legend'><strong>Legible without colour:</strong> "
        order = [
            "COMPLIANT",
            "PARTIALLY_COMPLIANT",
            "NEEDS_HUMAN_REVIEW",
            "UNVERIFIED",
            "MISSING_EVIDENCE",
            "NON_COMPLIANT",
            "EXPIRED",
            "INCONSISTENT",
            "NOT_APPLICABLE",
        ]
        legend += " · ".join(
            f'<span class="chip chip-{_chip_class(s)}">{s.replace("_", " ").title()}</span>' for s in order
        )
        return legend + "</p>"

    bidders_html: list[str] = []
    if not report.bidders:
        checklist_rows = "".join(
            "<tr>"
            f"<td class='mono'>{esc(r.code)}</td>"
            f"<td>{esc(r.name)}</td>"
            f"<td class='mono'>{esc(r.category or '—')}</td>"
            f"<td class='mono'>{esc(str(r.weight))}</td>"
            f"<td class='mono'>{esc(r.applicability_scope)}</td>"
            + ("<td>Mandatory</td>" if r.mandatory else "<td>Optional</td>")
            + "</tr>"
            for r in report.requirements
        )
        bidders_html.append(
            "<section>"
            "<h3>Eligibility checklist</h3>"
            "<table><thead><tr>"
            "<th>Code</th><th>Condition</th><th>Category</th><th>Weight</th>"
            "<th>Applicability</th><th>Necessity</th>"
            "</tr></thead><tbody>"
            + checklist_rows
            + "</tbody></table>"
            "</section>"
        )

    for b in report.bidders:
        rows: list[str] = []
        for r in b.requirements:
            evidence_cells = ""
            if r.evidence:
                items = "".join(
                    f"<li>{esc(e.document_type)} — {esc(e.filename)} p.{e.page}"
                    + (f": {esc('; '.join(e.fields))}" if e.fields else "")
                    + (f" <em>({esc(e.snippet)})</em>" if e.snippet else "")
                    + "</li>"
                    for e in r.evidence
                )
                evidence_cells += f"<ul class='evidence'>{items}</ul>"

            external = ""
            if r.external_check_portal:
                source_label = "simulated" if r.external_check_source == "simulated" else "live"
                external = (
                    f'<span class="chip chip-{"sim" if source_label == "simulated" else "live"}">'
                    f"{esc(r.external_check_portal)} · {source_label}</span>"
                )

            rows.append(
                "<tr>"
                f"<td class='mono'>{esc(r.code)}</td>"
                f"<td>{esc(r.name)}"
                + (f"<div class='sub'>{esc(r.applicability_scope)}"
                   + (" · mandatory" if r.mandatory else "")
                   + "</div>"
                   if r.applicability_scope or r.mandatory
                   else "")
                + "</td>"
                f"<td class='mono'>{esc(r.category or '—')}</td>"
                f"<td class='mono'>{esc(str(r.weight))}</td>"
                f"<td>{_status_chip(r.effective_status, r.overridden)}</td>"
                f"<td>{external}</td>"
                f"<td>"
                + (f"<p class='reason'>{esc(r.reasoning or '')}</p>" if r.reasoning else "")
                + evidence_cells
                + "</td>"
                "</tr>"
            )

        decision = ""
        if b.decision:
            decision = (
                f"<p><strong>Decision:</strong> {esc(b.decision)}"
                + (f" — {esc(b.decision_justification)}" if b.decision_justification else "")
                + "</p>"
            )

        flags = "".join(
            f"<li><span class='chip chip-{_severity_class(f['severity'])}'>{esc(f['severity'].upper())}</span> "
            f"{esc(f['description'])}</li>"
            for f in b.risk_flags
        )
        findings = "".join(
            f"<li><span class='chip chip-{_severity_class(f['severity'])}'>{esc(f['severity'].upper())}</span> "
            f"{esc(f['description'])}"
            + (
                f" — {esc(f['field_name'])}: '{esc(f['value_a'])}' vs '{esc(f['value_b'])}'"
                if f.get("value_a") or f.get("value_b")
                else ""
            )
            + "</li>"
            for f in b.findings
        )

        bidders_html.append(
            "<section>"
            f"<h3>{esc(b.legal_name)}</h3>"
            "<div class='meta'>"
            f"<span>Score: <strong>{esc(str(b.compliance_score))}</strong></span>"
            f"<span>Risk: <strong>{esc(str(b.risk_level) or '—')}</strong></span>"
            f"<span>Mandatory gate: "
            f"{'passed' if b.mandatory_gate_passed else ('failed' if b.mandatory_gate_passed is False else '—')}"
            "</span>"
            "</div>"
            + decision
            + (
                f"<p class='recommendation'><strong>Recommendation — advisory · "
                f"{esc(b.recommendation_action or '')}</strong><br/>"
                f"{esc(b.recommendation_text or '')}</p>"
                if b.recommendation_text
                else ""
            )
            + (f"<ul class='findings'>{flags}{findings}</ul>" if (flags or findings) else "")
            + "<table><thead><tr>"
            "<th>Code</th><th>Condition</th><th>Category</th><th>Weight</th>"
            "<th>Verdict</th><th>External check</th><th>Evidence / reasoning</th>"
            "</tr></thead><tbody>"
            + "".join(rows)
            + "</tbody></table>"
            "</section>"
        )

    meta = (
        "<p class='legend'>"
        f"Generated {esc(report.generated_at.strftime('%d %b %Y %H:%M UTC'))} · "
        f"Tender {esc(str(report.tender_id))} · "
        f"Checklist {'confirmed' if report.checklist_confirmed else 'not confirmed'} · "
        f"External checks: <strong>{esc(report.external_verification_source)}</strong> · "
        f"LLM: extraction={esc(report.llm_provider_extraction)}, "
        f"reasoning={esc(report.llm_provider_reasoning)} · "
        f"Audit chain integrity: {'intact' if report.audit_chain_integrity else 'BROKEN'}"
        "</p>"
    )

    bid_number_line = f" · {esc(report.bid_number)}" if report.bid_number else ""
    bid_due_line = (
        f" · Bid due {esc(report.bid_due_date)}" if report.bid_due_date else ""
    )

    return _HTML_TEMPLATE.format(
        title=esc(report.title),
        bid_number_line=bid_number_line,
        bid_due_line=bid_due_line,
        buyer=esc(report.buyer_organisation or ""),
        meta=meta,
        status_legend=status_legend(),
        bidders="".join(bidders_html),
    )


def _chip_class(status: str | None) -> str:
    if not status:
        return "none"
    return status.replace("_", "-").lower()


def _severity_class(sev: str | None) -> str:
    return (sev or "info").lower()


def escaped_status(status: str | None) -> str:
    return (status or "—").replace("_", " ").title()


def _status_chip(status: str | None, overridden: bool) -> str:
    label = escaped_status(status)
    cls = _chip_class(status)
    override = " <em>(officer override)</em>" if overridden else ""
    return f'<span class="chip chip-{cls}">{label}</span>{override}'


_HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Vericore report — {title}</title>
<style>
  :root {{
    --ink: #111827; --ink-muted: #4B5563; --ink-faint: #9CA3AF;
    --paper: #FBFBF9; --surface: #FFFFFF; --rule: #E5E3DE;
    --seal: #1E3A5F; --verified: #0F6E56; --review: #B45309;
    --failed: #9F1239; --inactive: #6B7280;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--paper); color: var(--ink);
         font: 14px/1.55 Inter, system-ui, -apple-system, sans-serif; }}
  .sheet {{ max-width: 1100px; margin: 24px auto; padding: 40px 48px;
           background: var(--surface); border: 1px solid var(--rule);
           box-shadow: 0 1px 2px rgba(17,24,39,.06); }}
  .sealbar {{ border-top: 4px solid var(--seal); margin-bottom: 28px; }}
  h1 {{ font: 600 26px/1.2 "Source Serif 4", Georgia, serif; margin: 0 0 4px; }}
  .idline {{ color: var(--ink-faint); font-size: 12px; }}
  .meta {{ display: flex; flex-wrap: wrap; gap: 12px 24px; font-size: 12.5px;
          color: var(--ink-muted); border-top: 1px solid var(--rule);
          padding-top: 14px; margin: 18px 0 4px; }}
  .legend {{ font-size: 12px; color: var(--ink-muted); margin: 6px 0 18px; }}
  section {{ margin: 22px 0 0; border: 1px solid var(--rule); border-radius: 6px; }}
  section > h3 {{ margin: 0; padding: 14px 18px; font: 600 16px "Source Serif 4", Georgia, serif;
                 border-bottom: 1px solid var(--rule); background: #fafaf8; }}
  .meta > span {{ }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
       color: var(--ink-faint); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--rule); }}
  td {{ padding: 10px 12px; vertical-align: top; border-bottom: 1px solid var(--rule); font-size: 13px; }}
  tr:last-child td {{ border-bottom: 0; }}
  .mono {{ font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; }}
  .sub {{ color: var(--ink-faint); font-size: 11px; margin-top: 2px; }}
  .chip {{ display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px;
          font-weight: 600; border: 1px solid transparent; white-space: nowrap; }}
  .chip-compliant {{ background: color-mix(in srgb, var(--verified) 14%, transparent);
                     color: var(--verified); }}
  .chip-non-compliant, .chip-expired {{ background: color-mix(in srgb, var(--failed) 14%, transparent);
                     color: var(--failed); }}
  .chip-partially-compliant, .chip-needs-human-review, .chip-unverified {{
    background: color-mix(in srgb, var(--review) 14%, transparent); color: var(--review); }}
  .chip-missing-evidence {{ background: color-mix(in srgb, var(--inactive) 12%, transparent);
                     color: var(--inactive); }}
  .chip-not-applicable {{ background: #eee; color: var(--ink-faint); }}
  .chip-inconsistent {{ background: color-mix(in srgb, var(--failed) 20%, transparent); color: var(--failed); }}
  .chip-sim {{ background: color-mix(in srgb, var(--inactive) 12%, transparent); color: var(--inactive); }}
  .chip-live {{ background: color-mix(in srgb, var(--verified) 14%, transparent); color: var(--verified); }}
  .chip-critical, .chip-high {{ background: color-mix(in srgb, var(--failed) 14%, transparent); color: var(--failed); }}
  .chip-medium {{ background: color-mix(in srgb, var(--review) 14%, transparent); color: var(--review); }}
  .chip-low, .chip-info {{ background: color-mix(in srgb, var(--inactive) 12%, transparent); color: var(--inactive); }}
  .chip-none {{ background: #eee; color: var(--ink-faint); }}
  ul.evidence, ul.findings {{ margin: 6px 0 0; padding-left: 18px; font-size: 12px; color: var(--ink-muted); }}
  p.reason {{ margin: 0 0 4px; }}
  .recommendation {{ font-style: italic; color: var(--ink-muted); margin: 8px 18px; font-size: 13px; }}
  .findings {{ margin: 8px 18px; }}
  em {{ color: var(--ink-faint); }}
  @media print {{
    body {{ background: #fff; }}
    .sheet {{ box-shadow: none; border: 0; margin: 0; max-width: none; }}
  }}
</style>
</head>
<body>
<div class="sheet">
  <div class="sealbar"></div>
  <p class="idline">VERICORE · BID COMPLIANCE REPORT · TENDER{bid_number_line}</p>
  <h1>{title}</h1>
  <p class="idline">{buyer}{bid_due_line}</p>
  {meta}
  {status_legend}
  {bidders}
</div>
</body>
</html>
"""