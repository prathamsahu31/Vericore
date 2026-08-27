import { Masthead } from "../../../components/Masthead";
import { Identifier, SeverityMark } from "../../../components/status";
import { getCompliance, getDocumentFields, getDocuments } from "../../../lib/api";
import type { ExtractedField } from "../../../lib/types";

export const dynamic = "force-dynamic";

/**
 * CLAUDE.md §11 screen 4 — findings and the evidence behind them.
 *
 * Cross-document findings get their own list here, deliberately away from the
 * requirement matrix: a mismatch between a bidder's PAN card and their GST
 * certificate is a flag on the submission as a whole, not on one row of a
 * table (§13).
 *
 * Below them sits every value the system read, with the page it came from and
 * whether it could be pinpointed there — the raw material behind every verdict
 * on the compliance screen.
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
    <div className="flex min-h-screen flex-col">
      <Masthead
        bidderName={summary.bidder_name}
        dueDate={summary.bid_due_date}
        active="findings"
        bidId={bidId}
      />

      <main className="mx-auto w-full max-w-[1080px] space-y-8 px-6 py-8">
        {/* Contradictions between the bidder's own documents. */}
        <section className="rounded-[6px] border border-rule bg-surface">
          <div className="border-b border-rule px-7 py-4">
            <h2 className="text-[20px]">Contradictions between documents</h2>
            <p className="mt-1 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
              The bidder&rsquo;s documents compared against each other — names, tax
              numbers, dates. These are concerns about the submission as a whole rather
              than about any single condition, which is why they are listed here and not
              buried in the checklist.
            </p>
          </div>
          {summary.cross_document_findings.length === 0 ? (
            <p className="px-7 py-6 text-[14px] text-ink-muted">
              <span style={{ color: "var(--verified)" }}>✓</span> No contradictions found.
              Every identifier and name that appears in more than one document agrees.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {summary.cross_document_findings.map((f) => (
                <li key={f.id} className="px-7 py-5">
                  <SeverityMark severity={f.severity} />
                  <p className="mt-1.5 max-w-[86ch] text-[14px] leading-relaxed">
                    {f.description}
                  </p>
                  {(f.value_a || f.value_b) && (
                    <div className="mt-3 grid max-w-[70ch] grid-cols-[1fr_36px_1fr] items-center gap-y-1 rounded-[4px] border border-rule bg-paper px-4 py-3">
                      <Identifier value={f.value_a} className="text-[13px]" />
                      <span className="text-center text-ink-faint" aria-hidden>≠</span>
                      <Identifier value={f.value_b} className="text-[13px]" />
                    </div>
                  )}
                  {f.similarity_score !== null && (
                    <p className="mt-2 text-[12px] text-ink-faint">
                      Similarity after normalisation: {Math.round(f.similarity_score * 100)}%
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Risk signals — a different question from compliance (§10). */}
        <section className="rounded-[6px] border border-rule bg-surface">
          <div className="border-b border-rule px-7 py-4">
            <h2 className="text-[20px]">Risk signals</h2>
            <p className="mt-1 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
              A different question from whether the conditions are met: how likely is this
              bidder to be misrepresenting itself? Counted separately, and never folded
              into the score.
            </p>
          </div>
          {summary.risk_flags.length === 0 ? (
            <p className="px-7 py-6 text-[14px] text-ink-muted">No signals fired.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {summary.risk_flags.map((flag) => (
                <li key={flag.id} className="px-7 py-5">
                  <SeverityMark severity={flag.severity} />
                  <p className="mt-1.5 max-w-[86ch] text-[14px] leading-relaxed text-ink-muted">
                    {flag.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Everything the system read, and where from. */}
        <section className="rounded-[6px] border border-rule bg-surface">
          <div className="border-b border-rule px-7 py-4">
            <h2 className="text-[20px]">Everything read from the documents</h2>
            <p className="mt-1 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
              {totalFields} values across {documents.length} documents.{" "}
              {unlocated === 0
                ? "Every one was pinpointed on its page."
                : `${unlocated} could not be pinpointed on the page and are marked below; none of those can produce an automatic pass.`}
            </p>
          </div>

          <div className="divide-y divide-rule">
            {fieldsByDocument.map(({ doc, fields }) => (
              <div key={doc.id} className="px-7 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-[15px] font-medium">{doc.original_filename}</h3>
                  <p className="text-[12px] text-ink-faint">
                    {doc.page_count} page{doc.page_count === 1 ? "" : "s"} · sha256{" "}
                    <Identifier value={doc.sha256.slice(0, 16) + "…"} />
                  </p>
                </div>

                {fields.length === 0 ? (
                  <p className="mt-2 text-[13px] text-ink-faint">
                    Nothing was read from this document.
                  </p>
                ) : (
                  <table className="mt-3 w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-rule text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                        <th scope="col" className="w-[200px] py-2 font-medium">Field</th>
                        <th scope="col" className="py-2 font-medium">Value read</th>
                        <th scope="col" className="w-[64px] py-2 font-medium">Page</th>
                        <th scope="col" className="w-[150px] py-2 font-medium">Located</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => (
                        <tr key={f.id} className="border-b border-rule last:border-0">
                          <td className="py-2.5 pr-4 text-[13px] text-ink-muted">
                            {f.field_name.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Identifier value={truncate(f.field_value)} className="text-[13px]" />
                          </td>
                          <td className="identifier py-2.5 text-[13px] text-ink-muted">
                            {f.page}
                          </td>
                          <td className="py-2.5 text-[12px]">
                            <LocatorMark status={f.locator_status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function truncate(value: string | null): string | null {
  if (!value) return null;
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > 72 ? flat.slice(0, 72) + "…" : flat;
}

/** Says whether the stored box is a genuine highlight or merely a page (§24). */
function LocatorMark({ status }: { status: string }) {
  const located = status !== "page_fallback" && status !== "segment_fallback";
  return (
    <span style={{ color: located ? "var(--verified)" : "var(--review)" }}>
      <span aria-hidden>{located ? "✓" : "○"}</span>{" "}
      {located ? "on the page" : "page only"}
    </span>
  );
}
