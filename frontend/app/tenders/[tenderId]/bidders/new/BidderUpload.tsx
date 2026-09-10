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
} from "@/lib/api";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { IngestionMode, Tender, UploadResult } from "@/types/api";
import {
  ArrowLeft,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileText,
  RotateCw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

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

  const [step, setStep] = useState<"bidder" | "documents" | "verifying">("bidder");
  const [bidId, setBidId] = useState<string | null>(null);

  // Bidder KYC fields
  const [legalName, setLegalName] = useState("");
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [udyam, setUdyam] = useState("");

  // Document upload state
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
            "This tender's checklist is not confirmed yet. Automated verification runs only after the checklist is locked.",
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
      setError("Bidder legal corporate name is mandatory.");
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
      setNotice(`Bid record created for ${bidder.legal_name}.`);
      setStep("documents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The bid record could not be created.");
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
    for (const file of pending) {
      try {
        const result = await uploadDocument(
          bidId,
          file,
          ingestionMode,
          ingestionMode === "separate" ? docType : undefined,
        );
        setUploads((prev) => [...prev, result]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "One or more document uploads failed.");
      }
    }
    setUploading(false);
  }

  async function handleRunVerification() {
    if (!bidId) return;
    setError(null);
    setStep("verifying");
    try {
      await verifyBid(bidId);
      router.push(`/bids/${bidId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification pipeline failed.");
      setStep("documents");
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-6 py-10">
        <div className="mb-4">
          <Link
            href={`/tenders/${tenderId}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to tender comparison</span>
          </Link>
        </div>

        <div className="border-b border-rule pb-6 mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-seal" />
              <p className="text-[11px] font-mono uppercase font-bold tracking-[0.14em] text-ink-faint">
                Bidder Document Submission
              </p>
            </div>
            <h1 className="mt-1 font-serif text-[26px] font-semibold text-ink leading-tight">
              Add Bidder to Tender
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              Tender: <span className="font-semibold text-ink">{tender?.title ?? "Loading…"}</span>
            </p>
          </div>
        </div>

        {notice && (
          <div className="mb-6 rounded-[4px] border border-review-border bg-review-bg p-4 text-[13px] text-review flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-[4px] border border-failed-border bg-failed-bg p-4 text-[13px] text-failed flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Bidder KYC Particulars */}
        {step === "bidder" && (
          <div className="rounded-[4px] border border-rule bg-surface p-7 panel-shadow space-y-6">
            <div>
              <h2 className="font-serif text-[18px] font-semibold text-ink">
                Step 1: Bidder Identification & Statutory KYC
              </h2>
              <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
                Provide the statutory identifiers declared by the bidder in their bid submission.
                These identifiers are cross-referenced with certificates uploaded in Step 2.
              </p>
            </div>

            <form onSubmit={handleCreateBidder} className="space-y-5">
              <div>
                <label htmlFor="bidder-legal-name" className="block text-[13px] font-semibold text-ink mb-1">
                  Legal Corporate Entity Name <span className="text-failed">*</span>
                </label>
                <input
                  id="bidder-legal-name"
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Larsen & Toubro Hydrocarbon Engineering Limited"
                  className="w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label htmlFor="bidder-pan" className="block text-[13px] font-semibold text-ink mb-1">
                    Permanent Account Number (PAN)
                  </label>
                  <input
                    id="bidder-pan"
                    type="text"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="e.g. AAACL1234F"
                    className="identifier w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">10-character alphanumeric</p>
                </div>

                <div>
                  <label htmlFor="bidder-gstin" className="block text-[13px] font-semibold text-ink mb-1">
                    GSTIN Registration Number
                  </label>
                  <input
                    id="bidder-gstin"
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 07AAACL1234F1Z5"
                    className="identifier w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">15-character GSTIN format</p>
                </div>

                <div>
                  <label htmlFor="bidder-udyam" className="block text-[13px] font-semibold text-ink mb-1">
                    Udyam Registration Number
                  </label>
                  <input
                    id="bidder-udyam"
                    type="text"
                    value={udyam}
                    onChange={(e) => setUdyam(e.target.value.toUpperCase())}
                    placeholder="e.g. UDYAM-MH-12-0012345"
                    className="identifier w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">For MSME preference / EMD relaxation</p>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-[3px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white hover:bg-seal-strong transition-colors"
                >
                  <span>Proceed to Document Upload</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Upload Documents */}
        {step === "documents" && (
          <div className="space-y-6">
            <div className="rounded-[4px] border border-rule bg-surface p-7 panel-shadow space-y-5">
              <div>
                <h2 className="font-serif text-[18px] font-semibold text-ink">
                  Step 2: Upload Bidder Evidence Documents
                </h2>
                <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
                  Upload bidder PDFs. You can upload a single combined bundle (auto-classified by PyMuPDF / LLM) or individual classified files.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`rounded-[3px] border p-4 cursor-pointer transition-colors ${
                    ingestionMode === "auto_classify"
                      ? "border-seal bg-seal-tint"
                      : "border-rule bg-surface hover:bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-[13px] text-ink">
                    <input
                      type="radio"
                      name="ingestion_mode"
                      value="auto_classify"
                      checked={ingestionMode === "auto_classify"}
                      onChange={() => setIngestionMode("auto_classify")}
                      className="text-seal"
                    />
                    <span>Auto-Classify Bundle (Recommended)</span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-muted pl-5">
                    Upload a 50–100 page consolidated PDF. Vericore isolates segments, bookmarks, and doc types automatically.
                  </p>
                </label>

                <label
                  className={`rounded-[3px] border p-4 cursor-pointer transition-colors ${
                    ingestionMode === "separate"
                      ? "border-seal bg-seal-tint"
                      : "border-rule bg-surface hover:bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-[13px] text-ink">
                    <input
                      type="radio"
                      name="ingestion_mode"
                      value="separate"
                      checked={ingestionMode === "separate"}
                      onChange={() => setIngestionMode("separate")}
                      className="text-seal"
                    />
                    <span>Separate Named Files</span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-muted pl-5">
                    Upload individual documents with declared types (GST, PAN, Audited Accounts, Work Orders).
                  </p>
                </label>
              </div>

              {ingestionMode === "separate" && (
                <div className="rounded-[3px] border border-rule bg-surface-subtle p-3.5">
                  <label htmlFor="doc-type-select" className="block text-[12px] font-semibold text-ink mb-1">
                    Document Classification Type for Selected Files
                  </label>
                  <select
                    id="doc-type-select"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="rounded-[3px] border border-rule bg-surface px-3 py-1.5 text-[13px] text-ink focus:border-seal outline-none"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload Drop Area */}
              <div className="rounded-[4px] border-2 border-dashed border-rule bg-surface-subtle p-8 text-center hover:border-seal transition-colors">
                <UploadCloud size={32} className="mx-auto text-ink-faint mb-2" />
                <label className="block cursor-pointer">
                  <span className="text-[14px] font-medium text-seal hover:underline">
                    Select PDF files to upload
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleAddFiles}
                    className="sr-only"
                  />
                </label>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {files.length > 0 ? (
                    <strong className="font-mono text-ink">{files.length} file(s) queued for upload</strong>
                  ) : (
                    "Supports multiple PDF documents or bundles"
                  )}
                </p>
              </div>

              {files.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-faint font-mono">
                    {files.map((f) => f.name).join(", ")}
                  </span>
                  <button
                    onClick={handleUploadAll}
                    disabled={uploading}
                    className="rounded-[3px] bg-seal px-4 py-2 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : `Upload ${files.length} Document(s)`}
                  </button>
                </div>
              )}

              {/* Uploaded Documents List */}
              {uploads.length > 0 && (
                <div className="border-t border-rule pt-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider font-mono font-semibold text-ink-faint">
                    Processed Documents ({uploads.length})
                  </p>
                  <div className="divide-y divide-rule border border-rule rounded-[3px]">
                    {uploads.map((u, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-surface text-[12px]">
                        <div className="flex items-center gap-2">
                          <FileCheck size={16} className="text-verified" />
                          <span className="font-medium text-ink">{u.document.original_filename}</span>
                        </div>
                        <span className="font-mono text-ink-faint text-[11px]">
                          {u.document.page_count} pp · {u.segments.length} segment(s) · {u.extracted_fields.length} fields isolated
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button: Run Verification */}
              <div className="pt-4 border-t border-rule flex items-center justify-between">
                <p className="text-[12px] text-ink-faint">
                  {uploads.length > 0
                    ? "Documents ready. Run the deterministic compliance engine."
                    : "Upload at least one document bundle to trigger verification."}
                </p>
                <button
                  onClick={handleRunVerification}
                  disabled={uploads.length === 0}
                  className="inline-flex items-center gap-2 rounded-[3px] bg-verified px-6 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 shadow-xs"
                >
                  <ShieldCheck size={16} />
                  <span>Execute Verification Pipeline →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Verifying State */}
        {step === "verifying" && (
          <div className="rounded-[4px] border border-rule bg-surface p-14 text-center panel-shadow space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-seal-tint text-seal animate-spin">
              <RotateCw size={28} />
            </div>
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Executing Multi-Layer Verification Pipeline
            </h2>
            <div className="max-w-[58ch] mx-auto text-[13px] text-ink-muted leading-relaxed space-y-1">
              <p>1. Document segmentation & OCR coordinate extraction</p>
              <p>2. Deterministic threshold and financial average evaluation</p>
              <p>3. Cross-document identity & contradiction checking</p>
              <p>4. Multi-portal adapter validation (live / simulated)</p>
            </div>
            <p className="text-[11px] font-mono text-ink-faint pt-2">
              Redirecting to Officer Inspection Workspace upon completion…
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
