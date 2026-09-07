"use client";

import type { ComplianceRow } from "../../types/api";
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
  onClose,
}: {
  row: ComplianceRow | null;
  onClose: () => void;
}) {
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
              <FieldLabel>What the system concluded</FieldLabel>
              <p className="text-[14px] leading-relaxed text-ink">{row.reasoning ?? "—"}</p>
              <p className="mt-2 text-[12px] text-ink-faint">
                Method: {(row.verification_method ?? "—").replace(/_/g, " ")}
                {row.confidence !== null && ` · extraction confidence ${Math.round(row.confidence * 100)}%`}
              </p>
              <p className="mt-1 text-[12px] text-ink-faint">
                {row.evidence_field_ids.length > 0
                  ? `${row.evidence_field_ids.length} value(s) cited from the bidder's documents`
                  : "No values cited — nothing was found to cite"}
              </p>
            </>
          }
          marker={row.external_check_status === "found" ? "=" : row.external_check_portal ? "·" : ""}
          right={
            row.external_check_portal ? (
              <>
                <FieldLabel>Register response</FieldLabel>
                <p className="text-[14px] text-ink">
                  {row.external_check_status === "found"
                    ? "A matching record was returned."
                    : row.external_check_status === "not_found"
                      ? "No record returned for this identifier."
                      : row.external_check_status === "unavailable"
                        ? "The check could not be run."
                        : row.external_check_status}
                </p>
                <p className="mt-2 text-[12px] text-ink-faint">
                  This result did not come from a live government system. It stands in
                  for the integration that would run once partner access exists.
                </p>
              </>
            ) : (
              <p className="text-[13px] text-ink-faint">
                This condition is answered from the bidder&rsquo;s own documents. No
                register is consulted.
              </p>
            )
          }
        />

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
