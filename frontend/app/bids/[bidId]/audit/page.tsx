import { Masthead } from "../../../components/Masthead";
import { Identifier } from "../../../components/status";
import { getAudit, getCompliance } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  const { bidId } = await params;
  const [summary, trail] = await Promise.all([getCompliance(bidId), getAudit(bidId)]);
  const ok = trail.integrity.intact;

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead
        bidderName={summary.bidder_name}
        dueDate={summary.bid_due_date}
        active="audit"
        bidId={bidId}
      />

      <main className="mx-auto w-full max-w-[1240px] space-y-6 px-6 py-6">
        {/* Chain-integrity status sits at the top of the trail (CLAUDE.md §11). */}
        <section
          className="rounded-[6px] border px-5 py-4"
          style={{
            borderColor: ok
              ? "color-mix(in srgb, var(--verified) 26%, transparent)"
              : "color-mix(in srgb, var(--failed) 26%, transparent)",
            background: ok
              ? "color-mix(in srgb, var(--verified) 8%, transparent)"
              : "color-mix(in srgb, var(--failed) 8%, transparent)",
          }}
        >
          <p
            className="flex items-center gap-2 text-[16px]"
            style={{ color: ok ? "var(--verified)" : "var(--failed)" }}
          >
            <span aria-hidden>{ok ? "✓" : "✕"}</span>
            {ok
              ? "Record intact — every entry verifies against the one before it"
              : `Record broken at entry ${trail.integrity.first_broken_seq}`}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {trail.integrity.total_events} entries in the log. Each is sealed against its
            predecessor, so altering or removing any past entry breaks the seal on every
            entry that follows and shows up here. Entries cannot be edited or deleted —
            the database itself refuses.
          </p>
          {trail.integrity.head_hash && (
            <p className="mt-2 text-[12px] text-ink-faint">
              Head seal <Identifier value={trail.integrity.head_hash} className="text-ink-muted" />
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-[6px] border border-rule bg-surface">
          <h2 className="border-b border-rule px-5 py-3 text-[20px]">Audit trail</h2>
          {trail.events.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-ink-muted">
              Nothing has been recorded against this bid yet.
            </p>
          ) : (
            <ol className="divide-y divide-rule">
              {trail.events.map((event) => (
                <li key={event.id} className="grid grid-cols-[64px_1fr] gap-4 px-5 py-4">
                  <div>
                    <Identifier value={`#${event.seq}`} className="text-[13px] text-ink-faint" />
                    <p className="identifier mt-1 text-[11px] text-ink-faint">
                      {event.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div>
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[14px] font-medium">
                        {labelEventType(event.event_type)}
                      </span>
                      <span className="text-[12px] text-ink-faint">
                        {event.actor_type === "officer"
                          ? "by an officer"
                          : `by ${event.actor_component ?? "the system"}`}
                      </span>
                    </p>
                    {(event.previous_state || event.new_state) && (
                      <p className="mt-1 text-[13px] text-ink-muted">
                        {event.previous_state?.replace(/_/g, " ").toLowerCase() ?? "—"}{" "}
                        <span aria-hidden>→</span>{" "}
                        {event.new_state?.replace(/_/g, " ").toLowerCase() ?? "—"}
                      </p>
                    )}
                    {event.reason && (
                      <p className="mt-1 max-w-[76ch] text-[13px] leading-relaxed text-ink">
                        &ldquo;{tidyReason(event.reason)}&rdquo;
                      </p>
                    )}
                    {event.llm_model_id && (
                      <p className="mt-1 text-[11px] text-ink-faint">
                        Model{" "}
                        <Identifier value={event.llm_model_id} className="text-ink-muted" />
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-ink-faint">
                      seal <Identifier value={event.row_hash.slice(0, 24) + "…"} />
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  verification_run_completed: "Verification run completed",
  officer_accept: "Officer accepted machine-pending item",
  officer_override: "Officer override recorded",
};

function labelEventType(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType.replace(/_/g, " ");
}

function tidyReason(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
}
