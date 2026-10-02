"use client";

import { useEffect, useRef, useState } from "react";
import type { ComplianceRow, VerificationSummary } from "../../types/api";
import { submitReview } from "../../lib/api";

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

  const text = recommendation(summary, selected);
  const [expanded, setExpanded] = useState(false);
  // Whether the one-line recommendation is cut off, and so needs "Read in full".
  const lineRef = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const obs = new ResizeObserver(check);
    obs.observe(el);
    return () => obs.disconnect();
  }, [text]);

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
    <div className="decision-bar-shadow sticky bottom-0 z-40 border-t border-rule bg-surface">
      <div className="mx-auto max-w-[1240px] px-6 py-2">
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

        {/* The full recommendation, only when asked for. The bar stays on
            screen over the page, so by default it holds one line. */}
        {expanded && (
          <div
            id="recommendation-full"
            className="mb-2 max-h-[40vh] overflow-y-auto rounded-[6px] border border-rule bg-paper px-4 py-3"
          >
            <p className="text-[13px] italic leading-relaxed text-ink-muted">{text}</p>
            {summary.recommendation_text && (
              <p className="mt-2 text-[11px] text-ink-faint">
                Generated from the structured verdicts
                {summary.recommendation_action
                  ? ` · ${summary.recommendation_action.replace(/_/g, " ").toLowerCase()}`
                  : ""}
              </p>
            )}
            {!identified && (
              <p className="mt-2 text-[12px]" style={{ color: "var(--review)" }}>
                No officer is signed in, so no decision can be recorded. Set
                NEXT_PUBLIC_OFFICER_ID until the authentication gate is built.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <blockquote className="min-w-[240px] flex-1 border-l-2 border-rule pl-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              Recommendation — advisory
              {!identified && (
                <span
                  className="ml-2 normal-case tracking-normal"
                  style={{ color: "var(--review)" }}
                  title="Set NEXT_PUBLIC_OFFICER_ID until the authentication gate is built."
                >
                  · no officer signed in
                </span>
              )}
            </p>
            <div className="flex min-w-0 items-baseline gap-2">
              {/* Hidden while the full text is open above, rather than repeated. */}
              <p
                ref={lineRef}
                className={`min-w-0 truncate text-[13px] italic text-ink-muted ${expanded ? "hidden" : ""}`}
              >
                {text}
              </p>
              {(overflowing || expanded) && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-controls="recommendation-full"
                  className="shrink-0 text-[12px] font-medium text-seal hover:underline"
                >
                  {expanded ? "Show less" : "Read in full"}
                </button>
              )}
            </div>
          </blockquote>

          <div className="flex shrink-0 items-center gap-2">
            <p className="mr-1 hidden max-w-[26ch] truncate text-[12px] text-ink-faint lg:block">
              {selected ? `Acting on ${selected.requirement_code}` : "Open a condition to act on it"}
            </p>
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
              className="rounded-[4px] border border-rule px-3.5 py-1.5 text-[13px] text-ink disabled:opacity-35"
            >
              Accept condition
            </button>
            <button
              onClick={() => setOpen("override")}
              disabled={!selected || !identified}
              title={!selected ? "Select a condition first" : undefined}
              className="rounded-[4px] border border-rule px-3.5 py-1.5 text-[13px] text-ink disabled:opacity-35"
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
 * The narrative shown beside the decision bar. When the reasoning model has
 * produced one it is shown verbatim (it is advisory, and already grounded in
 * the structured verdicts); otherwise a deterministic description of the state
 * of play fills in, so the bar never reads as empty. Neither ever tells the
 * officer what to do and neither names the outcome — the system has no view on
 * whether to qualify (§7.4, §11).
 */
function recommendation(summary: VerificationSummary, selected: ComplianceRow | null): string {
  if (summary.recommendation_text) {
    return summary.recommendation_text;
  }
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
