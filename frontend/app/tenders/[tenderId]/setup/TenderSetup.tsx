"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confirmRequirements,
  extractRequirements,
  getRequirements,
  getTender,
  updateRequirement,
  uploadNit,
} from "@/lib/api";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BackButton } from "@/components/ui/BackButton";
import { BackendWakeFallback } from "@/components/BackendHealthGate";
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

  if (!tender && !error) {
    return <Skeleton />;
  }

  if (error && !tender) {
    const isWakeError =
      /fetch|network|load|timeout|Failed|ECONNREFUSED|500|502|503|504/i.test(error) ||
      error.toLowerCase().includes("could not be loaded");
    return (
      <div className="page-backdrop min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[560px] px-6 py-12">
          <BackButton />
          <h1 className="mt-4 font-serif text-[24px] leading-tight">This tender could not be loaded</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{error}</p>
          {isWakeError && (
            <div className="mt-6">
              <BackendWakeFallback />
            </div>
          )}
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
      <section className="rounded-[6px] border border-rule bg-surface p-6 opacity-75">
        <h2 className="text-[16px] text-seal">✓ Step 1 — upload the NIT</h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">
          The notice inviting tender was successfully uploaded and processed.
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

function ReviewStage({
  requirements,
  onPatch,
}: {
  requirements: Requirement[];
  onPatch: (id: string, patch: Parameters<typeof updateRequirement>[1]) => Promise<void>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);

  return (
    <section className="rounded-[6px] border border-rule bg-surface">
      <div className="border-b border-rule px-7 py-5">
        <h2 className="text-[20px]">Step 2 — confirm the checklist</h2>
        <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-ink-muted">
          Each condition was extracted from the NIT beside the source it came
          from. This is a gate: nothing is verified against a checklist nobody
          confirmed. A misread threshold here would silently corrupt every
          downstream verdict.
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
                    }
                  }}
                  className="mt-1 w-full rounded-[4px] border border-transparent bg-transparent px-1 py-0.5 text-[15px] outline-none hover:border-rule focus:border-seal"
                  aria-label={`Rename ${r.code}`}
                />
                {r.raw_clause && (
                  <p className="mt-2 rounded-[4px] border border-rule bg-paper px-3 py-2 text-[12px] leading-relaxed text-ink-faint">
                    Source: {r.raw_clause}
                  </p>
                )}
                <p className="mt-2 text-[12px] text-ink-faint">
                  Accepts: {r.accepts_document_types.length ? r.accepts_document_types.join(", ") : "—"}
                  {r.external_check ? ` · External check: ${r.external_check}` : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                <input
                  type="checkbox"
                  defaultChecked={r.mandatory}
                  disabled={savingId === r.id}
                  onChange={async (e) => {
                    setSavingId(r.id);
                    try {
                      await onPatch(r.id, { mandatory: e.target.checked });
                    } finally {
                      setSavingId(null);
                    }
                  }}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--seal)" }}
                />
                Mandatory
              </label>
            </div>
          </li>
        ))}
      </ul>
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
