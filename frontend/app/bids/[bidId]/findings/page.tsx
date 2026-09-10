import { Masthead } from "@/components/layout/Masthead";
import { Identifier, SeverityMark } from "@/components/ui/status";
import { getCompliance, getDocumentFields, getDocuments } from "@/lib/api";
import type { ExtractedField } from "@/types/api";
import { AlertOctagon, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Findings & Extracted Raw Evidence Inspection
 * Displays:
 * 1. Cross-document contradictions (PAN vs GSTIN vs Incorporation)
 * 2. Deterministic counted risk signals
 * 3. Every value read from documents with bounding box locator accuracy
 */
export default async function FindingsPage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  const { bidId } = await params;
  const [summary, documents] = await Promise.all([
    getCompliance(bidId),
    getDocuments(bidId),
  ]);

  const fieldsByDocument = await Promise.all(
    documents.map(async (doc) => ({
      doc,
      fields: await getDocumentFields(doc.id).catch(() => [] as ExtractedField[]),
    })),
  );
  const totalFields = fieldsByDocument.reduce((n, d) => n + d.fields.length, 0);
  const unlocated = fieldsByDocument.reduce(
    (n, d) =>
      n +
      d.fields.filter(
        (f) => f.locator_status === "page_fallback" || f.locator_status === "segment_fallback",
      ).length,
    0,
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <Masthead
        bidderName={summary.bidder_name}
        dueDate={summary.bid_due_date}
        active="findings"
        bidId={bidId}
      />

      <main className="mx-auto w-full max-w-[1240px] space-y-8 px-6 py-8">
        {/* Section 1: Contradictions Between Bidder's Own Documents */}
        <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
          <div className="border-b border-rule px-7 py-4.5 bg-surface-subtle">
            <div className="flex items-center gap-2">
              <AlertOctagon size={18} className={summary.cross_document_findings.length > 0 ? "text-failed" : "text-verified"} />
              <h2 className="font-serif text-[18px] font-semibold text-ink">
                Cross-Document Contradiction Analysis
              </h2>
            </div>
            <p className="mt-1 max-w-[84ch] text-[13px] leading-relaxed text-ink-muted">
              Identifies contradictions between documents submitted within the same bid bundle (e.g. entity name differences, differing PAN embedded inside GSTIN vs PAN card).
            </p>
          </div>

          {summary.cross_document_findings.length === 0 ? (
            <div className="px-7 py-6 text-[14px] text-ink flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-verified" />
              <span>
                <strong>No cross-document contradictions detected.</strong> All names, tax identifiers, and registration dates agree across submitted files.
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {summary.cross_document_findings.map((f) => (
                <li key={f.id} className="px-7 py-5">
                  <div className="flex items-center gap-2 mb-2">
                    <SeverityMark severity={f.severity} />
                    <span className="font-mono text-[11px] text-ink-faint">
                      Contradiction #{f.id.slice(0, 8)}
                    </span>
                  </div>

                  <p className="text-[14px] font-medium text-ink leading-relaxed">
                    {f.description}
                  </p>

                  {(f.value_a || f.value_b) && (
                    <div className="mt-3 grid max-w-[720px] grid-cols-[1fr_40px_1fr] items-center rounded-[3px] border border-rule bg-surface-muted p-3 font-mono text-[12px]">
                      <div>
                        <span className="text-[10px] uppercase text-ink-faint block">Document A Value</span>
                        <Identifier value={f.value_a} className="font-semibold text-ink" />
                      </div>
                      <span className="text-center text-failed font-bold" aria-hidden="true">≠</span>
                      <div>
                        <span className="text-[10px] uppercase text-ink-faint block">Document B Value</span>
                        <Identifier value={f.value_b} className="font-semibold text-ink" />
                      </div>
                    </div>
                  )}

                  {f.similarity_score !== null && (
                    <p className="mt-2 text-[11px] font-mono text-ink-faint">
                      Levenshtein Similarity after normalization: {Math.round(f.similarity_score * 100)}%
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 2: Counted Risk Signals */}
        <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
          <div className="border-b border-rule px-7 py-4.5 bg-surface-subtle">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-review" />
              <h2 className="font-serif text-[18px] font-semibold text-ink">
                Deterministic Risk Signals
              </h2>
            </div>
            <p className="mt-1 max-w-[84ch] text-[13px] leading-relaxed text-ink-muted">
              Signals that indicate misrepresentation risk. These are counted separately from the arithmetic compliance score and never blended.
            </p>
          </div>

          {summary.risk_flags.length === 0 ? (
            <div className="px-7 py-6 text-[14px] text-ink-muted flex items-center gap-2">
              <CheckCircle2 size={16} className="text-verified" />
              <span>No anomaly or risk signals triggered for this bidder.</span>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {summary.risk_flags.map((flag) => (
                <li key={flag.id} className="px-7 py-4.5">
                  <SeverityMark severity={flag.severity} />
                  <p className="mt-1.5 text-[13px] text-ink-muted leading-relaxed">
                    {flag.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 3: Raw Fields Extracted with Bounding Boxes */}
        <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
          <div className="border-b border-rule px-7 py-4.5 bg-surface-subtle flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-seal" />
                <h2 className="font-serif text-[18px] font-semibold text-ink">
                  OCR Extracted Fields & Locator Ladder
                </h2>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                {totalFields} extracted values across {documents.length} submitted documents.{" "}
                {unlocated === 0 ? (
                  <span className="text-verified font-medium">All pinpointed with exact coordinates.</span>
                ) : (
                  <span className="text-review font-medium">{unlocated} resolved via fallback.</span>
                )}
              </p>
            </div>

            <span className="text-[11px] font-mono text-ink-faint rounded-[2px] bg-surface border border-rule px-2 py-1">
              Locator Ladder: exact_quote → normalized → fuzzy → page_fallback
            </span>
          </div>

          <div className="divide-y divide-rule">
            {fieldsByDocument.map(({ doc, fields }) => (
              <div key={doc.id} className="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule-subtle pb-3 mb-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">
                      {doc.original_filename}
                    </h3>
                    <p className="text-[11px] font-mono text-ink-faint mt-0.5">
                      {doc.page_count} page{doc.page_count === 1 ? "" : "s"} · {doc.ingestion_mode} · sha256:{" "}
                      <Identifier value={doc.sha256} className="text-[11px]" />
                    </p>
                  </div>
                  <span className="rounded-[2px] bg-surface-muted px-2 py-0.5 text-[11px] font-mono text-ink-muted border border-rule">
                    {fields.length} isolated field{fields.length === 1 ? "" : "s"}
                  </span>
                </div>

                {fields.length === 0 ? (
                  <p className="text-[12px] text-ink-faint italic">
                    No structured fields isolated from this document.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px] border-collapse">
                      <thead>
                        <tr className="border-b border-rule-subtle text-[10px] font-bold uppercase tracking-wider font-mono text-ink-faint">
                          <th className="py-2 px-3">Field Key</th>
                          <th className="py-2 px-3">Page</th>
                          <th className="py-2 px-3">Extracted Value</th>
                          <th className="py-2 px-3">Locator Status</th>
                          <th className="py-2 px-3">Bounding Box (x0, y0, x1, y1)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule-subtle font-mono">
                        {fields.map((f) => (
                          <tr key={f.id} className="hover:bg-surface-subtle">
                            <td className="py-2 px-3 font-semibold text-ink">{f.field_name}</td>
                            <td className="py-2 px-3 text-ink-muted">Page {f.page}</td>
                            <td className="py-2 px-3 text-ink truncate max-w-[280px]" title={f.field_value ?? undefined}>
                              {f.field_value ?? "—"}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`rounded-[2px] px-1.5 py-0.2 text-[10px] font-semibold uppercase ${
                                  f.locator_status === "exact_quote"
                                    ? "bg-verified-bg text-verified border border-verified-border"
                                    : "bg-review-bg text-review border border-review-border"
                                }`}
                              >
                                {f.locator_status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-ink-faint text-[11px]">
                              [{Math.round(f.x0)}, {Math.round(f.y0)}, {Math.round(f.x1)}, {Math.round(f.y1)}]
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
