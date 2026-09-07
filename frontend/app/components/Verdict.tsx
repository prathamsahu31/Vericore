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

  const score = summary.compliance_score ?? "—";
  const conditionsMet = summary.status_counts.COMPLIANT ?? 0;
  const conditionsTotal = summary.requirements.length;
  const riskLabel = summary.risk_level
    ? summary.risk_level.charAt(0) + summary.risk_level.slice(1).toLowerCase()
    : "—";

  const riskNote =
    summary.risk_flags.length === 0
      ? "no signals fired"
      : `${summary.risk_flags.length} signal${summary.risk_flags.length === 1 ? "" : "s"} fired — see below`;

  return (
    <section className="rule-top-seal overflow-hidden rounded-[6px] border border-rule bg-surface">
      <div className="border-b border-rule px-7 py-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Where this bid stands
        </p>
        <h2 className="mt-2 font-serif text-[26px] leading-snug" style={{ color: colour }}>
          {headline}
        </h2>
        <p className="mt-2 max-w-[74ch] text-[15px] leading-relaxed text-ink-muted">{detail}</p>
        <div className="mt-4 rounded-[4px] border border-rule bg-paper px-4 py-3">
          <p className="text-[12px] font-medium text-ink-muted">Score and risk are two different questions — they are not combined.</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
            <span className="font-medium text-ink">Score</span> = weighted average of this tender&apos;s own conditions (
            {conditionsMet}/{conditionsTotal} compliant → {score}). A missing document is 0, a human-review item is 0.5.
            <br />
            <span className="font-medium text-ink">Risk</span> = likelihood of misrepresentation, counted from red flags
            (not from pass rate). <span className="font-medium">CRITICAL</span> on any critical flag,{" "}
            <span className="font-medium">HIGH</span> on ≥2 high, <span className="font-medium">MEDIUM</span> on 1 high or
            ≥3 medium, else <span className="font-medium">LOW</span>. That is why a low score can be LOW risk
            (e.g., many missing docs but no deception signal) and a higher score can be CRITICAL (e.g., 64.93 with one
            critical GSTIN/PAN mismatch).
          </p>
        </div>
      </div>

      <dl className="grid gap-px sm:grid-cols-3">
        <StatCard
          label="Compliance score"
          value={score}
          note="weighted average — see per-condition breakdown in the matrix"
          accent="seal"
        />
        <StatCard
          label="Conditions met"
          value={`${conditionsMet} of ${conditionsTotal}`}
          note="compliant of total checklist"
          accent={conditionsMet === conditionsTotal ? "verified" : undefined}
        />
        <StatCard
          label="Risk level"
          value={riskLabel}
          note={riskNote}
          accent={summary.risk_flags.length === 0 ? "verified" : "review"}
        />
      </dl>
      {summary.risk_flags.length > 0 && (
        <div className="border-t border-rule bg-paper px-7 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">Why this risk</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            {summary.risk_flags.slice(0, 2).map((f) => f.description.slice(0, 90) + (f.description.length > 90 ? "…" : "")).join(" · ")}
            {summary.risk_flags.length > 2 ? ` · +${summary.risk_flags.length - 2} more below` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: "seal" | "verified" | "review";
}) {
  const bgMap = {
    seal: "var(--seal-tint)",
    verified: "color-mix(in srgb, var(--verified) 7%, transparent)",
    review: "color-mix(in srgb, var(--review) 7%, transparent)",
  };
  return (
    <div className="bg-paper px-7 py-5" style={accent ? { background: bgMap[accent] } : undefined}>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-serif text-[28px] leading-none tracking-tight">{value}</dd>
      <dd className="mt-2 text-[12px] leading-relaxed text-ink-muted">{note}</dd>
    </div>
  );
}