"use client";

import { useState } from "react";
import { ComplianceMatrix } from "../../components/ComplianceMatrix";
import { DecisionBar } from "../../components/DecisionBar";
import { EvidenceLedger } from "../../components/EvidenceLedger";
import { ScorePanel } from "../../components/ScorePanel";
import { SeverityMark } from "../../components/status";
import type { ComplianceRow, VerificationSummary } from "../../lib/types";

export function BidWorkspace({ initial }: { initial: VerificationSummary }) {
  const [summary, setSummary] = useState(initial);
  const [selected, setSelected] = useState<ComplianceRow | null>(null);

  // Keep the open condition in step with a refreshed summary after a review.
  function refresh(next: VerificationSummary) {
    setSummary(next);
    if (selected) {
      setSelected(
        next.requirements.find((r) => r.requirement_code === selected.requirement_code) ?? null,
      );
    }
  }

  return (
    <>
      <main className="mx-auto max-w-[1240px] space-y-6 px-6 py-6">
        <ScorePanel summary={summary} />

        {/* A contradiction is a flag on the submission as a whole, so it
            interrupts the officer's flow rather than hiding in one table row
            (CLAUDE.md §11). */}
        {summary.cross_document_findings.length > 0 && (
          <section
            className="rounded-[6px] border px-5 py-4"
            style={{ borderColor: "#9F123933", background: "#9F12390A" }}
          >
            <h2 className="text-[16px]" style={{ color: "var(--failed)" }}>
              {summary.cross_document_findings.length} contradiction
              {summary.cross_document_findings.length === 1 ? "" : "s"} between this
              bidder&rsquo;s own documents
            </h2>
            <ul className="mt-3 space-y-2">
              {summary.cross_document_findings.map((f) => (
                <li key={f.id} className="flex gap-3">
                  <SeverityMark severity={f.severity} />
                  <p className="text-[13px] leading-relaxed text-ink">{f.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <ComplianceMatrix
            summary={summary}
            onSelect={setSelected}
            selectedCode={selected?.requirement_code ?? null}
          />
          <div className="space-y-6">
            <EvidenceLedger row={selected} />

            {summary.risk_flags.length > 0 && (
              <section className="rounded-[6px] border border-rule bg-surface">
                <h2 className="border-b border-rule px-5 py-3 text-[16px]">
                  Risk signals
                </h2>
                <ul className="divide-y divide-rule">
                  {summary.risk_flags.map((flag) => (
                    <li key={flag.id} className="px-5 py-3">
                      <SeverityMark severity={flag.severity} />
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        {flag.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-[12px] leading-relaxed text-ink-faint">
              {summary.external_checks_simulated} government-register check
              {summary.external_checks_simulated === 1 ? " was" : "s were"} simulated in
              this run; {summary.external_checks_live} used live data. A simulated result
              is labelled wherever it appears, including in exports.
            </p>
          </div>
        </div>
      </main>

      <DecisionBar
        bidId={summary.bid_id}
        summary={summary}
        selected={selected}
        onUpdated={refresh}
      />
    </>
  );
}
