import type { VerificationSummary } from "../lib/types";
import { RiskChip } from "./status";

/**
 * The score and the risk level answer different questions and are shown as two
 * separate readings, never merged (CLAUDE.md §10).
 *
 * The two outstanding-work lists are also kept apart. A mandatory item awaiting
 * the officer is unresolved, not failed, and collapsing the distinction would
 * tell an officer that a compliant bidder had fallen short.
 */
export function ScorePanel({ summary }: { summary: VerificationSummary }) {
  const failed = summary.mandatory_failed;
  const pending = summary.pending_review;

  return (
    <section className="grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-rule bg-rule md:grid-cols-3">
      <div className="bg-surface p-5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          Compliance score
        </p>
        <p className="mt-2 font-serif text-[32px] leading-none">
          {summary.compliance_score ?? "—"}
          <span className="ml-1 text-[16px] text-ink-faint">/ 100</span>
        </p>
        <p className="mt-2 text-[13px] text-ink-muted">
          A weighted average over the tender&rsquo;s own conditions. Recomputable by
          hand from the table below.
        </p>
      </div>

      <div className="bg-surface p-5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">Risk level</p>
        <p className="mt-2">
          <span className="font-serif text-[32px] leading-none">
            <RiskChip level={summary.risk_level} />
          </span>
        </p>
        <p className="mt-2 text-[13px] text-ink-muted">
          {summary.risk_flags.length === 0
            ? "No risk signals fired."
            : `${summary.risk_flags.length} signal${
                summary.risk_flags.length === 1 ? "" : "s"
              } fired. Counted separately from the score.`}
        </p>
      </div>

      <div className="bg-surface p-5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          Mandatory conditions
        </p>
        <div className="mt-2 space-y-2">
          <Row
            tone={failed.length ? "failed" : "verified"}
            mark={failed.length ? "✕" : "✓"}
            label={failed.length ? `${failed.length} not met` : "None unmet"}
            codes={failed}
          />
          <Row
            tone={pending.length ? "review" : "verified"}
            mark={pending.length ? "◆" : "✓"}
            label={
              pending.length ? `${pending.length} awaiting you` : "None awaiting you"
            }
            codes={pending}
          />
        </div>
        <p className="mt-3 border-t border-rule pt-2 text-[13px]">
          {summary.qualifiable ? (
            <span style={{ color: "var(--verified)" }}>
              ✓ Nothing outstanding — this bidder can be qualified.
            </span>
          ) : (
            <span className="text-ink-muted">
              Not yet qualifiable. Clear the items above first.
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

function Row({
  tone,
  mark,
  label,
  codes,
}: {
  tone: "failed" | "review" | "verified";
  mark: string;
  label: string;
  codes: string[];
}) {
  const colour =
    tone === "failed" ? "var(--failed)" : tone === "review" ? "var(--review)" : "var(--verified)";
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]" style={{ color: colour }}>
      <span aria-hidden>{mark}</span>
      <span>{label}</span>
      {codes.length > 0 && (
        <span className="identifier text-[12px] text-ink-muted">{codes.join(" · ")}</span>
      )}
    </p>
  );
}
