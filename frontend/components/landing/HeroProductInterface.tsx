"use client";

import { useState } from "react";
import { Check, AlertCircle, FileText, ChevronRight } from "lucide-react";

interface SampleClause {
  id: string;
  code: string;
  name: string;
  threshold: string;
  verdict: "COMPLIANT" | "NEEDS_HUMAN_REVIEW" | "INCONSISTENT";
  verdictLabel: string;
  sourceDoc: string;
  page: number;
  extractedValues: string[];
  notes: string;
}

const SAMPLE_CLAUSES: SampleClause[] = [
  {
    id: "turnover",
    code: "REQ-02",
    name: "Average Annual Financial Turnover",
    threshold: "≥ ₹10.0 Crore across last 3 audited fiscal years",
    verdict: "COMPLIANT",
    verdictLabel: "Compliant ✓",
    sourceDoc: "Audited_Financial_Statement.pdf",
    page: 47,
    extractedValues: [
      "FY 2023–24: ₹38.20 Cr",
      "FY 2022–23: ₹34.50 Cr",
      "FY 2021–22: ₹29.10 Cr",
      "Computed Average: ₹33.93 Cr (Threshold: ≥ ₹10.0 Cr)",
    ],
    notes: "Deterministic calculation verified against CA certificate table.",
  },
  {
    id: "gst",
    code: "REQ-05",
    name: "GSTIN & PAN Structural Alignment",
    threshold: "Chars 3–12 of GSTIN must match PAN card exactly",
    verdict: "COMPLIANT",
    verdictLabel: "Compliant ✓",
    sourceDoc: "GST_Registration_Certificate.pdf",
    page: 1,
    extractedValues: [
      "GSTIN: 07AAACL1234F1Z5 (p.1)",
      "PAN Card: AAACL1234F (p.1)",
      "Entity: L&T Hydrocarbon Engineering Ltd",
      "Cross-check: Exactly Matched (No Discrepancy)",
    ],
    notes: "Cross-document check: zero contradiction between statutory IDs.",
  },
  {
    id: "experience",
    code: "REQ-08",
    name: "Prior Similar Work Order Experience",
    threshold: "1 completed contract ≥ ₹8 Cr or 2 contracts ≥ ₹5 Cr",
    verdict: "NEEDS_HUMAN_REVIEW",
    verdictLabel: "Officer Review ◆",
    sourceDoc: "Work_Completion_Certificate.pdf",
    page: 12,
    extractedValues: [
      "Client: CPCL Refinery Expansion Project",
      "Value: ₹9.40 Crore (Piping Replacement)",
      "Completion Date: 14-Nov-2024",
      "Status: Referred to Officer for scope similarity check",
    ],
    notes: "Semantic scope evaluation requires procurement officer judgement.",
  },
];

export function HeroProductInterface() {
  const [selectedId, setSelectedId] = useState("turnover");
  const active = SAMPLE_CLAUSES.find((c) => c.id === selectedId) ?? SAMPLE_CLAUSES[0];

  return (
    <div className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
      {/* Mini App Header */}
      <div className="flex items-center justify-between border-b border-rule bg-surface-muted px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-seal" />
          <span className="text-[11px] font-mono uppercase font-bold text-ink tracking-wider">
            Vericore Inspection Console
          </span>
        </div>
        <span className="text-[10px] font-mono text-ink-faint">
          TENDER: CPCL/2026/SR/01
        </span>
      </div>

      {/* Clause Switcher Tabs */}
      <div className="flex border-b border-rule bg-surface-subtle overflow-x-auto text-[11px]">
        {SAMPLE_CLAUSES.map((clause) => (
          <button
            key={clause.id}
            onClick={() => setSelectedId(clause.id)}
            className={`flex items-center gap-1.5 px-3 py-2 font-mono transition-colors whitespace-nowrap border-r border-rule last:border-r-0 ${
              selectedId === clause.id
                ? "bg-surface font-semibold text-seal border-b-2 border-b-seal -mb-px"
                : "text-ink-muted hover:text-ink hover:bg-surface-muted"
            }`}
          >
            <span>{clause.code}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                clause.verdict === "COMPLIANT" ? "bg-verified" : "bg-review"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Main Miniature Inspection Pane */}
      <div className="p-5 space-y-4 text-left">
        {/* Requirement & Verdict Banner */}
        <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-faint font-mono">
              <span>{active.code}</span>
              <span>·</span>
              <span>NIT MANDATORY CONDITION</span>
            </div>
            <h4 className="text-[14px] font-semibold text-ink mt-0.5">
              {active.name}
            </h4>
            <p className="text-[12px] text-ink-muted mt-0.5">
              {active.threshold}
            </p>
          </div>

          <div
            className={`rounded-[3px] border px-2.5 py-1 text-[11px] font-semibold font-mono tracking-wide shrink-0 ${
              active.verdict === "COMPLIANT"
                ? "border-verified-border bg-verified-bg text-verified"
                : "border-review-border bg-review-bg text-review"
            }`}
          >
            {active.verdictLabel}
          </div>
        </div>

        {/* Source Citation Box */}
        <div className="rounded-[3px] border border-rule bg-surface-subtle p-3 text-[12px]">
          <div className="flex items-center justify-between text-[11px] font-mono text-ink-faint mb-1.5">
            <span className="uppercase tracking-wider font-semibold">Evidence Citation</span>
            <span className="text-seal font-medium">Page {active.page} Coordinates [x:120, y:340]</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-seal shrink-0" />
            <span className="font-mono font-medium text-ink truncate text-[12px]">
              {active.sourceDoc}
            </span>
          </div>
        </div>

        {/* Extracted Values Table */}
        <div className="rounded-[3px] border border-rule bg-surface overflow-hidden">
          <div className="border-b border-rule bg-surface-muted px-3 py-1.5 text-[10px] uppercase tracking-wider font-mono font-bold text-ink-faint">
            Deterministic Extraction from Page {active.page}
          </div>
          <div className="p-3 space-y-1 font-mono text-[11px] text-ink bg-surface">
            {active.extractedValues.map((val, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-ink-faint select-none">›</span>
                <span className={idx === active.extractedValues.length - 1 ? "font-semibold text-seal" : ""}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Footnote */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-ink-faint">
          <span className="font-mono text-[10px]">HASH: sha256:4a8f9b…</span>
          <span className="italic">The officer decides · System never auto-qualifies</span>
        </div>
      </div>
    </div>
  );
}
