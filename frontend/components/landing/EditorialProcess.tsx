"use client";

import { FileText, CheckCircle2, ShieldCheck, ArrowRight, Lock } from "lucide-react";

export function EditorialProcess() {
  return (
    <section className="border-t border-rule py-16">
      <div className="max-w-[1080px] mx-auto">
        {/* Section Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-seal" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-seal">
              Workflow Architecture
            </span>
          </div>
          <h2 className="mt-2 font-serif text-[28px] font-semibold text-ink sm:text-[32px]">
            From free-text tender notice to evidence-backed decision
          </h2>
          <p className="mt-2 max-w-[65ch] text-[15px] text-ink-muted leading-relaxed">
            Vericore replaces subjective reading with verifiable citations. The system extracts and matches; the statutory officer retains sole decision authority.
          </p>
        </div>

        {/* 3-Stage Editorial Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Stage 01 */}
          <div className="flex flex-col justify-between rounded-[4px] border border-rule bg-surface p-6 panel-shadow">
            <div>
              <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
                <span className="font-mono text-[18px] font-bold text-seal">01</span>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-faint rounded-[2px] bg-surface-muted px-2 py-0.5 border border-rule">
                  NIT Extraction
                </span>
              </div>
              <h3 className="font-serif text-[18px] font-semibold text-ink">
                Upload & Confirm the NIT
              </h3>
              <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">
                Vericore parses 60+ page NIT and RFP documents, extracting clause-by-clause eligibility conditions into a structured checklist with human confirmation locks.
              </p>
            </div>

            {/* Stage 01 Authentic Interface Artifact */}
            <div className="mt-6 rounded-[3px] border border-rule bg-surface-subtle p-3 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-ink-faint pb-1 border-b border-rule">
                <span>CHECKLIST LOCK</span>
                <span className="text-verified font-semibold inline-flex items-center gap-1">
                  <Lock size={10} /> Confirmed
                </span>
              </div>
              <div className="flex items-center justify-between bg-surface p-1.5 rounded-[2px] border border-rule-subtle text-ink">
                <span className="truncate">REQ-01 · Turnover ≥ ₹10 Cr</span>
                <span className="text-verified">✓</span>
              </div>
              <div className="flex items-center justify-between bg-surface p-1.5 rounded-[2px] border border-rule-subtle text-ink">
                <span className="truncate">REQ-02 · GSTIN State Code</span>
                <span className="text-verified">✓</span>
              </div>
              <div className="flex items-center justify-between bg-surface p-1.5 rounded-[2px] border border-rule-subtle text-ink">
                <span className="truncate">REQ-03 · Similar Work Order</span>
                <span className="text-review">◆</span>
              </div>
            </div>
          </div>

          {/* Stage 02 */}
          <div className="flex flex-col justify-between rounded-[4px] border border-rule bg-surface p-6 panel-shadow">
            <div>
              <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
                <span className="font-mono text-[18px] font-bold text-seal">02</span>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-faint rounded-[2px] bg-surface-muted px-2 py-0.5 border border-rule">
                  Document Intelligence
                </span>
              </div>
              <h3 className="font-serif text-[18px] font-semibold text-ink">
                Analyze Bidder Documents
              </h3>
              <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">
                Isolates logical files, extracts values with OCR bounding boxes, checks government registers, and detects cross-document contradictions between bidder files.
              </p>
            </div>

            {/* Stage 02 Authentic Interface Artifact */}
            <div className="mt-6 rounded-[3px] border border-rule bg-surface-subtle p-3 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-ink-faint pb-1 border-b border-rule">
                <span>CROSS-DOC VERIFICATION</span>
                <span className="text-seal font-semibold">Matched</span>
              </div>
              <div className="bg-surface p-2 rounded-[2px] border border-rule-subtle space-y-1">
                <div className="flex justify-between text-[10px] text-ink-faint">
                  <span>PAN Card (p.1)</span>
                  <span className="text-ink font-semibold">AAACL1234F</span>
                </div>
                <div className="flex justify-between text-[10px] text-ink-faint">
                  <span>GSTIN Cert (p.1)</span>
                  <span className="text-ink font-semibold">07AAACL1234F1Z5</span>
                </div>
                <div className="pt-1 border-t border-rule-subtle text-[10px] text-verified flex items-center justify-between font-sans">
                  <span>Identifier Alignment:</span>
                  <span className="font-mono font-bold">100% Match</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stage 03 */}
          <div className="flex flex-col justify-between rounded-[4px] border border-rule bg-surface p-6 panel-shadow">
            <div>
              <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
                <span className="font-mono text-[18px] font-bold text-seal">03</span>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-faint rounded-[2px] bg-surface-muted px-2 py-0.5 border border-rule">
                  Statutory Adjudication
                </span>
              </div>
              <h3 className="font-serif text-[18px] font-semibold text-ink">
                Decide on the Evidence
              </h3>
              <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">
                The officer inspects evidence down to the exact page and coordinates. Overrides require mandatory reasoning, permanently committed to the hash-chained audit log.
              </p>
            </div>

            {/* Stage 03 Authentic Interface Artifact */}
            <div className="mt-6 rounded-[3px] border border-rule bg-surface-subtle p-3 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-ink-faint pb-1 border-b border-rule">
                <span>OFFICER DECISION LOG</span>
                <span className="text-seal font-semibold">SHA-256 Sealed</span>
              </div>
              <div className="bg-surface p-2 rounded-[2px] border border-rule-subtle space-y-1 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink">Action: Overrule Accepted</span>
                  <span className="text-[9px] font-mono text-ink-faint">14:32:08 UTC</span>
                </div>
                <p className="text-[10px] text-ink-muted italic">
                  &ldquo;MSME relaxation certificate verified on Page 3.&rdquo;
                </p>
                <p className="text-[9px] font-mono text-ink-faint truncate pt-0.5">
                  prev_hash: a3f7… · row_hash: c9e2…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
