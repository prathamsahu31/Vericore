import Link from "next/link";
import { SiteHeader } from "./SiteHeader";

/**
 * Institutional rather than consumer: a ruled header, no logo lockup, the
 * tender's own particulars stated plainly.
 */
export function Masthead({
  bidderName,
  bidNumber,
  dueDate,
  active,
  bidId,
}: {
  bidderName: string;
  bidNumber?: string | null;
  dueDate?: string | null;
  active: "compliance" | "findings" | "audit";
  bidId: string;
}) {
  const tabs = [
    { key: "compliance", label: "Compliance", href: `/bids/${bidId}` },
    { key: "findings", label: "Findings & evidence", href: `/bids/${bidId}/findings` },
    { key: "audit", label: "Audit trail", href: `/bids/${bidId}/audit` },
  ] as const;

  return (
    <header className="border-b border-rule bg-surface/80 backdrop-blur-sm">
      <SiteHeader />

      <div className="mx-auto max-w-[1240px] px-6 pt-6 pb-1">
        <div className="flex items-baseline justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Bid evaluation
            </p>
            <h1 className="mt-1 font-serif text-[24px] leading-tight">{bidderName}</h1>
          </div>
          <dl className="flex shrink-0 gap-8 text-right">
            {bidNumber && (
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">Bid number</dt>
                <dd className="identifier mt-0.5 text-[13px] text-ink-muted">{bidNumber}</dd>
              </div>
            )}
            {dueDate && (
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">Bid due</dt>
                <dd className="identifier mt-0.5 text-[13px] text-ink-muted">{dueDate}</dd>
              </div>
            )}
          </dl>
        </div>

        <nav className="mt-4 flex gap-1 border-b border-rule" aria-label="Sections">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active === tab.key ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] transition-colors ${
                active === tab.key
                  ? "border-seal bg-seal-tint/60 font-medium text-seal"
                  : "border-transparent text-ink-muted hover:bg-paper hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}