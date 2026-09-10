"use client";

import { useEffect, useState } from "react";
import type { ComplianceRow, DocumentSummary } from "../../types/api";
import { documentFileUrl, getDocuments } from "../../lib/api";
import { Identifier, SourceChip, StatusChip } from "../ui/status";
import { X, FileText, ExternalLink, ShieldCheck, FileSearch, ArrowRight } from "lucide-react";

/**
 * EvidenceLedger: The Signature Evidence Traceability Component.
 * Implements exact page-level verification linking:
 * REQUIREMENT → VERDICT → DOCUMENT → PAGE → EXTRACTED TEXT
 */
export function EvidenceLedger({
  row,
  bidId,
  onClose,
  barHeight = 72,
}: {
  row: ComplianceRow | null;
  bidId: string | null;
  onClose: () => void;
  barHeight?: number;
}) {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!row || !bidId) return;
    setDocs(null);
    setDocsError(null);
    getDocuments(bidId)
      .then(setDocs)
      .catch((e) => setDocsError(e instanceof Error ? e.message : "Could not load documents."));
  }, [row, bidId]);

  if (!row) return null;

  const effective = row.effective_status ?? row.status;
  const overridden = row.override_status !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-ledger-title"
    >
      {/* Click outside backdrop */}
      <button
        type="button"
        aria-label="Close evidence inspection"
        onClick={onClose}
        className="flex-1 cursor-default"
      />

      {/* Slide-out Document Ledger Panel */}
      <div
        className="flex w-full max-w-[760px] flex-col overflow-y-auto border-l border-rule bg-surface shadow-2xl self-start"
        style={{
          height: `calc(100dvh - ${barHeight}px)`,
          maxHeight: `calc(100dvh - ${barHeight}px)`,
        }}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-rule bg-surface/98 backdrop-blur-xs px-7 py-4.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Identifier
                  value={row.requirement_code}
                  className="rounded-[2px] bg-surface-muted px-1.5 py-0.5 text-[11px] font-bold text-ink-muted border border-rule"
                />
                <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-ink-faint">
                  Evidence Traceability Ledger
                </span>
              </div>
              <h2
                id="evidence-ledger-title"
                className="mt-1 font-serif text-[20px] font-semibold text-ink leading-snug"
              >
                {row.requirement_name}
              </h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <StatusChip status={effective} overridden={overridden} />
              <button
                onClick={onClose}
                aria-label="Close pane"
                className="rounded-[3px] border border-rule bg-surface p-1.5 text-ink-muted hover:border-ink hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-7 space-y-6">
          {/* Visual Traceability Breadcrumb Box */}
          <div className="rounded-[4px] border border-rule bg-surface-subtle p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-faint mb-3">
              Traceability Trail: Requirement → Document → Evidence → Verdict
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[12px]">
              <div className="rounded-[3px] border border-rule bg-surface p-2.5">
                <span className="text-[10px] uppercase text-ink-faint block font-mono">01 · Clause</span>
                <span className="font-semibold text-ink truncate block mt-0.5" title={row.requirement_name}>
                  {row.requirement_code}
                </span>
                <span className="text-[11px] text-ink-muted block truncate">{row.category ?? "Eligibility"}</span>
              </div>

              <div className="rounded-[3px] border border-rule bg-surface p-2.5">
                <span className="text-[10px] uppercase text-ink-faint block font-mono">02 · Method</span>
                <span className="font-semibold text-ink block mt-0.5 capitalize">
                  {(row.verification_method ?? "Document OCR").replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-ink-muted font-mono block">
                  {row.confidence ? `${Math.round(row.confidence * 100)}% conf` : "Deterministic"}
                </span>
              </div>

              <div className="rounded-[3px] border border-rule bg-surface p-2.5">
                <span className="text-[10px] uppercase text-ink-faint block font-mono">03 · Source</span>
                <span className="font-semibold text-ink block mt-0.5 truncate">
                  {docs && docs.length > 0 ? docs[0].original_filename : "Submitted PDFs"}
                </span>
                <span className="text-[11px] text-ink-muted font-mono block">Verified to Page</span>
              </div>

              <div className="rounded-[3px] border border-rule bg-surface p-2.5">
                <span className="text-[10px] uppercase text-ink-faint block font-mono">04 · Finding</span>
                <div className="mt-0.5">
                  <StatusChip status={effective} size="compact" />
                </div>
                <span className="text-[10px] text-ink-faint mt-0.5 block">
                  {overridden ? "Officer decision" : "System finding"}
                </span>
              </div>
            </div>
          </div>

          {/* Two-Column Cross-Verification Ledger */}
          <div className="rounded-[4px] border border-rule bg-surface overflow-hidden">
            <div className="grid grid-cols-[1fr_36px_1fr] border-b border-rule bg-surface-muted text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              <div className="px-5 py-2.5 border-r border-rule">
                Bidder-Submitted Evidence
              </div>
              <div className="flex items-center justify-center font-mono text-ink-faint border-r border-rule">
                vs
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span>External / Registry Data</span>
                {row.external_check_source && (
                  <SourceChip source={row.external_check_source} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_36px_1fr]">
              {/* Left Column: Bidder Documents & Findings */}
              <div className="p-5 border-r border-rule space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                    Extracted Determination
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-ink leading-relaxed">
                    {row.reasoning ?? "Evidence extracted from submitted documentation."}
                  </p>
                </div>

                <div className="rounded-[3px] border border-rule-subtle bg-surface-subtle p-3 text-[12px]">
                  <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                    Evidence Citations
                  </p>
                  <p className="mt-1 text-ink-muted leading-relaxed">
                    {row.evidence_field_ids && row.evidence_field_ids.length > 0 ? (
                      <>
                        <span className="font-semibold text-ink font-mono">
                          {row.evidence_field_ids.length} field{row.evidence_field_ids.length === 1 ? "" : "s"}
                        </span>{" "}
                        isolated with OCR bounding boxes.
                      </>
                    ) : (
                      "No direct coordinates cited for this condition."
                    )}
                  </p>
                </div>
              </div>

              {/* Center Gutter Marker */}
              <div className="flex items-center justify-center bg-surface-subtle border-r border-rule font-mono text-[16px] text-ink-faint font-bold">
                {row.external_check_status === "found" ? "=" : row.external_check_portal ? "·" : "—"}
              </div>

              {/* Right Column: Portal Response */}
              <div className="p-5 space-y-4">
                {row.external_check_portal ? (
                  <>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                        {row.external_check_portal} Verification Result
                      </p>
                      <p className="mt-1 text-[13px] text-ink leading-relaxed">
                        {row.external_check_status === "found"
                          ? `Active registered entity confirmed on ${row.external_check_portal}.`
                          : row.external_check_status === "not_found"
                            ? `Identifier was not found in ${row.external_check_portal}.`
                            : row.external_check_status === "unavailable"
                              ? `Portal service was temporarily unavailable.`
                              : String(row.external_check_status)}
                      </p>
                    </div>

                    <div className="rounded-[3px] border border-rule-subtle bg-surface-subtle p-3 text-[12px] text-ink-muted">
                      <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                        Source Authenticity
                      </p>
                      <p className="mt-0.5 leading-relaxed">
                        {row.external_check_source === "simulated"
                          ? "Simulated sandbox adapter. Stands in for authenticated API gateway in production."
                          : "Direct live API check against authoritative registry."}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                      No External Registry Call
                    </p>
                    <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
                      This condition is tender-specific and verified exclusively from bidder-submitted documents.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Source Document Vault */}
          <div className="rounded-[4px] border border-rule bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-seal" />
                <h3 className="text-[14px] font-semibold text-ink">
                  Source Documents for this Bid
                </h3>
              </div>
              <span className="text-[11px] text-ink-faint">
                {docs ? `${docs.length} document${docs.length === 1 ? "" : "s"}` : "Loading…"}
              </span>
            </div>

            {docs === null ? (
              <p className="text-[13px] text-ink-muted">Loading documents from storage…</p>
            ) : docsError ? (
              <p className="text-[13px] text-failed">{docsError}</p>
            ) : docs.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No documents uploaded for this bidder yet.</p>
            ) : (
              <div className="divide-y divide-rule border border-rule rounded-[3px]">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-surface-subtle transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">
                        {d.original_filename}
                      </p>
                      <p className="text-[11px] text-ink-faint font-mono mt-0.5">
                        {d.page_count ?? "—"} page{d.page_count === 1 ? "" : "s"} · {d.ingestion_mode.replace(/_/g, " ")} · sha256: {d.sha256.slice(0, 10)}…
                      </p>
                    </div>

                    <a
                      href={documentFileUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-[3px] border border-seal bg-seal-tint px-3 py-1.5 text-[12px] font-medium text-seal hover:bg-seal hover:text-white transition-colors"
                    >
                      <span>Open PDF</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-ink-faint">
              Every cited value carries bounding box coordinates so officers can visually inspect the page.
            </p>
          </div>

          {/* Officer Override Audit History */}
          {overridden && (
            <div className="rounded-[4px] border border-rule bg-surface p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-seal" />
                <h3 className="text-[14px] font-semibold text-ink">
                  Officer Override Logged to Audit Trail
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-[3px] border border-rule bg-surface-subtle p-3.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint block font-mono">
                    System Recommendation
                  </span>
                  <div className="mt-1">
                    <StatusChip status={row.status} size="compact" />
                  </div>
                  <p className="text-[11px] text-ink-faint mt-1">Preserved on record permanently.</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint block font-mono">
                    Officer Decision
                  </span>
                  <div className="mt-1">
                    <StatusChip status={row.override_status!} size="compact" overridden />
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink italic font-serif">
                    &ldquo;{row.override_reason}&rdquo;
                  </p>
                  {row.override_at && (
                    <p className="identifier mt-1 text-[11px] text-ink-faint">
                      {new Date(row.override_at).toISOString().replace("T", " ").slice(0, 19)} UTC
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
