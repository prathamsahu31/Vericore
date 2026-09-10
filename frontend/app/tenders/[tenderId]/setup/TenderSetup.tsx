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
import { Identifier } from "@/components/ui/status";
import type { Requirement, Tender } from "@/types/api";
import {
  ArrowLeft,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertCircle,
  Save,
  RotateCw,
  Sparkles,
  Layers,
} from "lucide-react";

const officerId = process.env.NEXT_PUBLIC_OFFICER_ID ?? "CPCL-PROC-OFFICER";

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
        if (t.status === "requirements_confirmed") {
          setStage({ kind: "confirmed" });
        } else if (t.status === "requirements_extracted") {
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
      setError("Please select the official NIT PDF document to upload.");
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
      setError(e instanceof Error ? e.message : "Requirements extraction failed. Verify LLM configuration.");
      setStage({ kind: "tender" });
    }
  }

  async function handleConfirm() {
    if (!officerId) {
      setError("No officer ID detected. Set NEXT_PUBLIC_OFFICER_ID to record statutory confirmation.");
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
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="mx-auto max-w-[800px] px-6 py-20 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-rule rounded mx-auto" />
            <div className="h-10 w-96 bg-rule rounded mx-auto" />
            <div className="h-32 w-full bg-rule rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error && !tender) {
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="mx-auto max-w-[640px] px-6 py-20">
          <div className="rounded-[4px] border border-failed-border bg-failed-bg p-6">
            <h1 className="font-serif text-[20px] font-semibold text-failed">
              Tender Setup Unavailable
            </h1>
            <p className="mt-2 text-[14px] text-ink-muted leading-relaxed">{error}</p>
            <div className="mt-4">
              <Link href="/tenders" className="text-[13px] font-medium text-seal hover:underline">
                ← Return to tender registry
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-6 py-10">
        {/* Navigation Breadcrumb */}
        <div className="mb-4">
          <Link
            href="/tenders"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to tender registry</span>
          </Link>
        </div>

        {/* Header particulars */}
        <div className="border-b border-rule pb-6 mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-seal" />
              <p className="text-[11px] font-mono uppercase font-bold tracking-[0.14em] text-ink-faint">
                Tender Setup & Checklist Lock
              </p>
            </div>
            <h1 className="mt-1 font-serif text-[26px] font-semibold text-ink leading-tight">
              {tender?.title}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {tender?.bid_number && <span className="identifier mr-2">{tender.bid_number}</span>}
              {tender?.buyer_organisation && <span>· {tender.buyer_organisation}</span>}
              {tender?.bid_due_date && <span> · Due: {tender.bid_due_date}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-[3px] border px-2.5 py-1 text-[11px] font-mono font-semibold uppercase ${
                tender?.status === "requirements_confirmed"
                  ? "border-verified-border bg-verified-bg text-verified"
                  : "border-review-border bg-review-bg text-review"
              }`}
            >
              {tender?.status?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* 3-Step Setup Stepper */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className={`rounded-[3px] border p-3.5 transition-colors ${
              stage.kind === "tender"
                ? "border-seal bg-seal-tint text-seal font-semibold"
                : uploaded || stage.kind === "review" || stage.kind === "confirmed"
                  ? "border-verified-border bg-verified-bg text-verified"
                  : "border-rule bg-surface text-ink-muted"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
              <span>STEP 01</span>
              {uploaded || stage.kind === "review" || stage.kind === "confirmed" ? (
                <span>✓ Uploaded</span>
              ) : (
                <span>Active</span>
              )}
            </div>
            <p className="text-[13px] font-medium">Upload Notice Inviting Tender (NIT)</p>
          </div>

          <div
            className={`rounded-[3px] border p-3.5 transition-colors ${
              stage.kind === "extracting"
                ? "border-seal bg-seal-tint text-seal font-semibold"
                : stage.kind === "review" || stage.kind === "confirmed"
                  ? "border-verified-border bg-verified-bg text-verified"
                  : "border-rule bg-surface text-ink-muted"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
              <span>STEP 02</span>
              {stage.kind === "review" || stage.kind === "confirmed" ? (
                <span>✓ Extracted</span>
              ) : stage.kind === "extracting" ? (
                <span>Extracting…</span>
              ) : (
                <span>Pending</span>
              )}
            </div>
            <p className="text-[13px] font-medium">AI Clause Extraction & Codification</p>
          </div>

          <div
            className={`rounded-[3px] border p-3.5 transition-colors ${
              stage.kind === "confirmed"
                ? "border-verified-border bg-verified-bg text-verified font-semibold"
                : stage.kind === "review"
                  ? "border-seal bg-seal-tint text-seal font-semibold"
                  : "border-rule bg-surface text-ink-muted"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
              <span>STEP 03</span>
              {stage.kind === "confirmed" ? <span>✓ Locked</span> : <span>Officer Gate</span>}
            </div>
            <p className="text-[13px] font-medium">Review & Lock Checklist</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-[4px] border border-failed-border bg-failed-bg p-4 text-[13px] text-failed flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stage 1: Upload NIT Document */}
        {stage.kind === "tender" && (
          <div className="rounded-[4px] border border-rule bg-surface p-7 panel-shadow space-y-6">
            <div>
              <h2 className="font-serif text-[18px] font-semibold text-ink">
                Upload Notice Inviting Tender (NIT / RFP)
              </h2>
              <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
                Upload the complete published tender PDF. Vericore reads the free-text clauses to extract eligibility thresholds, turnover ratios, and statutory requirements.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="rounded-[4px] border-2 border-dashed border-rule bg-surface-subtle p-8 text-center hover:border-seal transition-colors">
                <UploadCloud size={32} className="mx-auto text-ink-faint mb-2" />
                <label className="block cursor-pointer">
                  <span className="text-[14px] font-medium text-seal hover:underline">
                    Choose NIT PDF file
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNitFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {nitFile ? (
                    <strong className="font-mono text-ink">{nitFile.name} ({(nitFile.size / 1024 / 1024).toFixed(2)} MB)</strong>
                  ) : (
                    "Standard PDF document (up to 100 pages supported natively)"
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  disabled={uploading || !nitFile}
                  className="rounded-[3px] bg-seal px-5 py-2.5 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors disabled:opacity-40"
                >
                  {uploading ? "Uploading Document…" : "Upload NIT Document"}
                </button>

                {uploaded && (
                  <button
                    type="button"
                    onClick={handleExtract}
                    className="inline-flex items-center gap-1.5 rounded-[3px] bg-verified px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    <Sparkles size={15} />
                    <span>Run AI Requirement Extraction →</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Stage 2: Extraction in progress */}
        {stage.kind === "extracting" && (
          <div className="rounded-[4px] border border-rule bg-surface p-12 text-center panel-shadow space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-seal-tint text-seal animate-spin">
              <RotateCw size={24} />
            </div>
            <h2 className="font-serif text-[20px] font-semibold text-ink">
              Extracting Clauses from Tender Document
            </h2>
            <p className="max-w-[54ch] mx-auto text-[13px] text-ink-muted leading-relaxed">
              The extraction pipeline is reading the NIT prose, identifying statutory conditions, turnover thresholds, and experience criteria, and structuring them into exact clauses.
            </p>
            <p className="text-[11px] font-mono text-ink-faint">
              Usually completes in 10–25 seconds depending on document length.
            </p>
          </div>
        )}

        {/* Stage 3: Review and Lock Checklist */}
        {stage.kind === "review" && (
          <div className="space-y-6">
            <div className="rounded-[4px] border border-rule bg-surface p-6 panel-shadow flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-[18px] font-semibold text-ink">
                  Officer Review: Codified Requirements ({stage.requirements.length})
                </h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Inspect the extracted clauses, adjust weights or mandatory flags if needed, then confirm the checklist to lock it into the audit log.
                </p>
              </div>

              <button
                onClick={handleConfirm}
                disabled={stage.saving}
                className="inline-flex items-center gap-2 rounded-[3px] bg-seal px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-seal-strong transition-colors disabled:opacity-40"
              >
                <Lock size={15} />
                <span>{stage.saving ? "Confirming & Locking…" : "Confirm & Lock Checklist"}</span>
              </button>
            </div>

            {/* Editable Requirements Table */}
            <div className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-rule bg-surface-muted text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      <th className="px-5 py-3 w-[90px]">Code</th>
                      <th className="px-5 py-3">Clause Description</th>
                      <th className="px-5 py-3 w-[110px]">Mandatory</th>
                      <th className="px-5 py-3 w-[100px]">Weight</th>
                      <th className="px-5 py-3 w-[160px]">Scope</th>
                      <th className="px-5 py-3 w-[160px]">External Portal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {stage.requirements.map((req) => (
                      <RequirementRow
                        key={req.id}
                        req={req}
                        onChange={(updated) => {
                          setStage((s) => {
                            if (s.kind !== "review") return s;
                            return {
                              ...s,
                              requirements: s.requirements.map((r) =>
                                r.id === updated.id ? updated : r,
                              ),
                            };
                          });
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Stage 4: Confirmed State */}
        {stage.kind === "confirmed" && (
          <div className="rounded-[4px] border border-verified-border bg-verified-bg p-8 panel-shadow text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-verified text-white">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Checklist Confirmed & Locked
            </h2>
            <p className="max-w-[56ch] mx-auto text-[14px] text-ink-muted leading-relaxed">
              The eligibility checklist has been sealed against officer identity <strong className="font-mono text-ink">{officerId}</strong>.
              You can now add bidder document bundles for automated evidence evaluation.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/tenders/${tenderId}/bidders/new`}
                className="inline-flex items-center gap-1.5 rounded-[3px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white hover:bg-seal-strong transition-colors"
              >
                <span>+ Add Bidder Document Bundle</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href={`/tenders/${tenderId}`}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-rule bg-surface px-5 py-2.5 text-[14px] font-medium text-ink hover:border-ink transition-colors"
              >
                <span>View Comparison Matrix</span>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RequirementRow({
  req,
  onChange,
}: {
  req: Requirement;
  onChange: (updated: Requirement) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleFieldChange(changes: {
    name?: string;
    mandatory?: boolean;
    weight?: number;
    applicability_scope?: string;
    external_check?: string;
  }) {
    setSaving(true);
    try {
      const updated = await updateRequirement(req.id, changes);
      onChange(updated);
    } catch {
      // Keep state if failed
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="hover:bg-surface-subtle transition-colors">
      <td className="px-5 py-3 align-top font-mono text-[11px] font-bold text-ink-muted">
        {req.code}
      </td>

      <td className="px-5 py-3 align-top">
        <input
          type="text"
          value={req.name}
          onChange={(e) => void handleFieldChange({ name: e.target.value })}
          className="w-full rounded-[2px] border border-transparent px-2 py-1 text-[13px] font-medium text-ink hover:border-rule focus:border-seal focus:bg-surface outline-none"
        />
        {req.source_clause_ref && (
          <p className="px-2 text-[11px] text-ink-faint font-mono mt-0.5">
            NIT Source: {req.source_clause_ref}
          </p>
        )}
      </td>

      <td className="px-5 py-3 align-top">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={req.mandatory}
            onChange={(e) => void handleFieldChange({ mandatory: e.target.checked })}
            className="rounded border-rule text-seal focus:ring-seal"
          />
          <span className="text-[12px] text-ink font-medium">
            {req.mandatory ? "Yes" : "No"}
          </span>
        </label>
      </td>

      <td className="px-5 py-3 align-top">
        <input
          type="number"
          step="0.1"
          value={req.weight}
          onChange={(e) => void handleFieldChange({ weight: parseFloat(e.target.value) || 0 })}
          className="w-16 rounded-[2px] border border-rule bg-surface px-2 py-1 text-[12px] font-mono text-ink focus:border-seal outline-none"
        />
      </td>

      <td className="px-5 py-3 align-top">
        <select
          value={req.applicability_scope}
          onChange={(e) => void handleFieldChange({ applicability_scope: e.target.value })}
          className="rounded-[2px] border border-rule bg-surface px-2 py-1 text-[12px] text-ink focus:border-seal outline-none"
        >
          <option value="all_members">All Members</option>
          <option value="lead_only">Lead Only</option>
          <option value="any_member">Any Member</option>
          <option value="aggregate">Aggregate</option>
        </select>
      </td>

      <td className="px-5 py-3 align-top">
        <select
          value={req.external_check ?? ""}
          onChange={(e) => void handleFieldChange({ external_check: e.target.value || undefined })}
          className="rounded-[2px] border border-rule bg-surface px-2 py-1 text-[12px] font-mono text-ink focus:border-seal outline-none"
        >
          <option value="">None (Doc only)</option>
          <option value="gstn">GSTN</option>
          <option value="pan">PAN</option>
          <option value="udyam">Udyam</option>
          <option value="mca21">MCA21</option>
          <option value="debarment">Debarment</option>
        </select>
      </td>
    </tr>
  );
}
