import Link from "next/link";
import { SiteHeader } from "./components/layout/SiteHeader";

const STEPS = [
  {
    n: "01",
    title: "Upload the NIT",
    body: "Add the tender notice. Vericore reads it and turns its eligibility conditions into a checklist you review line by line.",
    href: "/tenders/new",
    cta: "Start a tender",
  },
  {
    n: "02",
    title: "Add each bidder's documents",
    body: "One file per document, and let Vericore sort them, or upload the whole bundle. Either way it isolates each page's evidence.",
    href: "/tenders",
    cta: "Open the workspace",
  },
  {
    n: "03",
    title: "Decide, on the evidence",
    body: "Every verdict opens to the exact page it came from. The system recommends; the decision, and the audit trail behind it, is yours.",
    href: "/tenders",
    cta: "See the ledgers",
  },
];

export default function Home() {
  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-[1080px] px-6 pb-24">
        {/* Hero */}
        <section className="grid gap-10 border-b border-rule py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-seal" aria-hidden />
              SIH 2026 · Problem statement 26100
            </p>
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
                Open the workspace
              </Link>
            </div>
          </div>

          <HeroPanel />
        </section>

        {/* Steps */}
        <section className="pt-16">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">How the desk runs</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <Link
                key={step.n}
                href={step.href}
                className="rule-top-seal rounded-[6px] border border-rule bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span className="font-serif text-[28px] leading-none text-seal/70">{step.n}</span>
                <h2 className="mt-4 text-[17px] font-semibold">{step.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{step.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-seal">
                  {step.cta}
                  <span aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

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

/**
 * A small live-feeling sheet peeking at what a verdict looks like: one scored
 * condition, its federal-check result, and the claim that every row is
 * clickable. Purely presentational — no data dependency.
 */
function HeroPanel() {
  const rows = [
    { label: "Turnover threshold", verdict: "Compliant", chip: "green", span: "2023–24 ₹38.2 Cr" },
    { label: "GST registration", verdict: "Compliant", chip: "green", span: "PAN matches" },
    { label: "OEM authorisation", verdict: "Your review", chip: "amber", span: "needs a person" },
    { label: "Blacklist declaration", verdict: "No document", chip: "amber", span: "ask the bidder" },
  ];
  return (
    <div className="rounded-[6px] border border-rule bg-surface p-6">
      <div className="flex items-baseline justify-between border-b border-rule pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">Sample verdict</p>
          <p className="mt-1 font-serif text-[18px] font-semibold">ABC Infra Private Ltd</p>
        </div>
        <span className="identifier text-[13px] text-ink-faint">REQ-007</span>
      </div>

      <ul className="divide-y divide-rule">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{r.label}</p>
              <p className="identifier mt-0.5 text-[12px] text-ink-faint">{r.span}</p>
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-[12px] font-medium"
              style={{
                color: r.chip === "green" ? "var(--verified)" : "var(--review)",
                background: `color-mix(in srgb, ${r.chip === "green" ? "var(--verified)" : "var(--review)"} 9%, transparent)`,
                borderColor: `color-mix(in srgb, ${r.chip === "green" ? "var(--verified)" : "var(--review)"} 26%, transparent)`,
              }}
            >
              <span aria-hidden>{r.chip === "green" ? "✓" : "◆"}</span>
              {r.verdict}
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-rule pt-4 text-[13px] text-ink-muted">
        Every row opens to its exact page, with the field highlighted and the source quoted.
      </p>
    </div>
  );
}