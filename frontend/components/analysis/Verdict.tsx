import type { VerificationSummary } from "../../types/api";

/**
 * System Verdict & Standings Panel
 * High-authority summary of machine assessment vs officer responsibility.
 * Principles:
 * - "The officer decides. The system never does."
 * - Arithmetic score, not model output.
 */
export function Verdict({ summary }: { summary: VerificationSummary }) {
  const failed = summary.mandatory_failed.length;
  const pending = summary.pending_review.length;

  const tone = failed > 0 ? "failed" : pending > 0 ? "review" : "verified";
  
  const borderTone =
    tone === "failed" ? "#C53030" : tone === "review" ? "#B7791F" : "#16803C";
  const bgTone =
    tone === "failed" ? "#FEF2F2" : tone === "review" ? "#FEFCE8" : "#F0FDF4";

  const headline =
    failed > 0
      ? `${failed} Mandatory Condition${failed === 1 ? "" : "s"} Unmet`
      : pending > 0
        ? `${pending} Item${pending === 1 ? "" : "s"} Pending Human Review`
        : "All Mandatory Conditions Met";

  const detail =
    failed > 0
      ? `${failed} mandatory clause${failed === 1 ? " was" : "s were"} checked and failed to meet tender thresholds. An officer override requires written justification recorded in the immutable audit log.`
      : pending > 0
        ? "Deterministic rules satisfied. Outstanding items require subjective procurement judgment or document shortfall requests."
        : "Deterministic rules and statutory checks satisfied. The bid is ready for the officer's final statutory decision.";

  const score = summary.compliance_score ?? "—";
  const conditionsMet = summary.status_counts.COMPLIANT ?? 0;
  const conditionsTotal = summary.requirements.length;
  const riskLevel = summary.risk_level ?? "LOW";

  return (
    <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
      {/* Top Banner with semantic tone indicator */}
      <div
        className="border-b border-rule px-7 py-5 flex flex-wrap items-start justify-between gap-4"
        style={{ borderLeft: `4px solid ${borderTone}` }}
      >
        <div className="max-w-[760px]">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: borderTone }}
            />
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-faint">
              System Verification Assessment · Advisory Only
            </p>
          </div>
          <h2
            className="mt-1.5 font-serif text-[22px] font-semibold tracking-tight"
            style={{ color: borderTone }}
          >
            {headline}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
            {detail}
          </p>
        </div>

        <div className="rounded-[3px] border border-rule bg-surface-muted px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Legal Safeguard</p>
          <p className="text-[12px] font-medium text-ink mt-0.5">The officer decides</p>
          <p className="text-[10px] text-ink-faint">System never auto-qualifies</p>
        </div>
      </div>

      {/* Grid of Key Numerical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-rule bg-surface">
        <div className="px-7 py-4.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint font-medium">
            Compliance Score
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-serif text-[28px] font-semibold text-ink leading-none">
              {score}
            </span>
            <span className="text-[12px] text-ink-faint font-mono">/ 100</span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted leading-tight">
            Transparent weighted sum of tender clauses; deterministic calculation.
          </p>
        </div>

        <div className="px-7 py-4.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint font-medium">
            Requirements Verified
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-serif text-[28px] font-semibold text-ink leading-none">
              {conditionsMet}
            </span>
            <span className="text-[12px] text-ink-faint font-mono">of {conditionsTotal}</span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted leading-tight">
            {conditionsTotal - conditionsMet === 0
              ? "100% of conditions satisfied."
              : `${conditionsTotal - conditionsMet} condition(s) unresolved or non-compliant.`}
          </p>
        </div>

        <div className="px-7 py-4.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint font-medium">
            Risk Assessment
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className="font-serif text-[28px] font-semibold leading-none"
              style={{
                color:
                  riskLevel === "CRITICAL"
                    ? "#C53030"
                    : riskLevel === "HIGH" || riskLevel === "MEDIUM"
                      ? "#B7791F"
                      : "#16803C",
              }}
            >
              {riskLevel}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted leading-tight">
            {summary.risk_flags.length === 0
              ? "Zero anomaly signals triggered."
              : `${summary.risk_flags.length} signal(s) evaluated independently of score.`}
          </p>
        </div>
      </div>
    </section>
  );
}