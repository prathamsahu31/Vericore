"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confirmRequirements,
  deleteTender,
  extractRequirements,
  getRequirements,
  getTender,
  resetRequirements,
  updateRequirement,
  uploadNit,
} from "@/lib/api";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BackButton } from "@/components/ui/BackButton";
import Loader from "@/components/layout/Loader";
import type { Requirement, Tender } from "@/types/api";

const officerId = process.env.NEXT_PUBLIC_OFFICER_ID ?? "";

type Stage =
  | { kind: "tender" }
  | { kind: "extracting" }
  | { kind: "review"; requirements: Requirement[]; saving: boolean }
  | { kind: "confirmed" };

export function TenderSetup({ tenderId }: { tenderId: string }) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [nitFile, setNitFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "tender" });
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    getTender(tenderId)
      .then((t) => {
        setTender(t);
        if (t.status === "requirements_extracted") {
          return getRequirements(tenderId).then((rows) => {
            setRequirements(rows);
            if (rows.length > 0) {
              setStage({ kind: "review", requirements: rows, saving: false });
            }
          });
        }
        return undefined;
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Tender could not be loaded."));
  }, [tenderId]);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!nitFile) {
      setError("Choose the NIT file to upload.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await uploadNit(tenderId, nitFile);
      setUploaded(true);
      setUploading(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The NIT could not be uploaded.");
      setUploading(false);
    }
  }

  async function handleExtract() {
    setError(null);
    setStage({ kind: "extracting" });
    try {
      const rows = await extractRequirements(tenderId);
      const updated = await getTender(tenderId);
      setTender(updated);
      setRequirements(rows);
      if (rows.length === 0) {
        setError(
          "No eligibility conditions were found in this PDF. For this demo use seed/tender/nit_darpg_style.pdf (17 criteria in Section 6). RFP Volume 1 is the scope document — the PQ table is in Volume 2 / the NIT. Try re-extracting, or delete this tender and upload the NIT."
        );
        setStage({ kind: "tender" });
        return;
      }
      setStage({ kind: "review", requirements: rows, saving: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Requirements could not be extracted.");
      setStage({ kind: "tender" });
    }
  }

  async function handleConfirm() {
    if (!officerId) {
      setError("No officer is signed in (NEXT_PUBLIC_OFFICER_ID is unset).");
      return;
    }
    setError(null);
    setStage((s) => (s.kind === "review" ? { ...s, saving: true } : s));
    try {
      await confirmRequirements(tenderId, officerId);
      const updated = await getTender(tenderId);
      setTender(updated);
      setStage({ kind: "confirmed" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The checklist could not be confirmed.");
      setStage((s) => (s.kind === "review" ? { ...s, saving: false } : s));
    }
  }

  async function handleReset() {
    if (!confirm("Clear this checklist so you can re-extract? This deletes the current draft checklist.")) return;
    setResetting(true);
    setError(null);
    try {
      const updated = await resetRequirements(tenderId);
      setTender(updated);
      setRequirements([]);
      setStage({ kind: "tender" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset checklist.");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete tender "${tender?.title ?? tenderId}"? This removes its checklist and all bids. This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTender(tenderId);
      window.location.href = "/tenders";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setDeleting(false);
    }
  }

  if (!tender && !error) {
    return <Skeleton />;
  }

  if (error && !tender) {
    return (
      <div className="page-backdrop min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[62ch] px-6 py-24">
          <h1 className="text-[24px]">This tender could not be loaded</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{error}</p>
        </main>
      </div>
    );
  }

  const confirmed = tender?.status === "requirements_confirmed";

  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-6 py-10">
        <BackButton />
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">Tender setup</p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight">{tender?.title}</h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          {tender?.bid_number && <span className="identifier">{tender.bid_number} · </span>}
          {tender?.bid_due_date && (
            <>
              bid due <span className="identifier">{tender.bid_due_date}</span>
            </>
          )}
        </p>

        <div className="mt-8 space-y-8">
          {confirmed ? (
            <ConfirmedStage tenderId={tenderId} />
          ) : stage.kind === "confirmed" ? (
            <ConfirmedStage tenderId={tenderId} />
          ) : (
            <>
              <UploadStage
                uploaded={uploaded}
                uploading={uploading}
                nitFile={nitFile}
                setNitFile={setNitFile}
                onUpload={handleUpload}
                extracted={tender?.status === "requirements_extracted"}
                onExtract={handleExtract}
                extracting={stage.kind === "extracting"}
                hasDrafts={requirements.length > 0}
              />

              {stage.kind === "review" && (
                <>
                  <ReviewStage
                    requirements={stage.requirements}
                    onPatch={async (id, patch) => {
                      const updated = await updateRequirement(id, patch);
                      setRequirements((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
                      setStage((s) =>
                        s.kind === "review"
                          ? { ...s, requirements: s.requirements.map((r) => (r.id === updated.id ? updated : r)) }
                          : s,
                      );
                    }}
                  />
                  <ConfirmBar saving={stage.saving} onConfirm={handleConfirm} />
                </>
              )}
            </>
          )}
        </div>

        {error && (
          <p
            className="mt-6 rounded-[4px] border px-4 py-3 text-[14px]"
            style={{
              borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)",
              color: "var(--failed)",
            }}
          >
            {error}
          </p>
        )}

        <p className="mt-10 border-t border-rule pt-5 text-[13px] text-ink-faint">
          Went through the checklist already?{" "}
          <Link href={`/tenders/${tenderId}`} className="text-seal hover:underline">
            Compare the bidders on this tender
          </Link>
          , or{" "}
          <Link href={`/tenders/${tenderId}/bidders/new`} className="text-seal hover:underline">
            add a bidder&rsquo;s documents
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function UploadStage({
  uploaded,
  uploading,
  nitFile,
  setNitFile,
  onUpload,
  extracted,
  onExtract,
  extracting,
  hasDrafts,
}: {
  uploaded: boolean;
  uploading: boolean;
  nitFile: File | null;
  setNitFile: (f: File | null) => void;
  onUpload: (e: React.FormEvent) => void;
  extracted: boolean;
  onExtract: () => void;
  extracting: boolean;
  hasDrafts: boolean;
}) {
  if (extracted && hasDrafts) {
    return (
      <section className="rounded-[6px] border border-rule bg-surface p-6">
        <h2 className="text-[16px]">Step 2 — confirm the checklist</h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">
          The checklist below was read from the NIT. Review each condition and
          correct anything that is wrong before confirming.
        </p>
      </section>
    );
  }

  if (extracted && !uploaded) {
    return (
      <section className="rounded-[6px] border border-rule bg-surface p-6">
        <h2 className="text-[16px]">No conditions were read from this NIT</h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">
          The eligibility section was not found here, so the checklist is empty.
          Upload a different NIT (or the correct tender document) and extract
          again.
        </p>
        <form onSubmit={onUpload} className="mt-4 space-y-3">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setNitFile(e.target.files?.[0] ?? null)}
            className="block w-full text-[14px] text-ink-muted file:mr-4 file:rounded-[4px] file:border-0 file:bg-seal-tint file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-seal"
          />
          {uploading ? (
            <div className="mt-6 flex flex-col items-center justify-center py-4">
              <Loader />
              <p className="mt-6 text-[14px] text-ink-muted">Uploading…</p>
            </div>
          ) : (
            <button
              type="submit"
              className="rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-opacity"
            >
              Upload NIT
            </button>
          )}
        </form>
      </section>
    );
  }

  if (uploaded) {
    return (
      <section className="rounded-[6px] border border-rule bg-surface p-6">
        <h2 className="text-[16px]">NIT uploaded</h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">
          {nitFile?.name} is stored. Extract the eligibility conditions into a
          structured checklist for your review.
        </p>
        {extracting ? (
          <div className="mt-8 flex flex-col items-center justify-center py-4">
            <Loader />
            <p className="mt-6 text-[14px] text-ink-muted">Reading the tender…</p>
          </div>
        ) : (
          <button
            onClick={onExtract}
            className="mt-4 rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-opacity"
          >
            Extract requirements
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[6px] border border-rule bg-surface p-6">
      <h2 className="text-[16px]">Step 1 — upload the NIT</h2>
      <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">
        The notice inviting tender (NIT or RFP). Vericore reads its eligibility
        conditions into a checklist you will confirm before any bidder is verified.
      </p>
      <form onSubmit={onUpload} className="mt-4 space-y-3">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setNitFile(e.target.files?.[0] ?? null)}
          className="block w-full text-[14px] text-ink-muted file:mr-4 file:rounded-[4px] file:border-0 file:bg-seal-tint file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-seal"
        />
        {uploading ? (
          <div className="mt-8 flex flex-col items-center justify-center py-4">
            <Loader />
            <p className="mt-6 text-[14px] text-ink-muted">Uploading…</p>
          </div>
        ) : (
          <button
            type="submit"
            className="rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-opacity"
          >
            Upload NIT
          </button>
        )}
      </form>
    </section>
  );
}

// Human labels for the structured fields an officer needs to verify.
const CATEGORY_LABEL: Record<string, string> = {
  statutory: "Statutory",
  financial_eligibility: "Financial eligibility",
  experience: "Experience",
  technical: "Technical specification",
  bid_security: "Bid security",
  declarations: "Declarations",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  gst_certificate: "GST certificate",
  pan_card: "PAN card",
  udyam_certificate: "Udyam certificate",
  incorporation_certificate: "Certificate of incorporation",
  financial_statement: "Audited financial statement",
  ca_turnover_certificate: "CA turnover certificate",
  work_order: "Work order / completion certificate",
  iso_certificate: "ISO certificate",
  oem_authorisation: "OEM authorisation letter",
  technical_datasheet: "Technical datasheet",
  declaration_non_blacklisting: "Non-blacklisting declaration",
  emd_instrument: "EMD instrument",
  holding_company_undertaking: "Holding-company undertaking",
  epfo_certificate: "EPFO certificate",
  esic_certificate: "ESIC certificate",
  local_content_certificate: "Local content certificate",
  "*": "Any document",
};

const SCOPE_LABEL: Record<string, string> = {
  lead_only: "Lead bidder only",
  any_member: "Any consortium member",
  all_members: "Every member",
  aggregate: "Combined (aggregate)",
};

const SCOPE_HINT: Record<string, string> = {
  lead_only: "Only the lead (or sole) bidder must meet this.",
  any_member: "If any one member satisfies it, the whole bid does.",
  all_members: "Every member of a consortium must satisfy this individually.",
  aggregate: "Members' values are added together, then compared to the threshold.",
};

function humaniseCondition(condition: Record<string, unknown> | null): string | null {
  if (!condition) return null;
  const op = String(condition.operator ?? ">=");
  const threshold = condition.threshold;
  const unit = String(condition.unit ?? "");
  const field = String(condition.field ?? "");
  // Rupee thresholds — use Indian formatting the officer recognises.
  if (threshold !== undefined && unit === "INR") {
    const cr = Number(threshold) / 10000000;
    const label = cr >= 1 ? `Rs. ${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} crore` : `Rs. ${Number(threshold).toLocaleString("en-IN")}`;
    if (field === "average_annual_turnover") {
      const years = condition.period_years ? ` over the last ${condition.period_years} financial years` : "";
      return `Average turnover ${op} ${label}${years}`;
    }
    if (field === "order_value") {
      const count = condition.min_count ? `${condition.min_count} ` : "";
      const within = condition.within_years ? ` within the last ${condition.within_years} years` : "";
      return `At least ${count}similar work(s) of value ${op} ${label}${within}`;
    }
    if (field === "emd_amount") return `EMD ${op} ${label}`;
    if (field === "net_worth") return `Net worth ${op} ${label}`;
    return `${field.replace(/_/g, " ")} ${op} ${label}`;
  }
  if (threshold !== undefined && unit === "TPD") return `Rated throughput ${op} ${threshold} TPD`;
  if (threshold !== undefined && unit === "percent") return `Local content ${op} ${threshold}%`;
  if (field === "incorporation_date") return `In continuous operation for at least ${threshold} years before the bid due date`;
  if (field === "valid_until") return "Certificate must be valid on the bid due date";
  if (threshold !== undefined) return `${field.replace(/_/g, " ")} ${op} ${threshold}${unit ? ` ${unit}` : ""}`;
  return null;
}

function ReviewStage({
  requirements,
  onPatch,
}: {
  requirements: Requirement[];
  onPatch: (id: string, patch: Parameters<typeof updateRequirement>[1]) => Promise<void>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);

  // Group by category so the officer reads the checklist the way the tender groups it.
  const grouped = (() => {
    const order = ["statutory", "financial_eligibility", "experience", "technical", "bid_security", "declarations"];
    const buckets = new Map<string, Requirement[]>();
    for (const r of requirements) {
      const key = r.category ?? "other";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }
    return [...buckets.entries()].sort(
      (a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99),
    );
  })();

  return (
    <section className="overflow-hidden rounded-[6px] border border-rule bg-surface">
      <div className="border-b border-rule px-7 py-5">
        <h2 className="text-[20px]">Step 2 — confirm the checklist</h2>
        <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-ink-muted">
          Each condition was read from the NIT. Check that the threshold, scope, and
          document mapping are right — a misread number here would silently corrupt every
          bidder checked against it. Mark anything wrong before pressing confirm.
        </p>
      </div>
      <ul className="divide-y divide-rule">
        {requirements.map((r) => (
          <li key={r.id} className="px-7 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-[58ch]">
                <p className="flex items-center gap-2">
                  <span className="identifier text-[12px] text-ink-faint">{r.code}</span>
                  <span
                    className={`rounded-[3px] px-2 py-0.5 text-[11px] font-medium ${r.mandatory
                        ? "text-seal"
                        : "bg-paper text-ink-faint"
                      }`}
                    style={
                      r.mandatory
                        ? {
                          background:
                            "color-mix(in srgb, var(--seal) 14%, transparent)",
                        }
                        : undefined
                    }
                  >
                    {r.mandatory ? "Mandatory" : "Optional"}
                  </span>
                  {r.edited_by_officer && (
                    <span className="text-[11px]" style={{ color: "var(--review)" }}>
                      edited
                    </span>
                  )}
                </p>
                <input
                  defaultValue={r.name}
                  disabled={savingId === r.id}
                  onBlur={async (e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== r.name) {
                      setSavingId(r.id);
                      try {
                        await onPatch(r.id, { name: e.target.value.trim() });
                      } finally {
                        setSavingId(null);
                      }
                    }}
                    className="mt-2 w-full rounded-[4px] border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-medium outline-none hover:border-rule focus:border-seal"
                    aria-label={`Rename ${r.code}`}
                  />

                  {/* What the system understood — the core of the review */}
                  <div className="mt-2 rounded-[4px] border border-rule bg-paper px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                      What this means
                    </p>
                    {r.normalized_clause && (
                      <p className="mt-1 text-[14px] leading-relaxed text-ink">
                        {r.normalized_clause}
                      </p>
                    )}
                    {humanCondition ? (
                      <p className={`text-[13px] font-medium leading-snug ${r.normalized_clause ? "mt-1.5 text-ink-muted" : "mt-1 text-ink"}`}>
                        ↳ {humanCondition}
                      </p>
                    ) : r.condition ? (
                      <p className="identifier mt-1 text-[13px] text-ink">
                        {JSON.stringify(r.condition)}
                      </p>
                    ) : !r.normalized_clause ? (
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        No numeric threshold — the system will check that the expected document
                        was submitted and, where the wording is prose, refer it to you.
                      </p>
                    ) : null}

                    {/* Applicability hint */}
                    {r.applicability_scope && SCOPE_HINT[r.applicability_scope] && (
                      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                        Applies to: <span className="font-medium text-ink-muted">{SCOPE_LABEL[r.applicability_scope] ?? r.applicability_scope}</span>
                        {" — "}{SCOPE_HINT[r.applicability_scope]}
                      </p>
                    )}

                    {/* Documents that can satisfy this */}
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                      Satisfied by:{" "}
                      {r.accepts_document_types.length
                        ? r.accepts_document_types.map((t) => DOC_TYPE_LABEL[t] ?? t).join(", ")
                        : "any document (no specific type mapped)"}
                      {r.accepts_document_types.includes("*") && (
                        <span className="ml-1 italic">— this condition checks consistency across all documents</span>
                      )}
                    </p>

                    {r.external_check && (
                      <p className="mt-1 text-[12px] text-ink-faint">
                        External check: <span className="identifier font-medium text-ink-muted">{r.external_check}</span>
                        <span className="ml-1.5 rounded-[3px] border px-1.5 py-px text-[10px]" style={{ borderColor: "color-mix(in srgb, var(--review) 30%, transparent)", color: "var(--review)", background: "color-mix(in srgb, var(--review) 8%, transparent)" }}>
                          simulated
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Source clause — collapsible so the card doesn't double in height */}
                  {r.raw_clause && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] text-ink-faint hover:text-ink-muted">
                        Source text from the NIT
                        {r.source_clause_ref && (
                          <span className="identifier ml-1.5">§ {r.source_clause_ref}</span>
                        )}
                        {r.source_page && <span className="ml-1">· p. {r.source_page}</span>}
                        {r.extraction_confidence !== null && (
                          <span className="ml-1.5 text-[11px]">
                            · confidence {Math.round((r.extraction_confidence ?? 0) * 100)}%
                          </span>
                        )}
                      </summary>
                      <p className="mt-1.5 rounded-[4px] border border-rule bg-paper px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
                        {r.raw_clause}
                      </p>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ConfirmBar({ saving, onConfirm }: { saving: boolean; onConfirm: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-rule bg-surface px-7 py-5">
      <p className="max-w-[54ch] text-[14px] leading-relaxed text-ink-muted">
        Confirming locks this checklist. Re-extracting later would invalidate any
        verdict already formed against it.
      </p>
      <button
        onClick={onConfirm}
        disabled={saving}
        className="rounded-[4px] bg-seal px-6 py-2.5 text-[14px] font-medium text-white transition-opacity disabled:opacity-50"
      >
        {saving ? "Confirming…" : "Confirm checklist"}
      </button>
    </div>
  );
}

function ConfirmedStage({ tenderId }: { tenderId: string }) {
  return (
    <section
      className="rounded-[6px] border px-7 py-6"
      style={{
        borderColor: "color-mix(in srgb, var(--verified) 36%, transparent)",
        background: "color-mix(in srgb, var(--verified) 12%, transparent)",
      }}
    >
      <h2 className="text-[18px]" style={{ color: "var(--verified)" }}>
        Checklist confirmed
      </h2>
      <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">
        The eligibility conditions are locked. You can now add bidders and their
        documents, then run verification against them.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/tenders/${tenderId}/bidders/new`}
          className="rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white"
        >
          Add a bidder&rsquo;s documents
        </Link>
        <Link
          href={`/tenders/${tenderId}`}
          className="rounded-[4px] border border-rule bg-surface px-5 py-2.5 text-[14px] font-medium text-ink-muted hover:text-ink"
        >
          Compare bidders
        </Link>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-10">
      <div className="skeleton h-6 w-40 rounded" />
      <div className="skeleton mt-6 h-32 rounded-[6px]" />
    </main>
  );
}
