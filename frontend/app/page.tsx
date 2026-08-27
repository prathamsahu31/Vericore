export default function Home() {
  return (
    <main className="mx-auto max-w-[68ch] px-6 py-20">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
        SIH 2026 · Problem statement 26100
      </p>
      <h1 className="mt-2 text-[32px] leading-tight">Vericore</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">
        Bid compliance verification for GeM procurement. An officer uploads a tender
        and each bidder&rsquo;s documents; Vericore turns the tender&rsquo;s
        eligibility conditions into a checklist, reads the bidder&rsquo;s evidence
        against it, and shows exactly where every value came from.
      </p>
      <p className="mt-4 text-[16px] leading-relaxed">
        The officer decides. The system never does.
      </p>

      <div className="mt-10 rounded-[6px] border border-rule bg-surface p-5">
        <h2 className="text-[16px]">Opening a bid</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          The tender setup and bidder upload screens are not built yet. To view a bid
          that has already been verified through the API, open:
        </p>
        <p className="identifier mt-3 rounded-[4px] border border-rule bg-paper p-3 text-[13px]">
          /bids/&lt;bid-id&gt;
        </p>
      </div>
    </main>
  );
}
