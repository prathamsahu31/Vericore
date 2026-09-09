"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTender } from "@/lib/api";

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
      setError("A tender needs a title before it can be saved.");
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
      setError(err instanceof Error ? err.message : "The tender could not be created.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <Field label="Tender title" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
          placeholder="e.g. Supply and installation of corrosion-resistant piping system"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Bid number">
          <input
            type="text"
            value={bidNumber}
            onChange={(e) => setBidNumber(e.target.value)}
            className="identifier w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
            placeholder="e.g. NIT/CPCL/SR/2026/001"
          />
        </Field>
        <Field label="Buyer organisation">
          <input
            type="text"
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
            placeholder="e.g. Chennai Petroleum Corporation Limited"
          />
        </Field>
        <Field label="Bid due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="identifier w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
          />
        </Field>
        <Field label="Estimated value (₹)">
          <input
            type="text"
            inputMode="numeric"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            className="identifier w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-[15px] outline-none focus:border-seal"
            placeholder="e.g. 620000000"
          />
        </Field>
      </div>

      {error && (
        <p
          className="rounded-[4px] border px-4 py-3 text-[14px]"
          style={{
            borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)",
            color: "var(--failed)",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-[4px] bg-seal px-5 py-2.5 text-[14px] font-medium text-white transition-opacity disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create tender"}
      </button>
    </form>
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
