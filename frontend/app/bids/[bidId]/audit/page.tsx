import { Masthead } from "@/components/layout/Masthead";
import { BackButton } from "@/components/ui/BackButton";
import { Identifier } from "@/components/ui/status";
import { getAudit, getCompliance } from "@/lib/api";
import AuditTimelineClient from "./AuditTimelineClient";

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

      <main className="mx-auto w-full max-w-[1240px] space-y-6 px-6 py-8">
        <BackButton />

        {/* Integrity banner — plain language first, technical second */}
        <section
          className="overflow-hidden rounded-[6px] border"
          style={{
            borderColor: ok
              ? "color-mix(in srgb, var(--verified) 26%, transparent)"
              : "color-mix(in srgb, var(--failed) 26%, transparent)",
            background: ok
              ? "color-mix(in srgb, var(--verified) 8%, transparent)"
              : "color-mix(in srgb, var(--failed) 8%, transparent)",
          }}
        >
          <div className="px-7 py-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[14px] font-medium"
                style={{
                  color: ok ? "var(--verified)" : "var(--failed)",
                  borderColor: ok ? "var(--verified)" : "var(--failed)",
                  background: "white",
                }}
              >
                {ok ? "✓" : "✕"}
              </span>
              <div>
                <h1
                  className="font-serif text-[18px] leading-tight"
                  style={{ color: ok ? "var(--verified)" : "var(--failed)" }}
                >
                  {ok
                    ? "This record is intact"
                    : `This record is broken from entry #${trail.integrity.first_broken_seq} onward`}
                </h1>
                <p className="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-ink-muted">
                  {ok ? (
                    <>
                      <span className="font-medium text-ink">No one has altered this bid&apos;s history.</span>{" "}
                      Every action — from the first document upload to the last officer decision — is sealed to the
                      one before it. If anyone changed or deleted a past entry, the seal on every later entry would
                      break and this banner would turn red. The database itself refuses <span className="identifier">UPDATE</span>{" "}
                      and <span className="identifier">DELETE</span> on this log, so even an admin cannot edit it.
                    </>
                  ) : (
                    <>
                      Someone (or a database error) altered an early entry. Because each entry&apos;s seal includes
                      the seal before it, every later entry now fails its check. Treat this trail as
                      <span className="font-medium text-ink"> compromised from #{trail.integrity.first_broken_seq} onward</span> and
                      verify the bid&apos;s documents again.
                    </>
                  )}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                  {trail.integrity.total_events} entries · sealed chain ·{" "}
                  {trail.events.length > 0 && (
                    <>
                      first {formatDate(trail.events[0].created_at)} · last{" "}
                      {formatDate(trail.events[trail.events.length - 1].created_at)}
                    </>
                  )}
                </p>
                {trail.integrity.head_hash && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12px] text-ink-faint hover:text-ink">
                      Show technical seal (for auditors)
                    </summary>
                    <p className="mt-2 rounded-[4px] border border-rule bg-white px-3 py-2 text-[11px] leading-relaxed text-ink-faint">
                      Head <Identifier value={trail.integrity.head_hash} className="text-ink-muted" /> · every row stores
                      its own <span className="identifier">row_hash</span> and the previous row&apos;s{" "}
                      <span className="identifier">prev_hash</span>. Verified by{" "}
                      <span className="identifier">vericore_audit_chain_verify()</span> on read.
                    </p>
                  </details>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats — now with clearer labels */}
          {trail.events.length > 0 && (
            <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule bg-white/70">
              <div className="px-7 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">System checks</p>
                <p className="mt-0.5 font-serif text-[20px] leading-none">
                  {trail.events.filter((e) => e.actor_type === "system").length}
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">automatic verification runs</p>
              </div>
              <div className="px-7 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">Officer actions</p>
                <p className="mt-0.5 font-serif text-[20px] leading-none">
                  {trail.events.filter((e) => e.actor_type === "officer").length}
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">accepts & overrides (with reason)</p>
              </div>
              <div className="px-7 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">For this bidder</p>
                <p className="mt-0.5 text-[14px] font-medium leading-none">{summary.bidder_name}</p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  {summary.compliance_score ?? "—"} score · {summary.risk_level ?? "—"} risk · bid due{" "}
                  {summary.bid_due_date ?? "—"}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Improved timeline — interactive filters, search, export */}
        <AuditTimelineClient trail={trail} summary={summary} />

        <section className="rounded-[6px] border border-rule bg-paper px-7 py-4">
          <h3 className="text-[13px] font-medium">How to read this trail</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-ink-muted">
            <li>
              <span className="font-medium text-ink">System checks</span> are automatic and never decide — they
              only read your documents, run arithmetic (turnover averaging, date comparison, ID matching), and leave
              prose judgements as <span className="identifier">NEEDS_HUMAN_REVIEW</span>.
            </li>
            <li>
              <span className="font-medium text-ink">Officer actions</span> are the only decisions:{" "}
              <span className="identifier">Accept</span> (“I read this and it satisfies me”) and{" "}
              <span className="identifier">Override</span> (“I substitute a different verdict”). Both keep the
              machine&apos;s verdict alongside yours — nothing is erased.
            </li>
            <li>
              <span className="font-medium text-ink">Every entry is permanent.</span> The database refuses{" "}
              <span className="identifier">UPDATE</span> and <span className="identifier">DELETE</span> on this
              table. A payload hash chains each row to the previous, verified on every read.
            </li>
            <li className="text-ink-faint">
              Tip: use the search and filters above to isolate officer overrides, or export the filtered trail as JSON
              for your file. The Compliance tab is where you act; this trail is where every act is sealed.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
