import { Masthead } from "../../components/Masthead";
import { getCompliance } from "../../lib/api";
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
    // Empty and failure states give direction, not an error code (§11).
    return (
      <Unavailable
        title="This bid could not be loaded"
        body="The backend may not be running, or verification may not have been run on this bid yet."
        hint="Start the API with uvicorn app.main:app --reload, then run POST /bids/{id}/verify."
      />
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
