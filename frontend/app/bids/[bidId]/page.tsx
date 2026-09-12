import { Masthead } from "@/components/layout/Masthead";
import { BackendWakeFallback } from "@/components/BackendHealthGate";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BackButton } from "@/components/ui/BackButton";
import { getCompliance } from "@/lib/api";
import { BidWorkspace } from "./BidWorkspace";

export const dynamic = "force-dynamic";

export default async function BidPage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  const { bidId } = await params;

  let summary;
  try {
    summary = await getCompliance(bidId);
  } catch {
    // Cold start on Render takes ~60s — show warm-up UI, not a bare error (§11 failure states give direction).
    return (
      <div className="page-backdrop min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[560px] px-6 py-12">
          <BackButton />
          <h1 className="mt-4 font-serif text-[24px] leading-tight">This bid could not be loaded</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            We couldn&apos;t reach the backend, or verification hasn&apos;t been run on this bid yet. On Render&apos;s
            free tier the first request after idle takes ~50–60s — keep this tab open and we&apos;ll retry automatically.
          </p>
          <div className="mt-6">
            <BackendWakeFallback message="If verification was never run, start the API with uvicorn app.main:app --reload then POST /bids/{id}/verify." />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead
        bidderName={summary.bidder_name}
        dueDate={summary.bid_due_date}
        active="compliance"
        bidId={bidId}
      />
      <BidWorkspace initial={summary} />
    </div>
  );
}

function Unavailable({ title, body, hint }: { title: string; body: string; hint: string }) {
  return (
    <main className="mx-auto max-w-[62ch] px-6 py-24">
      <h1 className="text-[24px]">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{body}</p>
      <p className="identifier mt-4 rounded-[4px] border border-rule bg-surface p-3 text-[12px] text-ink-muted">
        {hint}
      </p>
    </main>
  );
}
