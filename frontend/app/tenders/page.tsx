import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BackButton } from "@/components/ui/BackButton";
import { BackendWakeFallback } from "@/components/BackendHealthGate";
import { DeleteTenderButton } from "./DeleteTenderButton";
import { listTenders } from "@/lib/api";
import type { Tender } from "@/types/api";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<Tender["status"], string> = {
  draft: "No checklist yet",
  requirements_extracted: "Checklist ready to confirm",
  requirements_confirmed: "Checklist confirmed",
  closed: "Closed",
};

export default async function TendersPage() {
  let tenders: Tender[];
  try {
    tenders = await listTenders();
  } catch {
    return (
      <div className="page-backdrop min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[560px] px-6 py-12">
          <BackButton />
          <h1 className="mt-4 font-serif text-[24px] leading-tight">Workspace is waking</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            We couldn&apos;t reach the backend on this attempt. On Render&apos;s free tier the
            service sleeps after ~15 min idle and takes ~50–60s to start — your tenders are safe.
          </p>
          <div className="mt-6">
            <BackendWakeFallback message="The page will reload automatically once the backend answers /health. You can also retry manually." />
          </div>
          <p className="mt-6 text-[12px] text-ink-faint">
            Running locally? Start it with <span className="identifier">uvicorn app.main:app --reload</span>.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-6 py-12">
        <BackButton />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Officer workspace
            </p>
            <h1 className="mt-2 font-serif text-[28px] leading-tight">Tenders</h1>
            {tenders.length > 0 && (
              <p className="mt-2 text-[13px] text-ink-muted">
                {tenders.length} tender{tenders.length === 1 ? "" : "s"} under evaluation
              </p>
            )}
          </div>
          <Link
            href="/tenders/new"
            className="rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-seal-strong"
          >
            Start a new tender
          </Link>
        </div>

        {tenders.length === 0 ? (
          <section className="mt-10 rounded-[6px] border border-rule bg-surface p-8">
            <h2 className="text-[16px]">Nothing here yet</h2>
            <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ink-muted">
              Start a new tender to upload a NIT, then confirm its checklist before
              adding bidders.
            </p>
          </section>
        ) : (
          <ul className="mt-10 divide-y divide-rule overflow-hidden rounded-[6px] border border-rule bg-surface">
            {tenders.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 px-7 py-5">
                <div className="min-w-0">
                  <p className="truncate text-[16px]">{t.title}</p>
                  <p className="mt-1 text-[12px] text-ink-faint">
                    {t.bid_number && <span className="identifier">{t.bid_number} · </span>}
                    {STATUS_LABEL[t.status]}
                    {t.bid_due_date && (
                      <>
                        {" · bid due "}
                        <span className="identifier">{t.bid_due_date}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.status !== "requirements_confirmed" ? (
                    <Link
                      href={`/tenders/${t.id}/setup`}
                      className="rounded-[4px] border border-rule px-4 py-2 text-[13px] font-medium text-ink-muted hover:text-ink"
                    >
                      Review checklist
                    </Link>
                  ) : (
                    <Link
                      href={`/tenders/${t.id}/bidders/new`}
                      className="rounded-[4px] border border-rule px-4 py-2 text-[13px] font-medium text-ink-muted hover:text-ink"
                    >
                      Add a bidder
                    </Link>
                  )}
                  <Link
                    href={`/tenders/${t.id}`}
                    className="rounded-[4px] border border-rule px-4 py-2 text-[13px] font-medium text-ink-muted hover:text-ink"
                  >
                    Compare bidders
                  </Link>
                  <DeleteTenderButton tenderId={t.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}