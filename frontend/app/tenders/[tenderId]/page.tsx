import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Identifier, RiskChip, StatusChip } from "@/components/ui/status";
import { getComparison, tenderReportPageUrl } from "@/lib/api";
import type { ComparisonBidder, ComparisonRow } from "@/types/api";
import { ArrowLeft, FileDown, CheckCircle2, AlertCircle, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Shortlisting & Cross-Bidder Comparison Matrix
 * Displays all bidders side-by-side across codified tender requirements.
 * Design Principle: Ordering preserves submission order; system never ranks bidders.
 */
export default async function ComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenderId: string }>;
  searchParams: Promise<{ only?: string }>;
}) {
  const { tenderId } = await params;
  const { only } = await searchParams;
  const differencesOnly = only === "differences";

  let data;
  try {
    data = await getComparison(tenderId);
  } catch {
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="mx-auto max-w-[640px] px-6 py-24">
          <div className="rounded-[4px] border border-rule bg-surface p-6">
            <h1 className="font-serif text-[20px] font-semibold text-ink">
              Tender Comparison Unavailable
            </h1>
            <p className="mt-2 text-[14px] text-ink-muted leading-relaxed">
              This tender could not be loaded. Ensure the backend API is active and this tender ID exists.
            </p>
            <div className="mt-4">
              <Link
                href="/tenders"
                className="text-[13px] font-medium text-seal hover:underline"
              >
                ← Return to tender registry
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const differing = data.requirements.filter((r) => r.differentiating).length;
  const rows = differencesOnly
    ? data.requirements.filter((r) => r.differentiating)
    : data.requirements;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      {/* Tender Header Banner */}
      <div className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 pt-5 pb-6">
          <div className="mb-3">
            <Link
              href="/tenders"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to tender registry</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-seal" />
                <p className="text-[11px] font-mono uppercase font-bold tracking-[0.14em] text-ink-faint">
                  Tender Evaluation Matrix
                </p>
              </div>
              <h1 className="mt-1 font-serif text-[24px] sm:text-[28px] font-semibold text-ink leading-tight">
                {data.tender_title}
              </h1>
              <p className="mt-1.5 text-[13px] text-ink-muted">
                {data.bidders.length} bidder{data.bidders.length === 1 ? "" : "s"} evaluated ·{" "}
                {data.requirements.length} conditions ·{" "}
                <span className="font-semibold text-ink font-mono">{differing}</span> condition(s) differentiating
                {data.bid_due_date && (
                  <>
                    {" · Bid Due Date: "}
                    <span className="identifier text-ink font-medium">{data.bid_due_date}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={tenderReportPageUrl(tenderId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-seal bg-seal-tint px-3.5 py-2 text-[13px] font-medium text-seal hover:bg-seal hover:text-white transition-colors"
              >
                <FileDown size={14} />
                <span>Export Official Audit Report</span>
              </a>

              <Link
                href={`/tenders/${tenderId}/bidders/new`}
                className="inline-flex items-center gap-1 rounded-[3px] bg-seal px-3.5 py-2 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors"
              >
                <span>+ Add Another Bidder</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Matrix Container */}
      <main className="mx-auto w-full max-w-[1280px] space-y-6 px-6 py-8">
        <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
          {/* View Filter Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule bg-surface-subtle px-6 py-3.5">
            <div>
              <p className="text-[14px] font-semibold text-ink">
                Bidder Compliance Comparison
              </p>
              <p className="text-[12px] text-ink-muted">
                Bidders appear in chronological submission order. The system never ranks or scores preference.
              </p>
            </div>

            <div className="flex items-center gap-1.5" role="group" aria-label="Matrix Filter">
              <Link
                href={`/tenders/${tenderId}`}
                className={`rounded-[3px] border px-3 py-1 text-[12px] font-medium transition-colors ${
                  !differencesOnly
                    ? "border-seal bg-seal text-white font-semibold"
                    : "border-rule bg-surface text-ink-muted hover:text-ink hover:border-ink-faint"
                }`}
              >
                All Conditions ({data.requirements.length})
              </Link>
              <Link
                href={`/tenders/${tenderId}?only=differences`}
                className={`rounded-[3px] border px-3 py-1 text-[12px] font-medium transition-colors ${
                  differencesOnly
                    ? "border-seal bg-seal text-white font-semibold"
                    : "border-rule bg-surface text-ink-muted hover:text-ink hover:border-ink-faint"
                }`}
              >
                Differentiating Only ({differing})
              </Link>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-surface-muted">
                  <th
                    scope="col"
                    className="w-[320px] min-w-[280px] px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint"
                  >
                    Codified Requirement
                  </th>
                  {data.bidders.map((b) => (
                    <th
                      key={b.bid_id}
                      scope="col"
                      className="min-w-[220px] border-l border-rule px-5 py-3.5 align-top"
                    >
                      <Link
                        href={`/bids/${b.bid_id}`}
                        className="text-[14px] font-serif font-semibold text-seal hover:underline block leading-tight"
                      >
                        {b.bidder_name}
                      </Link>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-ink-faint">
                          {b.verified ? "Pipeline Run Complete" : "Pending Verification"}
                        </span>
                        <span className="text-seal hover:underline">Inspect →</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-rule">
                {rows.map((row) => (
                  <tr
                    key={row.requirement_code}
                    className={`align-top hover:bg-surface-subtle transition-colors ${
                      row.differentiating ? "bg-review-bg/30" : ""
                    }`}
                  >
                    <th scope="row" className="px-6 py-3.5 font-normal text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Identifier
                          value={row.requirement_code}
                          className="rounded-[2px] bg-surface-muted px-1.5 py-0.5 text-[11px] font-bold text-ink-muted border border-rule"
                        />
                        {row.mandatory && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-failed">
                            Mandatory
                          </span>
                        )}
                        {row.differentiating && (
                          <span className="text-[10px] font-semibold text-review bg-review-bg border border-review-border px-1.5 py-0.2 rounded-[2px]">
                            Differs
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium text-ink leading-snug">
                        {row.requirement_name}
                      </p>
                    </th>

                    {row.cells.map((cell) => (
                      <td key={cell.bid_id} className="border-l border-rule px-5 py-3.5">
                        {cell.effective_status ? (
                          <Link
                            href={`/bids/${cell.bid_id}`}
                            className="group inline-flex flex-col items-start gap-1"
                          >
                            <StatusChip
                              status={cell.effective_status}
                              overridden={cell.overridden}
                              size="compact"
                            />
                            <span className="text-[10px] text-seal opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mt-0.5">
                              <span>View evidence</span>
                              <Eye size={10} />
                            </span>
                          </Link>
                        ) : (
                          <Link
                            href={`/bids/${cell.bid_id}`}
                            className="text-[12px] text-ink-faint hover:text-seal font-mono"
                          >
                            Unverified · Click to run
                          </Link>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* Bottom Summary Row */}
              <tfoot>
                <tr className="border-t-2 border-rule bg-surface-muted">
                  <th scope="row" className="px-6 py-5 text-left align-top font-normal">
                    <p className="text-[13px] font-semibold text-ink">Summary Evaluation</p>
                    <p className="mt-1 text-[11px] text-ink-faint leading-relaxed">
                      Score and risk measure separate vectors and are never conflated.
                    </p>
                  </th>
                  {data.bidders.map((b) => (
                    <td key={b.bid_id} className="border-l border-rule px-5 py-5 align-top">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                          Compliance Score
                        </span>
                        <div className="font-serif text-[24px] font-semibold text-ink leading-none mt-0.5">
                          {b.compliance_score ?? "—"} <span className="text-[12px] font-mono text-ink-faint">/ 100</span>
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <RiskChip level={b.risk_level} />
                      </div>

                      <div className="mt-3 text-[12px] font-medium">
                        {b.qualifiable ? (
                          <span className="text-verified flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            <span>Qualifiable</span>
                          </span>
                        ) : (
                          <span className="text-review flex items-center gap-1">
                            <AlertCircle size={13} />
                            <span>Pending Determination</span>
                          </span>
                        )}
                      </div>

                      {b.mandatory_failed.length > 0 && (
                        <p className="mt-1 text-[11px] text-failed font-mono">
                          {b.mandatory_failed.length} mandatory unmet
                        </p>
                      )}
                      {b.pending_review.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-review font-mono">
                          {b.pending_review.length} awaiting officer review
                        </p>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
