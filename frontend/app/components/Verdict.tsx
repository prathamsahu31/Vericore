import type { VerificationSummary } from "../lib/types";

/**
 * One question, answered at the top of the page: can this bidder be qualified?
 *
 * The previous layout opened with three equal-weight panels and left the
 * officer to work out which mattered. This states the position in a sentence,
 * then offers the numbers as supporting detail rather than as the headline.
 */
export function Verdict({ summary }: { summary: VerificationSummary }) {
  const failed = summary.mandatory_failed.length;
  const pending = summary.pending_review.length;

  const tone = failed > 0 ? "failed" : pending > 0 ? "review" : "verified";
  const colour =
    tone === "failed" ? "var(--failed)" : tone === "review" ? "var(--review)" : "var(--verified)";

  const headline =
    failed > 0
      ? `Cannot be qualified as things stand`
      : pending > 0
        ? `Nothing has failed — ${pending} item${pending === 1 ? "" : "s"} need${pending === 1 ? "s" : ""} your decision`
        : `Ready to qualify`;

  const detail =
    failed > 0
      ? `${failed} mandatory condition${failed === 1 ? " was" : "s were"} checked and not met. You can still override, with a reason.`
      : pending > 0
        ? `Every condition the system could decide by itself is satisfied. What is left needs a person.`
        : `Every mandatory condition is satisfied or has been accepted by you. The decision is yours to record.`;

  return (
    <section
      className="rounded-[6px] border bg-surface"
      style={{ borderColor: tone === "verified" ? "#0F6E5640" : colour + "40" }}
    >
      <div className="border-l-4 px-7 py-6" style={{ borderColor: colour }}>
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Where this bid stands
        </p>
        <h2 className="mt-2 font-serif text-[24px] leading-snug" style={{ color: colour }}>
          {headline}
        </h2>
        <p className="mt-2 max-w-[74ch] text-[15px] leading-relaxed text-ink-muted">{detail}</p>

        <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-t border-rule pt-5">
          <Stat
            label="Compliance score"
            value={summary.compliance_score ?? "—"}
            note="weighted average of the tender's own conditions"
          />
          <Stat
            label="Risk level"
            value={
              summary.risk_level
                ? summary.risk_level.charAt(0) + summary.risk_level.slice(1).toLowerCase()
                : "—"
            }
            note={
              summary.risk_flags.length === 0
                ? "no signals fired"
                : `${summary.risk_flags.length} signal${summary.risk_flags.length === 1 ? "" : "s"} fired`
            }
          />
          <Stat
            label="Conditions met"
            value={`${summary.status_counts.COMPLIANT ?? 0} of ${summary.requirements.length}`}
            note="across the whole checklist"
          />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-serif text-[24px] leading-none">{value}</dd>
      <dd className="mt-1.5 text-[12px] text-ink-faint">{note}</dd>
    </div>
  );
}
