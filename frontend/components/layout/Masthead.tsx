import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { ArrowLeft } from "lucide-react";

/**
 * Masthead: Institutional context header for bid-level evaluation.
 * Clean, authoritative layout presenting bidder metadata and sections.
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
    { key: "compliance", label: "Compliance Checklist", href: `/bids/${bidId}` },
    { key: "findings", label: "Cross-Doc Findings & Evidence", href: `/bids/${bidId}/findings` },
    { key: "audit", label: "Cryptographic Audit Trail", href: `/bids/${bidId}/audit` },
  ] as const;

  return (
    <div className="border-b border-rule bg-surface">
      <SiteHeader />

      <div className="mx-auto max-w-[1240px] px-6 pt-5 pb-0">
        {/* Breadcrumb / Back */}
        <div className="flex items-center gap-2 mb-3">
          <Link
            href="/tenders"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to tenders</span>
          </Link>
          <span className="text-rule text-[12px]">/</span>
          <span className="text-[12px] text-ink-faint">Bid Evaluation</span>
        </div>

        {/* Header content */}
        <div className="flex flex-wrap items-end justify-between gap-6 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-seal" />
              <p className="text-[11px] uppercase tracking-[0.14em] font-medium text-ink-faint">
                Bidder Evaluation File
              </p>
            </div>
            <h1 className="mt-1 font-serif text-[26px] font-semibold text-ink leading-tight">
              {bidderName}
            </h1>
          </div>

          <dl className="flex shrink-0 gap-6 text-right">
            {bidNumber && (
              <div className="rounded-[3px] border border-rule bg-surface-muted px-3 py-1.5 text-left">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Bid Number</dt>
                <dd className="identifier mt-0.5 text-[13px] font-medium text-ink">{bidNumber}</dd>
              </div>
            )}
            {dueDate && (
              <div className="rounded-[3px] border border-rule bg-surface-muted px-3 py-1.5 text-left">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Bid Due Date</dt>
                <dd className="identifier mt-0.5 text-[13px] font-medium text-ink">{dueDate}</dd>
              </div>
            )}
            <div className="hidden sm:block rounded-[3px] border border-seal/20 bg-seal-tint px-3 py-1.5 text-left">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-seal">Authority Principle</dt>
              <dd className="text-[12px] font-medium text-seal">Officer Decides</dd>
            </div>
          </dl>
        </div>

        {/* Section Tabs */}
        <nav className="flex gap-1 border-t border-rule" aria-label="Evaluation Sections">
          {tabs.map((tab) => {
            const isCurrent = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                  isCurrent
                    ? "border-seal text-seal font-semibold bg-surface-subtle"
                    : "border-transparent text-ink-muted hover:text-ink hover:bg-surface-muted"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}