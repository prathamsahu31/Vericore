"use client";

import { useEffect, useState } from "react";
import type { ComplianceRow, DocumentSummary } from "../../types/api";
import { documentFileUrl, getDocuments } from "../../lib/api";
import { Identifier, SourceChip, StatusChip } from "../ui/status";

/**
 * The evidence ledger — the component §11 says the interface should be
 * remembered for.
 *
 * Two columns: what the bidder submitted on the left, what the register
 * returned on the right, a vertical hairline between them, corresponding fields
 * on the same row, and a match marker in the gutter. Nothing on this screen is
 * asserted without saying where it came from.
 */
export function EvidenceLedger({
  row,
  bidId,
  onClose,
}: {
  row: ComplianceRow | null;
  bidId: string | null;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  useEffect(() => {
    if (!row || !bidId) return;
    setDocs(null);
    setDocsError(null);
    getDocuments(bidId)
      .then(setDocs)
      .catch((e) => setDocsError(e instanceof Error ? e.message : "Could not load documents."));
  }, [row, bidId]);

  if (!row) return null;

  const effective = row.effective_status ?? row.status;
  const overridden = row.override_status !== null;

  return (
    <div className="fixed inset-0 z-20 flex justify-end" role="dialog" aria-modal="true">
      <button
        aria-label="Close evidence"
        onClick={onClose}
        className="flex-1 bg-ink/20"
      />
      <div className="flex w-full max-w-[720px] flex-col overflow-y-auto border-l border-rule bg-surface">
      <div className="sticky top-0 border-b border-rule bg-surface px-7 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Evidence behind this verdict
            </p>
            <Identifier value={row.requirement_code} className="mt-2 text-[12px] text-ink-faint" />
            <h2 className="mt-1 text-[20px] leading-snug">{row.requirement_name}</h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button
              onClick={onClose}
              className="rounded-[4px] border border-rule px-3 py-1.5 text-[13px] text-ink-muted"
            >
              Close
            </button>
            <StatusChip status={effective} overridden={overridden} />
          </div>
        </div>
      </div>

      {/* The two-column ledger */}
      <div className="grid grid-cols-[1fr_44px_1fr]">
        <ColumnHeader label="Submitted" sub="From the bidder's documents" />
        <div className="border-b border-rule bg-paper" aria-hidden />
        <ColumnHeader
          label="Retrieved"
          sub={
            row.external_check_portal
              ? `${row.external_check_portal} adapter`
              : "No external check for this condition"
          }
          right
          chip={<SourceChip source={row.external_check_source} />}
        />

        <LedgerRow
          left={
            <>
              <div className="rounded-[4px] border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--review) 28%, transparent)", background: "color-mix(in srgb, var(--review) 8%, transparent)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--review)" }}>
                  Why this needs you
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">
                  {(() => {
                    const s = row.effective_status ?? row.status;
                    if (s === "MISSING_EVIDENCE") return `We looked for the document needed for '${row.requirement_name}' but didn't find it in what was submitted.`;
                    if (s === "NEEDS_HUMAN_REVIEW") return "This one needs your judgement — it's not a simple number or date we can check automatically, or we couldn't pinpoint the value on the page.";
                    if (s === "UNVERIFIED") return "We couldn't reach the government register to double-check this. Nothing is claimed either way — you'll need to verify it separately if needed.";
                    if (s === "INCONSISTENT") return "The bidder's own files don't agree on this point (for example, the name or ID is different in two places).";
                    if (s === "EXPIRED") return "The right document was there, but it had already expired by the bid due date.";
                    if (s === "NON_COMPLIANT") return "We found the evidence and checked it against what the tender asks for — it doesn't meet the requirement.";
                    return row.reasoning ?? "This needs your attention.";
                  })()}
                </p>
                {row.reasoning && (
                  <p className="mt-2 rounded-[4px] bg-white/60 px-2.5 py-2 text-[12px] leading-relaxed text-ink-muted border border-rule">
                    <span className="font-medium text-ink">Details:</span> {row.reasoning}
                  </p>
                )}
              </div>
              <div className="mt-3 rounded-[4px] border border-rule bg-paper px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">How we checked this</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                  {(() => {
                    const m = (row.verification_method ?? "").replace(/_/g, " ");
                    if (m.includes("semantic judgement")) return "We read the wording in your document and compared it to what the tender asks for — this one needs a person to judge, not just a calculation.";
                    if (m.includes("document presence")) return "We checked that you actually sent the right kind of document and that we could read the key details from it.";
                    if (m.includes("routing")) return "We looked for the right document type for this condition and checked what we found inside it.";
                    if (m.includes("rule")) return "We ran a simple check — like comparing a number or date — no AI guessing involved.";
                    return m ? `We checked this using: ${m}.` : "We checked this against your submitted documents.";
                  })()}
                </p>
                <p className="mt-2 text-[12px] text-ink-muted">
                  {row.confidence !== null && (
                    <>We&apos;re <span className="font-medium text-ink">{Math.round(row.confidence * 100)}% confident</span> about what we read{row.evidence_field_ids.length > 0 ? " — " : "."}</>
                  )}
                  {row.evidence_field_ids.length > 0
                    ? `Found ${row.evidence_field_ids.length} detail${row.evidence_field_ids.length === 1 ? "" : "s"} in your files — each one links back to the exact page where we saw it, so you can double-check in one click.`
                    : "We didn't find anything to cite for this one — that's why it needs your look."}
                </p>
              </div>
            </>
          }
          marker={row.external_check_status === "found" ? "=" : row.external_check_portal ? "·" : ""}
          right={
            row.external_check_portal ? (
              <>
                <FieldLabel>Register response</FieldLabel>
                <p className="text-[14px] text-ink">
                  {row.external_check_status === "found"
                    ? `A matching record was returned from ${row.external_check_portal}.`
                    : row.external_check_status === "not_found"
                      ? `No record found for this identifier on ${row.external_check_portal}.`
                      : row.external_check_status === "unavailable"
                        ? `The ${row.external_check_portal} check could not be run — nothing is claimed either way.`
                        : row.external_check_status}
                </p>
                {row.external_check_status === "unavailable" && (
                  <p className="mt-2 text-[13px] text-ink-muted">
                    This is not a failure. A register being down must never cost a bidder their tender — it routes to your review instead.
                  </p>
                )}
                <p className="mt-2 text-[12px] text-ink-faint">
                  Source: <span className="font-medium">{row.external_check_source ?? "—"}</span>
                  {row.external_check_source === "simulated" && " — this did not contact a live government system. It stands in for the integration that would run once partner credentials exist."}
                  {row.external_check_source === "live" && " — retrieved from a live government system."}
                </p>
              </>
            ) : (
              <>
                <FieldLabel>No register check</FieldLabel>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  This condition is answered from the bidder&rsquo;s own documents. No government register is consulted for it.
                </p>
                <p className="mt-2 text-[12px] text-ink-faint">
                  For example, turnover is checked by arithmetic on the bidder&rsquo;s CA certificate — there is no register to call.
                </p>
              </>
            )
          }
        />

        <div className="col-span-3 border-b border-rule bg-paper px-6 py-4">
          <FieldLabel>Source documents — one click to open the PDF</FieldLabel>
          {docs === null ? (
            <p className="mt-2 text-[13px] text-ink-muted">Loading documents…</p>
          ) : docsError ? (
            <p className="mt-2 text-[13px]" style={{ color: "var(--failed)" }}>{docsError}</p>
          ) : docs.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-muted">No documents were submitted for this bid yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-rule bg-surface px-3 py-2">
                  <span className="text-[13px] text-ink">{d.original_filename}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-faint">{d.page_count ?? "—"} page{(d.page_count ?? 0) === 1 ? "" : "s"} · {d.ingestion_mode}</span>
                    <a
                      href={documentFileUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[3px] border border-seal bg-seal-tint px-2.5 py-1 text-[11px] font-medium text-seal hover:bg-seal hover:text-white transition-colors"
                    >
                      Open PDF
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-ink-faint">
            Each cited value opens to its page and highlighted region. Use the browser’s PDF viewer to verify the extraction.
          </p>
        </div>

        {overridden && (
          <LedgerRow
            left={
              <>
                <FieldLabel>The system&rsquo;s verdict</FieldLabel>
                <StatusChip status={row.status} />
                <p className="mt-2 text-[12px] text-ink-faint">
                  Kept on the record. An override never erases it.
                </p>
              </>
            }
            marker="≠"
            right={
              <>
                <FieldLabel>Your verdict</FieldLabel>
                <StatusChip status={row.override_status!} />
                <p className="mt-2 max-w-[46ch] text-[13px] leading-relaxed text-ink-muted">
                  &ldquo;{row.override_reason}&rdquo;
                </p>
                {row.override_at && (
                  <p className="identifier mt-1 text-[11px] text-ink-faint">
                    {new Date(row.override_at).toISOString().slice(0, 19).replace("T", " ")}
                  </p>
                )}
              </>
            }
            last
          />
        )}
      </div>
      </div>
    </div>
  );
}

function ColumnHeader({
  label,
  sub,
  right = false,
  chip,
}: {
  label: string;
  sub: string;
  right?: boolean;
  chip?: React.ReactNode;
}) {
  return (
    <div className={`border-b border-rule bg-paper px-6 py-3 ${right ? "" : "border-r"}`}>
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
        {chip}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-faint">{sub}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-ink-faint">{children}</p>
  );
}

function LedgerRow({
  left,
  right,
  marker,
  last = false,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  marker: string;
  last?: boolean;
}) {
  const edge = last ? "" : "border-b border-rule";
  return (
    <>
      <div className={`border-r border-rule px-6 py-5 ${edge}`}>{left}</div>
      <div
        className={`flex items-center justify-center bg-paper text-[15px] text-ink-faint ${edge}`}
        aria-hidden
      >
        {marker}
      </div>
      <div className={`px-6 py-5 ${edge}`}>{right}</div>
    </>
  );
}
