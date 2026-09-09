"use client";

import { SiteHeader } from "@/components/layout/SiteHeader";

export default function ProblemStatementPage() {
  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[72ch] px-6 py-12">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">SIH 26100</p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight">
          Problem Statement — AI-Powered Bid Compliance Verification for GeM
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          CPCL (Chennai Petroleum Corporation Limited) needs a system that verifies bidder-submitted
          evidence against tender-specific requirements, with traceability to a specific page of a
          specific document. This page will hold the full statement.
        </p>
        <p className="mt-6 text-[13px] text-ink-faint">
          If you see this placeholder, the merge left this file empty — it has been restored to a
          minimal valid component so the app can run. Replace with the final content.
        </p>
      </main>
    </div>
  );
}
