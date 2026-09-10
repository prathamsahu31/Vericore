import { Masthead } from "@/components/layout/Masthead";
import { Identifier } from "@/components/ui/status";
import { getAudit, getCompliance } from "@/lib/api";
import AuditTimelineClient from "./AuditTimelineClient";
import { ShieldCheck, ShieldAlert, Lock, CheckCircle2 } from "lucide-react";

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
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <Masthead
        bidderName={summary.bidder_name}
        dueDate={summary.bid_due_date}
        active="audit"
        bidId={bidId}
      />

      <main className="mx-auto w-full max-w-[1240px] space-y-6 px-6 py-8">
        {/* Cryptographic Integrity Certificate */}
        <section
          className={`rounded-[4px] border p-6 panel-shadow ${
            ok
              ? "border-verified-border bg-verified-bg/50"
              : "border-failed-border bg-failed-bg/50"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border ${
                  ok
                    ? "border-verified-border bg-verified text-white"
                    : "border-failed-border bg-failed text-white"
                }`}
              >
                {ok ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase font-bold tracking-[0.14em] text-ink-faint">
                    PostgreSQL Append-Only Audit Ledger
                  </span>
                  <span
                    className={`rounded-[2px] px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase ${
                      ok ? "bg-verified text-white" : "bg-failed text-white"
                    }`}
                  >
                    {ok ? "Chain Intact" : "Integrity Failure"}
                  </span>
                </div>

                <h1 className="mt-1 font-serif text-[20px] font-semibold text-ink">
                  {ok
                    ? "Cryptographic Audit Continuity Verified"
                    : `Hash Chain Compromised at Seq #${trail.integrity.first_broken_seq}`}
                </h1>

                <p className="mt-1.5 max-w-[78ch] text-[13px] leading-relaxed text-ink-muted">
                  {ok ? (
                    <>
                      Every operational event — document ingestion, OCR extraction, deterministic evaluation, and officer adjudication —
                      is linked via SHA-256 hash chains. The underlying database enforces an append-only trigger that rejects all
                      <span className="identifier font-semibold"> UPDATE</span> and <span className="identifier font-semibold">DELETE</span> statements.
                    </>
                  ) : (
                    <>
                      A prior log record failed cryptographic hash validation. The audit trail cannot be certified from entry
                      #{trail.integrity.first_broken_seq} onward. Independent re-verification of source documents required.
                    </>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] font-mono text-ink-faint">
                  <span>Entries: <strong className="text-ink">{trail.integrity.total_events}</strong></span>
                  <span>·</span>
                  <span>Head Hash: <Identifier value={trail.integrity.head_hash?.slice(0, 16) + "…"} className="text-ink font-semibold" /></span>
                  <span>·</span>
                  <span>Verified via: <span className="text-ink">vericore_audit_chain_verify()</span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Timeline & Filters */}
        <AuditTimelineClient trail={trail} summary={summary} />
      </main>
    </div>
  );
}
