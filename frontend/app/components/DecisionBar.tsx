"use client";

import { useState } from "react";
import type { ComplianceRow, VerificationSummary } from "../lib/types";
import { submitReview } from "../lib/api";

/**
 * Sticky, and always deliberate (CLAUDE.md §11).
 *
 * Every action opens a justification field that cannot be skipped. The AI
 * recommendation sits beside it labelled advisory and styled as a quotation
 * rather than a control, so it never reads as the system pre-selecting an
 * answer.
 *
 * This is the one place in the interface a shadow is used.
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

  // Demo officer identity, from the environment. Real authentication arrives
  // with the §17 auth gate; until then the interface says plainly when it does
  // not know who is acting, rather than recording an action against nobody.
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
      setError(e instanceof Error ? e.message : "Could not record that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="decision-bar-shadow sticky bottom-0 z-10 border-t border-rule bg-surface">
      <div className="mx-auto max-w-[1240px] px-6 py-3">
        {open && selected && (
          <form
            className="mb-3 rounded-[6px] border border-rule bg-paper p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(open);
            }}
          >
            <label
              htmlFor="reason"
              className="block text-[13px] font-medium text-ink"
            >
              {open === "accept"
                ? `Why are you satisfied with ${selected.requirement_code}?`
                : `Why are you overriding ${selected.requirement_code}?`}
            </label>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              This is recorded permanently against your name. It cannot be left blank.
            </p>

            {open === "override" && (
              <div className="mt-3">
                <label htmlFor="status" className="text-[12px] text-ink-muted">
                  Your verdict
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="ml-2 rounded-[4px] border border-rule bg-surface px-2 py-1 text-[13px]"
                >
                  {["COMPLIANT", "NON_COMPLIANT", "PARTIALLY_COMPLIANT", "NOT_APPLICABLE"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ").toLowerCase()}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <textarea
              id="reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-[4px] border border-rule bg-surface p-2 text-[14px] leading-relaxed"
              placeholder="State what you checked and what you concluded."
            />
            {error && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--failed)" }}>
                {error}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={busy || reason.trim().length === 0}
                className="rounded-[4px] bg-seal px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40"
              >
                {busy ? "Recording…" : "Record and continue"}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(null); setError(null); }}
                className="rounded-[4px] border border-rule px-4 py-2 text-[14px] text-ink-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <blockquote className="max-w-[62ch] border-l-2 border-rule pl-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              Recommendation — advisory
            </p>
            <p className="mt-0.5 text-[13px] italic leading-relaxed text-ink-muted">
              {advisory(summary, selected)}
            </p>
            {!identified && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--review)" }}>
                No officer is signed in, so no decision can be recorded. Set
                NEXT_PUBLIC_OFFICER_ID until the authentication gate is built.
              </p>
            )}
          </blockquote>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setOpen("accept")}
              disabled={!selected || !canAccept || !identified}
              title={
                !selected
                  ? "Select a condition first"
                  : canAccept
                    ? undefined
                    : "The system reached a verdict on this one — recording a different view is an override"
              }
              className="rounded-[4px] border border-rule px-4 py-2 text-[14px] text-ink disabled:opacity-35"
            >
              Accept condition
            </button>
            <button
              onClick={() => setOpen("override")}
              disabled={!selected || !identified}
              className="rounded-[4px] border border-rule px-4 py-2 text-[14px] text-ink disabled:opacity-35"
            >
              Override verdict
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Describes the state of play. It does not tell the officer what to do, and it
 * never names an outcome — the system has no view on whether to qualify.
 */
function advisory(summary: VerificationSummary, selected: ComplianceRow | null): string {
  if (selected) {
    const effective = selected.effective_status ?? selected.status;
    if (effective === "NEEDS_HUMAN_REVIEW") {
      return `${selected.requirement_code} is a judgement rather than a measurement, so it was referred to you rather than decided.`;
    }
    if (effective === "MISSING_EVIDENCE") {
      return `${selected.requirement_code} has no document that could answer it. Seeking a shortfall document is a permitted step.`;
    }
  }
  if (summary.mandatory_failed.length) {
    return `${summary.mandatory_failed.length} mandatory condition(s) were evaluated and not met: ${summary.mandatory_failed.join(", ")}.`;
  }
  if (summary.pending_review.length) {
    return `Nothing has failed. ${summary.pending_review.length} mandatory condition(s) are waiting on your reading: ${summary.pending_review.join(", ")}.`;
  }
  return "Every mandatory condition is satisfied or has been accepted by you. The decision remains yours.";
}
