"use client";
import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import Cards from "@/components/layout/HomeCarousel";
import IntroAnimation from "@/components/layout/IntroAnimation";
import GlassBox from "@/components/layout/GlassBox";


export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  return (
    <div className="page-backdrop min-h-screen">
      {showIntro && <IntroAnimation onFinish={() => setShowIntro(false)} />}
      <SiteHeader />

      <main className="mx-auto max-w-[1080px] px-6 pb-24">
        {/* Hero */}
        <section className="grid gap-10 border-b border-rule py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h1 className="mt-6 max-w-[20ch] font-serif text-[40px] leading-[1.08] tracking-tight sm:text-[48px]">
              Bid compliance, verified to the page.
            </h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">
              Vericore turns a tender&rsquo;s eligibility conditions into an exact
              checklist, reads each bidder&rsquo;s evidence against it, and shows you
              precisely where every value came from.
            </p>
            <p className="mt-4 font-serif text-[17px] italic text-ink">
              The officer decides. The system never does.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tenders/new"
                className="rounded-[4px] bg-seal px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-seal-strong"
              >
                Start a tender
              </Link>
              <Link
                href="/tenders"
                className="rounded-[4px] border border-rule bg-surface px-6 py-3 text-[15px] font-medium text-ink-muted transition-colors hover:border-seal hover:text-seal"
              >
                Open your workspace
              </Link>
            </div>
          </div>
          <HeroPanel isActive={!showIntro} />
        </section>

        <Cards />

        {/* Principles strip */}
        <section className="mt-16 rounded-[6px] border border-rule bg-surface px-7 py-8">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { t: "Evidence or it didn't happen", d: "Every verdict cites a document, a page, and the text it was read from." },
              { t: "Simulated is labelled simulated", d: "Government-register checks that use canned data always carry the chip." },
              { t: "The score is arithmetic", d: "A transparent weighted sum over named conditions — not a model's guess." },
            ].map(({ t, d }) => (
              <div key={t}>
                <h3 className="text-[15px] font-semibold">{t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

    </div>

  );
}

/** SAMPLE COMPANY PANEL FOR THE HERO SECTION   import glass box**/

function HeroPanel({ isActive }: { isActive: boolean }) {
  return (
    <GlassBox isActive={isActive} />
  );
}