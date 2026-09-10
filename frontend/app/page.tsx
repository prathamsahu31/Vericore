"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { HeroProductInterface } from "@/components/landing/HeroProductInterface";
import { EditorialProcess } from "@/components/landing/EditorialProcess";
import { ArrowRight, Shield, CheckCircle, Lock, BookOpen } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-6 pb-24">
        {/* Hero Section */}
        <section className="pt-16 pb-16 border-b border-rule grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            {/* Context Eyebrow */}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-seal" />
              <span className="text-[11px] font-mono uppercase font-bold tracking-[0.16em] text-seal">
                Public Procurement Intelligence · SIH26100
              </span>
            </div>

            <h1 className="mt-4 font-serif text-[38px] sm:text-[46px] font-semibold text-ink leading-[1.1] tracking-tight">
              Bid compliance, verified to the page.
            </h1>

            <p className="mt-5 max-w-[54ch] text-[16px] sm:text-[17px] leading-relaxed text-ink-muted">
              Vericore transforms complex Notice Inviting Tender (NIT) requirements into deterministic checklists,
              cross-verifies bidder document bundles against statutory thresholds, and provides page-level citations for every finding.
            </p>

            <div className="mt-4 border-l-2 border-seal pl-3 py-0.5">
              <p className="font-serif text-[15px] italic text-ink font-medium">
                &ldquo;The officer decides. The system never does.&rdquo;
              </p>
              <p className="text-[11px] text-ink-faint mt-0.5">
                No code path qualifies or disqualifies bidders autonomously. Statutory authority remains with the officer.
              </p>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/tenders/new"
                className="inline-flex items-center gap-2 rounded-[3px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-seal-strong"
              >
                <span>Start a new tender</span>
                <ArrowRight size={15} />
              </Link>

              <Link
                href="/tenders"
                className="inline-flex items-center gap-2 rounded-[3px] border border-rule bg-surface px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink hover:bg-surface-subtle"
              >
                <span>Open officer workspace</span>
              </Link>

              <Link
                href="/command"
                className="inline-flex items-center gap-1.5 rounded-[3px] px-3 py-2 text-[13px] font-medium text-ink-muted hover:text-seal transition-colors"
              >
                <span>Engine Pipeline →</span>
              </Link>
            </div>
          </div>

          {/* Hero Visual: Actual Miniature Vericore Interface */}
          <div className="w-full">
            <HeroProductInterface />
          </div>
        </section>

        {/* Process Section: Editorial Workflow with authentic artifacts */}
        <EditorialProcess />

        {/* Principles Section: Institutional Core Floor */}
        <section className="border-t border-rule pt-16">
          <div className="mb-8">
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-ink-faint">
              Institutional Safeguards
            </span>
            <h2 className="mt-1 font-serif text-[24px] font-semibold text-ink">
              Engineered for scrutiny under RTI, CAG, and CVC audits
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="rounded-[4px] border border-rule bg-surface p-5 panel-shadow">
              <div className="flex items-center gap-2 text-seal mb-2">
                <Shield size={16} />
                <h3 className="font-serif text-[15px] font-semibold text-ink">Evidence or it didn&apos;t happen</h3>
              </div>
              <p className="text-[13px] text-ink-muted leading-relaxed">
                Every verdict carries citations to the document, exact page, and OCR coordinates. A verdict without citations is treated as a bug.
              </p>
            </div>

            <div className="rounded-[4px] border border-rule bg-surface p-5 panel-shadow">
              <div className="flex items-center gap-2 text-seal mb-2">
                <CheckCircle size={16} />
                <h3 className="font-serif text-[15px] font-semibold text-ink">Simulated is labelled simulated</h3>
              </div>
              <p className="text-[13px] text-ink-muted leading-relaxed">
                Government-register checks that use canned test data always carry the prominent <span className="font-mono text-review font-semibold">SIMULATED</span> badge in all views and exports.
              </p>
            </div>

            <div className="rounded-[4px] border border-rule bg-surface p-5 panel-shadow">
              <div className="flex items-center gap-2 text-seal mb-2">
                <BookOpen size={16} />
                <h3 className="font-serif text-[15px] font-semibold text-ink">Arithmetic score, not model output</h3>
              </div>
              <p className="text-[13px] text-ink-muted leading-relaxed">
                A transparent, hand-recomputable weighted sum across named conditions. No language model ever computes or guesses compliance scores.
              </p>
            </div>

            <div className="rounded-[4px] border border-rule bg-surface p-5 panel-shadow">
              <div className="flex items-center gap-2 text-seal mb-2">
                <Lock size={16} />
                <h3 className="font-serif text-[15px] font-semibold text-ink">Cryptographic hash chain</h3>
              </div>
              <p className="text-[13px] text-ink-muted leading-relaxed">
                Every document upload and officer determination is sealed into an append-only, SHA-256 hash chain with database triggers prohibiting updates.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}