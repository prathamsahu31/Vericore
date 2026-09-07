import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
import { listTenders } from "../lib/api";
import { TenderList } from "./TenderList";

export const dynamic = "force-dynamic";

export default async function TendersPage() {
  let tenders: Awaited<ReturnType<typeof listTenders>>;
  try {
    tenders = await listTenders();
  } catch {
    return (
      <main className="mx-auto max-w-[62ch] px-6 py-24">
        <h1 className="text-[24px]">No tenders could be loaded</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          The backend may not be running. Start it with{" "}
          <span className="identifier">uvicorn app.main:app --reload</span>.
        </p>
      </main>
    );
  }

  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-6 py-12">
        <div className="flex items-center justify-between gap-4">
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
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[4px] bg-seal px-5 text-[14px] font-medium text-white transition-colors hover:bg-seal-strong"
          >
            Start a new tender
          </Link>
        </div>

      <TenderList initial={tenders} />
      </main>
    </div>
  );
}