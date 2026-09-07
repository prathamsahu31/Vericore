"use client";

import { useState } from "react";
import { ComplianceMatrix } from "../../components/ComplianceMatrix";
import { DecisionBar } from "../../components/DecisionBar";
import { EvidenceLedger } from "../../components/EvidenceLedger";
import { NeedsYou } from "../../components/NeedsYou";
import { SeverityMark } from "../../components/status";
import { Verdict } from "../../components/Verdict";
import type { ComplianceRow, VerificationSummary } from "../../lib/types";
import { verifyBid } from "../../lib/api";

/**
 * The layout answers three questions in order, one screenful at a time:
 * where does this bid stand, what needs me, and what does the full checklist
 * say. Evidence opens over the top only when asked for, so it never competes
 * with the list.
 */
export function BidWorkspace({ initial }: { initial: VerificationSummary }) {
  const [summary, setSummary] = useState(initial);
  const [open, setOpen] = useState<ComplianceRow | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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
      <main className="mx-auto max-w-[1080px] space-y-8 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">
            {summary.run_status === "succeeded" ? "Last verification succeeded" : `Status: ${summary.run_status}`} · score{" "}
            {summary.compliance_score ?? "—"} · risk {summary.risk_level ?? "—"}
          </p>
          <button
            onClick={handleReverify}
            disabled={verifying}
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-[13px] font-medium text-seal transition-opacity hover:border-seal disabled:opacity-50"
          >
            {verifying ? "Re-verifying…" : "Re-verify this bidder"}
          </button>
        </div>
        {verifyError && (
          <p className="rounded-[4px] border px-4 py-3 text-[13px]" style={{ borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)", color: "var(--failed)" }}>
            {verifyError}
          </p>
        )}
        <p className="max-w-[80ch] text-[12px] leading-relaxed text-ink-faint">
          Added documents after the last run? Hit <span className="font-medium text-ink">Re-verify</span> — verdicts are a snapshot from the last run, not live.
        </p>
        <Verdict summary={summary} />

        {/* A contradiction is a flag on the submission as a whole, so it
            interrupts rather than hiding in one table row (CLAUDE.md §11). */}
        {summary.cross_document_findings.length > 0 && (
          <section
            className="rounded-[6px] border px-7 py-5"
            style={{
              borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)",
              background: "color-mix(in srgb, var(--failed) 8%, transparent)",
            }}
          >
            <h2 className="text-[18px]" style={{ color: "var(--failed)" }}>
              {summary.cross_document_findings.length} contradiction
              {summary.cross_document_findings.length === 1 ? "" : "s"} between this
              bidder&rsquo;s own documents
            </h2>
            <ul className="mt-4 space-y-3">
              {summary.cross_document_findings.map((f) => (
                <li key={f.id} className="flex flex-wrap gap-x-4 gap-y-1">
                  <SeverityMark severity={f.severity} />
                  <p className="max-w-[80ch] text-[14px] leading-relaxed text-ink">
                    {f.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <NeedsYou summary={summary} onOpen={setOpen} />

        <ComplianceMatrix
          summary={summary}
          onSelect={setOpen}
          selectedCode={open?.requirement_code ?? null}
        />

        {summary.risk_flags.length > 0 && (
          <details className="rounded-[6px] border border-rule bg-surface">
            <summary className="cursor-pointer px-7 py-4 text-[16px]">
              Risk signals
              <span className="ml-2 text-[13px] font-normal text-ink-muted">
                {summary.risk_flags.length} fired — counted separately from the score
              </span>
            </summary>
            <ul className="divide-y divide-rule border-t border-rule">
              {summary.risk_flags.map((flag) => (
                <li key={flag.id} className="px-7 py-4">
                  <SeverityMark severity={flag.severity} />
                  <p className="mt-1.5 max-w-[86ch] text-[14px] leading-relaxed text-ink-muted">
                    {flag.description}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="max-w-[86ch] pb-4 text-[13px] leading-relaxed text-ink-faint">
          {summary.external_checks_simulated} government-register check
          {summary.external_checks_simulated === 1 ? " was" : "s were"} simulated in this
          run; {summary.external_checks_live} used live data. A simulated result is
          labelled wherever it appears, including in exports.
        </p>
      </main>

      <EvidenceLedger row={open} bidId={summary.bid_id} onClose={() => setOpen(null)} />

      <DecisionBar
        bidId={summary.bid_id}
        summary={summary}
        selected={open}
        onUpdated={refresh}
      />
    </>
  );
}
