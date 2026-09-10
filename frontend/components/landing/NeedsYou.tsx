"use client";

import type { ComplianceRow, VerificationSummary } from "../../types/api";
import { Identifier, StatusChip } from "../ui/status";
import { ArrowRight, AlertCircle } from "lucide-react";

/**
 * Officer Action Queue
 * Surfaces the specific checklist clauses requiring procurement officer adjudication.
 */
export function NeedsYou({
  summary,
  onOpen,
}: {
  summary: VerificationSummary;
  onOpen: (row: ComplianceRow) => void;
}) {
  const codes = [...summary.mandatory_failed, ...summary.pending_review];
  const rows = summary.requirements.filter((r) => codes.includes(r.requirement_code));
  if (rows.length === 0) return null;

  return (
    <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
      <div className="border-b border-rule px-7 py-4.5 bg-surface-subtle flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-review" />
            <h2 className="font-serif text-[18px] font-semibold text-ink">
              Officer Action Queue
            </h2>
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">
            {rows.length} of {summary.requirements.length} conditions require statutory judgment. All other clauses are resolved.
          </p>
        </div>
        <span className="rounded-[3px] border border-review/30 bg-review-bg px-2.5 py-1 text-[11px] font-medium text-review">
          {rows.length} Action{rows.length === 1 ? "" : "s"} Required
        </span>
      </div>

      <ul className="divide-y divide-rule">
        {rows.map((row) => {
          const isFailure = summary.mandatory_failed.includes(row.requirement_code);
          const effective = row.effective_status ?? row.status;

          return (
            <li
              key={row.requirement_code}
              className="px-7 py-4 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Identifier
                      value={row.requirement_code}
                      className="rounded-[2px] bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-ink-muted border border-rule"
                    />
                    <h3 className="font-sans text-[15px] font-semibold text-ink">
                      {row.requirement_name}
                    </h3>
                    <StatusChip status={effective} size="compact" />
                    {row.mandatory && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-failed bg-failed-bg border border-failed-border px-1.5 py-0.5 rounded-[2px]">
                        Mandatory
                      </span>
                    )}
                  </div>

                  <p className="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
                    {plainReason(row, isFailure)}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2 text-[12px]">
                    <span
                      className="font-medium inline-flex items-center gap-1"
                      style={{ color: isFailure ? "var(--failed)" : "var(--review)" }}
                    >
                      <AlertCircle size={13} />
                      {isFailure
                        ? "Action required: Overrule requires formal justification."
                        : "Action required: Review source evidence to accept or request shortfall."}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <button
                    onClick={() => onOpen(row)}
                    className="inline-flex items-center gap-1.5 rounded-[3px] border border-seal bg-surface px-3.5 py-2 text-[13px] font-medium text-seal transition-colors hover:bg-seal hover:text-white"
                  >
                    <span>Inspect Evidence</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function plainReason(row: ComplianceRow, isFailure: boolean): string {
  const status = row.effective_status ?? row.status;
  switch (status) {
    case "NEEDS_HUMAN_REVIEW":
      return "Qualitative condition referred to officer discretion. OCR extracted relevant excerpts but semantic evaluation requires human determination.";
    case "MISSING_EVIDENCE":
      return "No corresponding document found in submitted bundle. Public procurement rules permit issuing a shortfall notice prior to rejection.";
    case "UNVERIFIED":
      return "External government portal check could not complete. Verification stands unverified; manual inspection or external lookup required.";
    case "NON_COMPLIANT":
      return row.reasoning ?? "Extracted numerical or statutory value falls below the threshold specified in the NIT.";
    case "EXPIRED":
      return row.reasoning ?? "Document certificate validity lapsed prior to the published bid submission deadline.";
    case "INCONSISTENT":
      return row.reasoning ?? "Cross-document discrepancy detected across bidder's own submitted documents.";
    case "PARTIALLY_COMPLIANT":
      return "Composite clause: some sub-criteria satisfied while others remain unverified.";
    default:
      return row.reasoning ?? (isFailure ? "Clause criteria unmet." : "Pending officer decision.");
  }
}
