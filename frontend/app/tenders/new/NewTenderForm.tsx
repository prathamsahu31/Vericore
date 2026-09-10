"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTender } from "@/lib/api";
import { ArrowRight, AlertCircle, FilePlus2 } from "lucide-react";

export function NewTenderForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [bidNumber, setBidNumber] = useState("");
  const [buyer, setBuyer] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("A tender title is mandatory to initiate a record.");
      return;
    }
    setBusy(true);
    try {
      const tender = await createTender({
        title: title.trim(),
        bid_number: bidNumber.trim() || undefined,
        buyer_organisation: buyer.trim() || undefined,
        bid_due_date: dueDate || undefined,
        estimated_value: estimatedValue || undefined,
      });
      router.push(`/tenders/${tender.id}/setup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The tender record could not be created.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-[4px] border border-rule bg-surface p-6 panel-shadow space-y-5">
        <div>
          <label htmlFor="tender-title" className="block text-[13px] font-semibold text-ink mb-1">
            Tender Description / Title <span className="text-failed">*</span>
          </label>
          <input
            id="tender-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
            placeholder="e.g. Turnkey EPC for Crude Distillation Unit Overhead Piping Replacement"
            autoFocus
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            Enter the full official description as published in the Notice Inviting Tender (NIT).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="tender-bid-number" className="block text-[13px] font-semibold text-ink mb-1">
              GeM Bid / NIT Reference Number
            </label>
            <input
              id="tender-bid-number"
              type="text"
              value={bidNumber}
              onChange={(e) => setBidNumber(e.target.value)}
              className="identifier w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
              placeholder="e.g. GEM/2026/B/7496914"
            />
          </div>

          <div>
            <label htmlFor="tender-buyer" className="block text-[13px] font-semibold text-ink mb-1">
              Procuring Department / Entity
            </label>
            <input
              id="tender-buyer"
              type="text"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              className="w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
              placeholder="e.g. Chennai Petroleum Corporation Limited (CPCL)"
            />
          </div>

          <div>
            <label htmlFor="tender-due-date" className="block text-[13px] font-semibold text-ink mb-1">
              Bid Submission Due Date
            </label>
            <input
              id="tender-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="identifier w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink focus:border-seal outline-none"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Used by rule engine to verify document validity dates and certificate expiry.
            </p>
          </div>

          <div>
            <label htmlFor="tender-estimated-value" className="block text-[13px] font-semibold text-ink mb-1">
              Estimated Contract Value (₹)
            </label>
            <input
              id="tender-estimated-value"
              type="text"
              inputMode="numeric"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className="identifier w-full rounded-[3px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-seal outline-none"
              placeholder="e.g. 150000000"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Used for EMD, turnover ratios, and net worth threshold ratios.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[4px] border border-failed-border bg-failed-bg p-3.5 text-[13px] text-failed flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-[12px] text-ink-faint">
          Next step: Upload Notice Inviting Tender (NIT) and confirm extracted checklist.
        </p>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[3px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white hover:bg-seal-strong transition-colors disabled:opacity-50 shadow-xs"
        >
          <FilePlus2 size={15} />
          <span>{busy ? "Creating Tender Record…" : "Create Record & Proceed to NIT Setup"}</span>
        </button>
      </div>
    </form>
  );
}
