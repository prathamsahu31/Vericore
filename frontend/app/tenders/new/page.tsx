import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { NewTenderForm } from "./NewTenderForm";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function NewTenderPage() {
  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-6 py-10">
        <div className="mb-4">
          <Link
            href="/tenders"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to tenders</span>
          </Link>
        </div>

        <div className="border-b border-rule pb-6 mb-6">
          <p className="text-[11px] font-mono uppercase font-bold tracking-[0.14em] text-ink-faint">
            Stage 01 · Tender Registry Setup
          </p>
          <h1 className="mt-1.5 font-serif text-[28px] font-semibold text-ink leading-tight">
            Initiate New Tender Record
          </h1>
          <p className="mt-2 text-[14px] text-ink-muted leading-relaxed">
            Record the statutory particulars of the procurement proceeding. Next, upload the official Notice Inviting Tender (NIT) PDF to automatically extract and lock the eligibility checklist.
          </p>
        </div>

        <NewTenderForm />
      </main>
    </div>
  );
}