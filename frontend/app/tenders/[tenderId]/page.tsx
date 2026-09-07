import Link from "next/link";
import { SiteHeader } from "../../components/SiteHeader";
import { Identifier, RiskChip, StatusChip } from "../../components/status";
import { getComparison, tenderReportPageUrl } from "../../lib/api";
import type { ComparisonBidder, ComparisonRow } from "../../lib/types";
import { VerifyAllButton } from "./VerifyAllButton";

export const dynamic = "force-dynamic";

/**
 * Bidders side by side, conditions as rows — the shortlisting view
 * (architecture.md §9.4).
 *
 * Deliberately not a ranking. The bidders appear in the order they bid, and
 * nothing here sorts by score: ordering them would be the system expressing a
 * preference between bidders, and it does not have one. What it does offer is
 * the ability to hide the conditions on which everyone lands in the same
 * place, because those are not what a shortlisting decision turns on.
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
      <main className="mx-auto max-w-[62ch] px-6 py-24">
        <h1 className="text-[24px]">This tender could not be loaded</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          The backend may not be running, or this tender may not exist.
        </p>
      </main>
    );
  }

  const differing = data.requirements.filter((r) => r.differentiating).length;
  const rows = differencesOnly
    ? data.requirements.filter((r) => r.differentiating)
    : data.requirements;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-surface/80 backdrop-blur-sm">
        <SiteHeader />
        <div className="mx-auto max-w-[1240px] px-6 py-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Comparing bidders
          </p>
          <h1 className="mt-1 font-serif text-[26px] leading-tight">{data.tender_title}</h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            {data.bidders.length} bidders · {data.requirements.length} conditions ·{" "}
            <strong className="font-medium text-ink">{differing}</strong> where they
            differ
            {data.bid_due_date && (
              <>
                {" · bid due "}
                <span className="identifier">{data.bid_due_date}</span>
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <VerifyAllButton tenderId={tenderId} />
            <a
              href={tenderReportPageUrl(tenderId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[4px] border border-rule bg-surface px-4 py-2 text-[13px] font-medium text-seal transition-colors hover:border-seal hover:bg-seal-tint"
            >
              Export report
            </a>
          </div>
          <p className="mt-3 max-w-[72ch] text-[12px] leading-relaxed text-ink-muted">
            Verification is a snapshot — if you added documents after the last run, hit{" "}
            <span className="font-medium text-ink">Verify all bidders</span> to re-evaluate.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] space-y-6 px-6 py-8">
        <section className="overflow-hidden rounded-[6px] border border-rule bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule px-7 py-4">
            <div>
              <h2 className="text-[20px]">Where the bidders stand</h2>
              <p className="mt-1 max-w-[74ch] text-[13px] leading-relaxed text-ink-muted">
                In the order they bid. Nothing here ranks them — the decision on any
                one bidder is yours, and so is the comparison between them.
              </p>
            </div>
            <div className="flex gap-1">
              <Tab href={`/tenders/${tenderId}`} active={!differencesOnly}>
                All conditions
              </Tab>
              <Tab
                href={`/tenders/${tenderId}?only=differences`}
                active={differencesOnly}
              >
                Only where they differ
              </Tab>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Each condition in the tender and how every bidder stands on it.
              </caption>
              <thead>
                <tr className="border-b border-rule">
                  <th
                    scope="col"
                    className="w-[300px] px-7 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint"
                  >
                    Condition
                  </th>
                  {data.bidders.map((b) => (
                    <th
                      key={b.bid_id}
                      scope="col"
                      className="min-w-[200px] border-l border-rule px-5 py-3 align-bottom"
                    >
                      <Link
                        href={`/bids/${b.bid_id}`}
                        className="text-[14px] font-medium text-seal hover:underline"
                      >
                        {b.bidder_name}
                      </Link>
                      <p className="mt-1 text-[12px] font-normal text-ink-faint">
                        {b.verified ? "verified" : "not verified yet"}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Row key={row.requirement_code} row={row} />
                ))}
              </tbody>
              <tfoot>
                <Summary bidders={data.bidders} />
              </tfoot>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-[4px] border px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? "border-seal bg-seal-tint font-medium text-seal"
          : "border-rule text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Row({ row }: { row: ComparisonRow }) {
  return (
    <tr
      className={`border-b border-rule align-top last:border-0 ${
        row.differentiating ? "bg-paper" : ""
      }`}
    >
      <th scope="row" className="px-7 py-4 text-left font-normal">
        <Identifier value={row.requirement_code} className="text-[12px] text-ink-faint" />
        <p className="mt-0.5 text-[14px] leading-snug">{row.requirement_name}</p>
        <p className="mt-1 text-[11px] text-ink-faint">
          {row.mandatory ? "Mandatory" : "Not mandatory"}
          {row.differentiating && (
            <span className="ml-2 text-ink-muted">· bidders differ here</span>
          )}
        </p>
      </th>
      {row.cells.map((cell) => (
        <td key={cell.bid_id} className="border-l border-rule px-5 py-4">
          {cell.effective_status ? (
            <Link
              href={`/bids/${cell.bid_id}`}
              title={`Open ${row.requirement_code} for this bidder — see why it needs you and the cited evidence`}
              className="group block rounded-[4px] border border-transparent p-1 -m-1 transition-colors hover:border-seal hover:bg-seal-tint focus:outline-none focus:border-seal"
            >
              <StatusChip status={cell.effective_status} overridden={cell.overridden} />
              <span className="mt-1.5 block text-[11px] font-medium text-seal opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                View evidence →
              </span>
            </Link>
          ) : (
            <span className="text-[13px] text-ink-faint">not verified</span>
          )}
        </td>
      ))}
    </tr>
  );
}

function Summary({ bidders }: { bidders: ComparisonBidder[] }) {
  return (
    <tr className="border-t-2 border-rule bg-surface">
      <th scope="row" className="px-7 py-5 text-left align-top font-normal">
        <p className="text-[13px] font-medium">Where each bid stands</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
          Score and risk answer different questions and are not combined.
        </p>
      </th>
      {bidders.map((b) => (
        <td key={b.bid_id} className="border-l border-rule px-5 py-5 align-top">
          <p className="font-serif text-[24px] leading-none">
            {b.compliance_score ?? "—"}
          </p>
          <p className="mt-2">
            <RiskChip level={b.risk_level} />
          </p>
          <p
            className="mt-3 text-[13px]"
            style={{
              color: b.qualifiable ? "var(--verified)" : "var(--ink-muted)",
            }}
          >
            {b.qualifiable ? "✓ Can be qualified" : "Not yet qualifiable"}
          </p>
          {b.mandatory_failed.length > 0 && (
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--failed)" }}>
              {b.mandatory_failed.length} mandatory not met
            </p>
          )}
          {b.pending_review.length > 0 && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--review)" }}>
              {b.pending_review.length} awaiting you
            </p>
          )}
        </td>
      ))}
    </tr>
  );
}
