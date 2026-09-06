"use client";

import type { ComplianceRow, VerificationSummary } from "../lib/types";
import { Identifier } from "./status";

/**
 * What to do next, spelled out.
 *
 * The officer should never have to scan a fifteen-row table to find the two
 * rows that need them. Each item says what is outstanding, why, and what
 * action would clear it — and takes you straight to the evidence.
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
    <section className="rounded-[6px] border border-rule bg-surface">
      <div className="border-b border-rule px-7 py-4">
        <h2 className="text-[20px]">What needs you</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          {rows.length} of {summary.requirements.length} conditions are unresolved. Everything
          else is settled.
        </p>
      </div>
      <ul className="divide-y divide-rule">
        {rows.map((row) => {
          const isFailure = summary.mandatory_failed.includes(row.requirement_code);
          return (
            <li key={row.requirement_code} className="px-7 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-2.5">
                    <Identifier
                      value={row.requirement_code}
                      className="text-[12px] text-ink-faint"
                    />
                    <span className="text-[15px] font-medium">{row.requirement_name}</span>
                  </p>
                  <p className="mt-1.5 max-w-[80ch] text-[14px] leading-relaxed text-ink-muted">
                    {plainReason(row, isFailure)}
                  </p>
                  <p
                    className="mt-2.5 text-[13px]"
                    style={{ color: isFailure ? "var(--failed)" : "var(--review)" }}
                  >
                    {isFailure
                      ? "To clear this you would have to override the system's finding, and say why."
                      : "To clear this, read the evidence and accept it — or override with your own verdict."}
                  </p>
                </div>
                <button
                  onClick={() => onOpen(row)}
                  className="shrink-0 rounded-[4px] border border-seal px-4 py-2 text-[14px] font-medium text-seal transition-colors hover:bg-seal-tint"
                >
                  Review this
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The nine states restated in a sentence, so none of them needs prior knowledge. */
function plainReason(row: ComplianceRow, isFailure: boolean): string {
  const status = row.effective_status ?? row.status;
  switch (status) {
    case "NEEDS_HUMAN_REVIEW":
      return "The system would not decide this one. It is a matter of judgement rather than something that can be measured, so it was passed to you rather than guessed at.";
    case "MISSING_EVIDENCE":
      return "No document was submitted that could answer this condition. Asking the bidder for it is a permitted step — it is not a failure.";
    case "UNVERIFIED":
      return "The check against the government register could not be run, so nothing is being claimed about it either way.";
    case "NON_COMPLIANT":
      return row.reasoning ?? "The evidence was found and it falls short of what the tender asks.";
    case "EXPIRED":
      return row.reasoning ?? "The document would have satisfied this, but it had lapsed by the bid due date.";
    case "INCONSISTENT":
      return row.reasoning ?? "The bidder's own documents contradict each other on this point.";
    case "PARTIALLY_COMPLIANT":
      return "Some parts of this condition are met and some are not.";
    default:
      return row.reasoning ?? (isFailure ? "This condition is not met." : "This needs your attention.");
  }
}
