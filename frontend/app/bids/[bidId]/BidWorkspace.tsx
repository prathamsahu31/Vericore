"use client";

import { useEffect, useRef, useState } from "react";
import { ComplianceMatrix } from "@/components/analysis/ComplianceMatrix";
import { DecisionBar } from "@/components/analysis/DecisionBar";
import { EvidenceLedger } from "@/components/analysis/EvidenceLedger";
import { NeedsYou } from "@/components/landing/NeedsYou";
import { SeverityMark } from "@/components/ui/status";
import { Verdict } from "@/components/analysis/Verdict";
import type { ComplianceRow, VerificationSummary } from "@/types/api";
import { verifyBid } from "@/lib/api";
import { RefreshCw, AlertOctagon, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";

/**
 * BidWorkspace: The Primary Officer Operating Console.
 * Organizes the inspection sequence:
 * 1. Current Standing (Verdict & Score)
 * 2. Cross-Document Contradictions (Critical Flags)
 * 3. Officer Action Queue (What Needs You)
 * 4. Full Tender Checklist (Compliance Matrix)
 * 5. Evidence Ledger (Side Drawer)
 * 6. Sticky Human Decision Bar
 */
export function BidWorkspace({ initial }: { initial: VerificationSummary }) {
  const [summary, setSummary] = useState(initial);
  const [open, setOpen] = useState<ComplianceRow | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(72);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setBarHeight(Math.ceil(entry.contentRect.height));
    });
    obs.observe(el);
    setBarHeight(el.getBoundingClientRect().height || 72);
    return () => obs.disconnect();
  }, []);

  function refresh(next: VerificationSummary) {
    setSummary(next);
    setOpen((current) =>
      current
        ? (next.requirements.find((r) => r.requirement_code === current.requirement_code) ?? null)
        : null,
    );
  }

  async function handleReverify() {
    setVerifyError(null);
    setVerifying(true);
    try {
      const next = await verifyBid(summary.bid_id);
      setSummary(next);
      setOpen((current) =>
        current ? (next.requirements.find((r) => r.requirement_code === current.requirement_code) ?? null) : null,
      );
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Re-verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <main className="mx-auto max-w-[1240px] space-y-7 px-6 py-8">
        {/* Workspace Sub-Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4">
          <div className="flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-verified" />
            <span>
              Engine Run: <strong className="font-mono text-ink">{summary.run_status}</strong>
            </span>
            <span className="text-rule">·</span>
            <span>
              Arithmetic Score: <strong className="font-mono text-ink">{summary.compliance_score ?? "—"}</strong>
            </span>
            <span className="text-rule">·</span>
            <span>
              Risk Profile: <strong className="font-mono text-ink">{summary.risk_level ?? "LOW"}</strong>
            </span>
          </div>

          <button
            onClick={handleReverify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-rule bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-seal hover:text-seal disabled:opacity-50"
          >
            <RefreshCw size={14} className={verifying ? "animate-spin" : ""} />
            <span>{verifying ? "Running Engine Pipeline…" : "Re-run Verification"}</span>
          </button>
        </div>

        {verifyError && (
          <div className="rounded-[4px] border border-failed-border bg-failed-bg p-4 text-[13px] text-failed flex items-start gap-2">
            <AlertOctagon size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Verification Pipeline Error</p>
              <p className="mt-0.5">{verifyError}</p>
            </div>
          </div>
        )}

        {/* Section 1: Official Verdict & Metrics */}
        <Verdict summary={summary} />

        {/* Section 2: Contradictions Between Bidder's Own Documents */}
        {summary.cross_document_findings.length > 0 && (
          <section className="rounded-[4px] border border-failed-border bg-failed-bg/60 p-6">
            <div className="flex items-center gap-2.5">
              <AlertOctagon size={18} className="text-failed" />
              <h2 className="font-serif text-[17px] font-semibold text-failed">
                {summary.cross_document_findings.length} Cross-Document Contradiction
                {summary.cross_document_findings.length === 1 ? "" : "s"} Detected
              </h2>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
              Discrepancies identified across different documents submitted by this bidder (e.g. mismatched PAN between GST certificate and PAN card). These represent systemic integrity risks.
            </p>

            <ul className="mt-4 divide-y divide-failed-border/60 border border-failed-border/60 rounded-[3px] bg-surface">
              {summary.cross_document_findings.map((f) => (
                <li key={f.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <SeverityMark severity={f.severity} />
                    <span className="text-[11px] font-mono text-ink-faint">
                      Finding #{f.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink leading-relaxed">
                    {f.description}
                  </p>
                  {(f.value_a || f.value_b) && (
                    <div className="mt-2.5 flex items-center gap-3 rounded-[3px] bg-surface-muted p-2.5 text-[12px] font-mono border border-rule">
                      <span className="text-ink font-semibold">{f.value_a ?? "—"}</span>
                      <span className="text-failed font-bold">≠</span>
                      <span className="text-ink font-semibold">{f.value_b ?? "—"}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 3: Action Queue */}
        <NeedsYou summary={summary} onOpen={setOpen} />

        {/* Section 4: Full Checklist Table */}
        <ComplianceMatrix
          summary={summary}
          onSelect={setOpen}
          selectedCode={open?.requirement_code ?? null}
        />

        {/* Section 5: Risk Signals Log */}
        {summary.risk_flags.length > 0 && (
          <details className="rounded-[4px] border border-rule bg-surface overflow-hidden group">
            <summary className="cursor-pointer px-6 py-4 text-[14px] font-semibold text-ink flex items-center justify-between hover:bg-surface-subtle transition-colors">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-review" />
                <span>Deterministic Risk Signals</span>
                <span className="rounded-[2px] bg-review-bg text-review border border-review-border px-2 py-0.2 text-[11px] font-medium font-mono">
                  {summary.risk_flags.length} Flag{summary.risk_flags.length === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-[12px] text-ink-faint font-normal">
                Click to inspect counted risk signals
              </span>
            </summary>
            <div className="border-t border-rule divide-y divide-rule bg-surface-subtle">
              {summary.risk_flags.map((flag) => (
                <div key={flag.id} className="p-4 px-6">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityMark severity={flag.severity} />
                  </div>
                  <p className="text-[13px] text-ink-muted leading-relaxed">
                    {flag.description}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Legal Disclaimer & External Adapter Disclosure */}
        <div className="rounded-[3px] border border-rule-subtle bg-surface-subtle p-4 text-[12px] text-ink-faint leading-relaxed">
          <p>
            <strong>Statutory Disclosure:</strong> {summary.external_checks_simulated} external registry check
            {summary.external_checks_simulated === 1 ? " was" : "s were"} simulated in this evaluation run;{" "}
            {summary.external_checks_live} check{summary.external_checks_live === 1 ? "" : "s"} contacted active government registers.
            Every simulated check carries the permanent <span className="font-mono text-review font-semibold">SIMULATED</span> label across all screens, exports, and audit certificates.
          </p>
        </div>
      </main>

      {/* Slide-out Evidence Ledger */}
      <EvidenceLedger
        row={open}
        bidId={summary.bid_id}
        onClose={() => setOpen(null)}
        barHeight={barHeight}
      />

      {/* Sticky Officer Decision Bar */}
      <div ref={barRef}>
        <DecisionBar
          bidId={summary.bid_id}
          summary={summary}
          selected={open}
          onUpdated={refresh}
        />
      </div>
    </>
  );
}
