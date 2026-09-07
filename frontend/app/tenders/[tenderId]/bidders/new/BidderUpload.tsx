"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createBid,
  createBidder,
  getTender,
  uploadDocument,
  verifyBid,
} from "../../../../lib/api";
import { SiteHeader } from "../../../../components/layout/SiteHeader";
import type { IngestionMode, Tender, UploadResult } from "../../../../types/api";

const DOC_TYPES = [
  "gst_certificate",
  "gst_return_acknowledgement",
  "pan_card",
  "udyam_certificate",
  "incorporation_certificate",
  "financial_statement",
  "work_order",
  "oem_authorisation",
  "emdy",
  "blacklist_declaration",
  "cover_letter",
  "power_of_attorney",
  "bid_security",
  "msme_certificate",
  "other",
];

export function BidderUpload({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [tender, setTender] = useState<Tender | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState<"bidder" | "bid" | "documents" | "verifying">("bidder");
  const [bidId, setBidId] = useState<string | null>(null);

  // Bidder fields
  const [legalName, setLegalName] = useState("");
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [udyam, setUdyam] = useState("");

  // Document upload
  const [ingestionMode, setIngestionMode] = useState<IngestionMode>("auto_classify");
  const [docType, setDocType] = useState("gst_certificate");
  const [files, setFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) return;
    getTender(tenderId)
      .then((t) => {
        setTender(t);
        if (t.status !== "requirements_confirmed") {
          setNotice(
            "This tender's checklist is not confirmed yet. Verification can only run after the checklist is confirmed.",
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Tender could not be loaded."))
      .finally(() => setLoaded(true));
  }, [loaded, tenderId]);

  async function handleCreateBidder(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!legalName.trim()) {
      setError("A bidder needs a legal name.");
      return;
    }
    try {
      const bidder = await createBidder({
        legal_name: legalName.trim(),
        pan: pan.trim() || undefined,
        gstin: gstin.trim() || undefined,
        udyam_urn: udyam.trim() || undefined,
      });
      const bid = await createBid({ tender_id: tenderId, bidder_id: bidder.id });
      setBidId(bid.id);
      setNotice(`Bid created for ${bidder.legal_name}.`);
      setStep("documents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The bid could not be created.");
    }
  }

  async function handleAddFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    setFiles((prev) => [...prev, ...chosen]);
  }

  async function handleUploadAll() {
    if (!bidId) return;
    if (files.length === 0) {
      setError("Select at least one document to upload.");
      return;
    }
    setError(null);
    setUploading(true);
    const pending = [...files];
    setFiles([]);
    let done = 0;
    for (const file of pending) {
      try {
        const result = await uploadDocument(
          bidId,
          file,
          ingestionMode,
          ingestionMode === "separate" ? docType : undefined,
        );
        setUploads((prev) => [...prev, result]);
        if (result.injection_suspected) {
          setNotice(
            (n) => `${n ?? ""}\n${file.name} contained instruction-like text — reported, not followed.`,
          );
        }
      } catch (e) {
        setError((err) =>
          `${err ? err + "\n" : ""}${file.name}: ${e instanceof Error ? e.message : "upload failed"}`,
        );
      } finally {
        done += 1;
      }
    }
    setUploading(false);
  }

  async function handleVerify() {
    if (!bidId) return;
    setError(null);
    setStep("verifying");
    try {
      await verifyBid(bidId);
      router.push(`/bids/${bidId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification could not be run.");
      setStep("documents");
    }
  }

  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[820px] px-6 py-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">Bidder upload</p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight">
          {tender ? tender.title : "Add a bidder"}
        </h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        {tender?.bid_number && <span className="identifier">{tender.bid_number} · </span>}
        {tender?.status === "requirements_confirmed" ? (
          <span style={{ color: "var(--verified)" }}>checklist confirmed</span>
        ) : (
          "checklist not yet confirmed"
        )}
      </p>

      {notice && (
        <p
          className="mt-5 rounded-[4px] border px-4 py-3 text-[13px] leading-relaxed text-ink-muted"
          style={{ borderColor: "var(--rule)", whiteSpace: "pre-line" }}
        >
          {notice}
        </p>
      )}

      {step === "bidder" && (
        <form onSubmit={handleCreateBidder} className="mt-8 space-y-6">
          <section className="rounded-[6px] border border-rule bg-surface p-6">
            <h2 className="text-[16px]">The bidder</h2>
            <p className="mt-1 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
              Bidders are deduplicated across tenders by PAN, so the same company is
              the same row on its next tender. Documents come next.
            </p>
            <div className="mt-5 space-y-5">
              <Field label="Legal name" required>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="PAN">
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="identifier w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
                    placeholder="AABCA1234C"
                    maxLength={10}
                  />
                </Field>
                <Field label="GSTIN">
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="identifier w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
                    placeholder="33AABCA1234C1ZM"
                    maxLength={15}
                  />
                </Field>
                <Field label="Udyam URN">
                  <input
                    type="text"
                    value={udyam}
                    onChange={(e) => setUdyam(e.target.value.toUpperCase())}
                    className="identifier w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
                    placeholder="UDYAM-TN-33-0041827"
                  />
                </Field>
              </div>
            </div>
          </section>

          <button
            type="submit"
            className="rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white"
          >
            Create bid and continue
          </button>
        </form>
      )}

      {step === "documents" && (
        <div className="mt-8 space-y-6">
          <section className="rounded-[6px] border border-rule bg-surface p-6">
            <h2 className="text-[16px]">Upload documents</h2>
            <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
              {ingestionMode === "separate"
                ? "You are labelling each document. Choose its type below."
                : "Vericore will classify each document automatically."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["auto_classify", "separate", "merged"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setIngestionMode(mode)}
                  aria-pressed={ingestionMode === mode}
                  className={`rounded-[4px] border px-3 py-1.5 text-[13px] transition-colors ${
                    ingestionMode === mode
                      ? "border-seal bg-seal-tint font-medium text-seal"
                      : "border-rule text-ink-muted hover:text-ink"
                  }`}
                >
                  {mode === "auto_classify"
                    ? "Auto-classify"
                    : mode === "separate"
                      ? "Tag each document"
                      : "Merged bundle"}
                </button>
              ))}
            </div>

            {ingestionMode === "separate" && (
              <div className="mt-4">
                <Field label="Document type">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="mt-5">
              <input
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={handleAddFiles}
                className="block w-full text-[14px] text-ink-muted file:mr-4 file:rounded-[4px] file:border-0 file:bg-seal-tint file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-seal"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-4">
                <p className="text-[13px] text-ink-muted">
                  {files.length} file{files.length === 1 ? "" : "s"} selected
                </p>
                <button
                  onClick={handleUploadAll}
                  disabled={uploading}
                  className="mt-3 rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-opacity disabled:opacity-50"
                >
                  {uploading ? "Uploading & extracting…" : "Upload documents"}
                </button>
              </div>
            )}

            {uploads.length > 0 && (
              <div className="mt-6 border-t border-rule pt-4">
                <h3 className="text-[14px] font-medium">Uploaded</h3>
                <ul className="mt-2 divide-y divide-rule">
                  {uploads.map((u) => (
                    <li key={u.document.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                      <span className="truncate text-ink">{u.document.original_filename}</span>
                      <span className="shrink-0 text-ink-faint">
                        {u.segments.map((s) => s.doc_type).join(", ") || "unclassified"} ·
                        {u.fields_located} fields located
                        {u.fields_unlocated > 0 ? ` · ${u.fields_unlocated} need review` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleVerify}
                  className="mt-5 rounded-[4px] bg-seal px-6 py-2.5 text-[14px] font-medium text-white"
                >
                  Run verification
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {step === "verifying" && (
        <section className="mt-8 rounded-[6px] border border-rule bg-surface p-6">
          <div className="skeleton h-4 w-64 rounded" />
          <p className="mt-3 text-[14px] text-ink-muted">
            Running the rule engine across the requirements and documents. This
            is deterministic Python plus, where a condition is prose, one
            reasoning call.
          </p>
        </section>
      )}

      {error && (
        <p
          className="mt-6 rounded-[4px] border px-4 py-3 text-[14px]"
          style={{
            borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)",
            color: "var(--failed)",
            whiteSpace: "pre-line",
          }}
        >
          {error}
        </p>
      )}

      <p className="mt-10 border-t border-rule pt-5 text-[13px] text-ink-faint">
        <Link href={`/tenders/${tenderId}`} className="text-seal hover:underline">
          Back to the comparison
        </Link>
        {" · "}
        <Link href={`/tenders/${tenderId}/setup`} className="text-seal hover:underline">
          Tender setup
        </Link>
      </p>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">
        {label}
        {required && <span className="text-ink-faint"> *</span>}
      </span>
      {children}
    </label>
  );
}
