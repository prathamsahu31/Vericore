import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DeleteTenderButton } from "./DeleteTenderButton";
import { listTenders } from "@/lib/api";
import type { Tender } from "@/types/api";
import { Plus, ArrowRight, FolderKanban, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<
  Tender["status"],
  { label: string; fg: string; bg: string; border: string }
> = {
  draft: {
    label: "Draft · Upload NIT",
    fg: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
  },
  requirements_extracted: {
    label: "Checklist Ready to Confirm",
    fg: "#B7791F",
    bg: "#FEFCE8",
    border: "#FEF08A",
  },
  requirements_confirmed: {
    label: "Checklist Confirmed · Bids Active",
    fg: "#16803C",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  closed: {
    label: "Tender Closed",
    fg: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
  },
};

export default async function TendersPage() {
  let tenders: Tender[] = [];
  let loadError: string | null = null;

  try {
    tenders = await listTenders();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Backend service connection error";
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="mx-auto max-w-[640px] px-6 py-24">
          <div className="rounded-[4px] border border-failed-border bg-failed-bg p-6 text-left">
            <h1 className="font-serif text-[20px] font-semibold text-failed">
              Unable to connect to tender database
            </h1>
            <p className="mt-2 text-[14px] text-ink-muted leading-relaxed">
              The FastAPI backend may not be reachable at the configured API base URL.
            </p>
            <p className="identifier mt-3 rounded-[3px] border border-rule bg-surface p-2.5 text-[12px] text-ink-faint">
              Ensure backend is running: uvicorn app.main:app --reload
            </p>
          </div>
        </main>
      </div>
    );
  }

  const confirmedCount = tenders.filter((t) => t.status === "requirements_confirmed").length;
  const pendingCount = tenders.filter((t) => t.status === "requirements_extracted" || t.status === "draft").length;

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-6 py-10">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-seal" />
              <p className="text-[11px] font-mono uppercase font-bold tracking-[0.14em] text-ink-faint">
                Procurement Registry
              </p>
            </div>
            <h1 className="mt-1.5 font-serif text-[28px] font-semibold text-ink leading-tight">
              Tenders Under Evaluation
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              Official tender notices, clause checklists, and bidder evaluation files.
            </p>
          </div>

          <Link
            href="/tenders/new"
            className="inline-flex items-center gap-1.5 rounded-[3px] bg-seal px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-seal-strong shadow-xs"
          >
            <Plus size={15} />
            <span>Create New Tender</span>
          </Link>
        </div>

        {/* Operational Overview Metrics */}
        {tenders.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
              <p className="text-[11px] uppercase font-mono tracking-wider text-ink-faint">Total Tenders</p>
              <p className="mt-1 font-serif text-[24px] font-semibold text-ink">{tenders.length}</p>
            </div>
            <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
              <p className="text-[11px] uppercase font-mono tracking-wider text-ink-faint">Checklists Confirmed</p>
              <p className="mt-1 font-serif text-[24px] font-semibold text-verified">{confirmedCount}</p>
            </div>
            <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
              <p className="text-[11px] uppercase font-mono tracking-wider text-ink-faint">Setup / Extraction Pending</p>
              <p className="mt-1 font-serif text-[24px] font-semibold text-review">{pendingCount}</p>
            </div>
          </div>
        )}

        {/* Tender Listing */}
        {tenders.length === 0 ? (
          <section className="mt-8 rounded-[4px] border border-rule bg-surface p-12 text-center panel-shadow">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-faint mb-4">
              <FolderKanban size={24} />
            </div>
            <h2 className="font-serif text-[18px] font-semibold text-ink">
              No Tenders in Workspace
            </h2>
            <p className="mt-2 max-w-[48ch] mx-auto text-[14px] text-ink-muted leading-relaxed">
              Start by creating a new tender record, upload the Notice Inviting Tender (NIT), and lock the eligibility checklist before adding bidder bundles.
            </p>
            <div className="mt-6">
              <Link
                href="/tenders/new"
                className="inline-flex items-center gap-1.5 rounded-[3px] bg-seal px-4 py-2 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors"
              >
                <Plus size={14} />
                <span>Create Tender Record</span>
              </Link>
            </div>
          </section>
        ) : (
          <div className="mt-8 rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
            <div className="divide-y divide-rule">
              {tenders.map((t) => {
                const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.draft;
                const isConfirmed = t.status === "requirements_confirmed";

                return (
                  <div
                    key={t.id}
                    className="p-6 transition-colors hover:bg-surface-subtle flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {t.bid_number && (
                          <span className="identifier rounded-[2px] bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold text-ink border border-rule">
                            {t.bid_number}
                          </span>
                        )}
                        <span
                          className="rounded-[3px] border px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            color: cfg.fg,
                            backgroundColor: cfg.bg,
                            borderColor: cfg.border,
                          }}
                        >
                          {cfg.label}
                        </span>
                        {t.buyer_organisation && (
                          <span className="text-[12px] text-ink-faint">
                            · {t.buyer_organisation}
                          </span>
                        )}
                      </div>

                      <h2 className="font-serif text-[18px] font-semibold text-ink leading-snug">
                        {t.title}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted">
                        {t.bid_due_date && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-ink-faint" />
                            <span>Due: <strong className="font-mono text-ink">{t.bid_due_date}</strong></span>
                          </span>
                        )}
                        {t.estimated_value && (
                          <span>
                            Est. Value: <strong className="font-mono text-ink">₹{t.estimated_value}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isConfirmed ? (
                        <Link
                          href={`/tenders/${t.id}/setup`}
                          className="inline-flex items-center gap-1 rounded-[3px] border border-seal bg-seal px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors"
                        >
                          <span>Review & Confirm Checklist</span>
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/tenders/${t.id}/bidders/new`}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-seal bg-seal px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors"
                          >
                            <span>+ Add Bidder</span>
                          </Link>

                          <Link
                            href={`/tenders/${t.id}`}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-rule bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-muted hover:border-ink hover:text-ink transition-colors"
                          >
                            <span>Compare Bidders</span>
                          </Link>
                        </>
                      )}

                      <DeleteTenderButton tenderId={t.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}