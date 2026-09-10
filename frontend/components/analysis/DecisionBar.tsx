"use client";

import { useState } from "react";
import type { ComplianceRow, VerificationSummary } from "../../types/api";
import { submitReview } from "../../lib/api";
import { UserCheck, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * DecisionBar: The Statutory Human Decision Gate.
 * Enforces: "The officer decides. The system never does."
 * Any officer action requires permanent justification committed to the hash-chained audit trail.
 */
export function DecisionBar({
  bidId,
  summary,
  selected,
  onUpdated,
}: {
  bidId: string;
  summary: VerificationSummary;
  selected: ComplianceRow | null;
  onUpdated: (next: VerificationSummary) => void;
}) {
  const [open, setOpen] = useState<null | "accept" | "override">(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("COMPLIANT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const officerId = process.env.NEXT_PUBLIC_OFFICER_ID ?? "";
  const identified = officerId.length > 0;

  const effective = selected ? (selected.effective_status ?? selected.status) : null;
  const canAccept =
    effective !== null &&
    ["NEEDS_HUMAN_REVIEW", "UNVERIFIED", "PARTIALLY_COMPLIANT", "MISSING_EVIDENCE"].includes(
      effective,
    );

  async function send(action: "accept" | "override") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const next = await submitReview(bidId, {
        requirement_code: selected.requirement_code,
        action,
        officer_id: officerId,
        reason: reason.trim(),
        ...(action === "override" ? { override_status: status } : {}),
      });
      onUpdated(next);
      setOpen(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record determination.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-label="Officer Decision Bar" className="decision-bar-shadow sticky bottom-0 z-40 border-t border-rule bg-surface/98 backdrop-blur-xs">
      <div className="mx-auto max-w-[1240px] px-6 py-3.5">
        {/* Expanded Justification Form */}
        {open && selected && (
          <form
            className="mb-3 rounded-[4px] border border-seal/30 bg-surface-subtle p-5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void send(open);
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-seal" />
              <h3 className="font-serif text-[15px] font-semibold text-ink">
                {open === "accept"
                  ? `Officer Acceptance: Clause ${selected.requirement_code}`
                  : `Statutory Override: Clause ${selected.requirement_code}`}
              </h3>
            </div>

            <p className="text-[12px] text-ink-muted leading-relaxed">
              Every officer action is cryptographically sealed with your ID to the PostgreSQL audit trail.
              Formal written justification is required under CVC/CAG compliance guidelines.
            </p>

            {open === "override" && (
              <div className="mt-3 flex items-center gap-3">
                <label htmlFor="override-status-select" className="text-[12px] font-semibold text-ink">
                  Officer Determined Verdict:
                </label>
                <select
                  id="override-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-[3px] border border-rule bg-surface px-3 py-1.5 text-[13px] font-medium text-ink focus:border-seal"
                >
                  {["COMPLIANT", "NON_COMPLIANT", "PARTIALLY_COMPLIANT", "NOT_APPLICABLE"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="mt-3">
              <label htmlFor="decision-reason-textarea" className="block text-[12px] font-semibold text-ink mb-1">
                Official Reasoning / Audit Explanation <span className="text-failed">*</span>
              </label>
              <textarea
                id="decision-reason-textarea"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-[3px] border border-rule bg-surface p-2.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-seal outline-none"
                placeholder="Cite specific documents, dates, calculations, or executive approval references..."
              />
            </div>

            {error && (
              <p className="mt-2 text-[12px] font-medium text-failed bg-failed-bg border border-failed-border p-2 rounded-[3px]">
                {error}
              </p>
            )}

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="submit"
                disabled={busy || reason.trim().length === 0}
                className="rounded-[3px] bg-seal px-4 py-2 text-[13px] font-semibold text-white hover:bg-seal-strong transition-colors disabled:opacity-40"
              >
                {busy ? "Sealing to Audit Log…" : "Record Decision to Audit Log"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  setError(null);
                }}
                className="rounded-[3px] border border-rule bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Closed Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Advisory Recommendation */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="border-l-2 border-seal pl-3 py-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-seal">
                  System Analysis · Advisory Only
                </span>
                {summary.recommendation_action && (
                  <span className="rounded-[2px] bg-surface-muted border border-rule px-1.5 py-0.2 text-[9px] font-mono uppercase text-ink-faint">
                    {summary.recommendation_action.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-ink-muted italic font-serif leading-snug line-clamp-2">
                &ldquo;{recommendation(summary, selected)}&rdquo;
              </p>
              {!identified && (
                <p className="mt-1 text-[11px] font-medium text-review">
                  Officer identity not detected (set NEXT_PUBLIC_OFFICER_ID to record decisions).
                </p>
              )}
            </div>
          </div>

          {/* Right: Statutory Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {selected && (
              <span className="hidden md:inline text-[11px] text-ink-faint font-mono mr-1">
                Selected: {selected.requirement_code}
              </span>
            )}
            <button
              onClick={() => setOpen("accept")}
              disabled={!selected || !canAccept || !identified}
              title={
                !selected
                  ? "Select a checklist row first"
                  : canAccept
                    ? undefined
                    : "Condition has a deterministic verdict; use Override to change it"
              }
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-verified bg-verified-bg px-3.5 py-2 text-[13px] font-medium text-verified hover:bg-verified hover:text-white transition-colors disabled:opacity-35"
            >
              <CheckCircle2 size={15} />
              <span>Accept Condition</span>
            </button>

            <button
              onClick={() => setOpen("override")}
              disabled={!selected || !identified}
              title={!selected ? "Select a checklist row first" : undefined}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-seal bg-seal px-3.5 py-2 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors disabled:opacity-35"
            >
              <UserCheck size={15} />
              <span>Override Verdict</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function recommendation(
  summary: VerificationSummary,
  selected: ComplianceRow | null,
): string {
  if (summary.recommendation_text) {
    return summary.recommendation_text;
  }
  if (selected) {
    const effective = selected.effective_status ?? selected.status;
    if (effective === "NEEDS_HUMAN_REVIEW") {
      return `Clause ${selected.requirement_code} is subjective and referred for officer determination.`;
    }
    if (effective === "MISSING_EVIDENCE") {
      return `Clause ${selected.requirement_code} lacks documentation. Clarification shortfall request recommended.`;
    }
  }
  if (summary.mandatory_failed.length) {
    return `${summary.mandatory_failed.length} mandatory clause(s) failed deterministic check: ${summary.mandatory_failed.join(", ")}.`;
  }
  if (summary.pending_review.length) {
    return `Deterministic rules satisfied. ${summary.pending_review.length} clause(s) awaiting officer judgment: ${summary.pending_review.join(", ")}.`;
  }
  return "All mandatory clauses satisfied. Final statutory decision rests with the Procurement Officer.";
}
