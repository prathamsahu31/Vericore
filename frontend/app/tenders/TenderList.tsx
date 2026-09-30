"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteTender } from "@/lib/api";
import type { Tender } from "@/types/api";

const STATUS_LABEL: Record<Tender["status"], string> = {
  draft: "No checklist yet",
  requirements_extracted: "Checklist ready to confirm",
  requirements_confirmed: "Checklist confirmed",
  closed: "Closed",
};

export function TenderList({ initial }: { initial: Tender[] }) {
  const [tenders, setTenders] = useState<Tender[]>(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete tender "${title}"? This removes its checklist and all bids. This cannot be undone.`)) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteTender(id);
      setTenders((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  if (tenders.length === 0) {
    return (
      <section className="mt-10 rounded-[6px] border border-rule bg-surface p-8">
        <h2 className="text-[16px]">Nothing here yet</h2>
        <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ink-muted">
          Start a new tender to upload a NIT, then confirm its checklist before adding bidders.
        </p>
        {error && <p className="mt-3 text-[13px]" style={{ color: "var(--failed)" }}>{error}</p>}
      </section>
    );
  }

  return (
    <>
      {error && (
        <p className="mt-4 rounded-[4px] border px-4 py-3 text-[13px]" style={{ borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)", color: "var(--failed)" }}>
          {error}
        </p>
      )}
      <ul className="mt-10 divide-y divide-rule overflow-hidden rounded-[6px] border border-rule bg-surface">
        {tenders.map((t) => (
          <li key={t.id} className="flex flex-col gap-4 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[16px]">{t.title}</p>
              <p className="mt-1 text-[12px] text-ink-faint">
                {t.bid_number && <span className="identifier">{t.bid_number} · </span>}
                {STATUS_LABEL[t.status]}
                {t.bid_due_date && (
                  <>
                    {" · bid due "}
                    <span className="identifier">{t.bid_due_date}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
              {t.status !== "requirements_confirmed" ? (
                <Link
                  href={`/tenders/${t.id}/setup`}
                  className="inline-flex h-8 items-center justify-center rounded-[4px] border border-rule px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
                >
                  Review checklist
                </Link>
              ) : (
                <Link
                  href={`/tenders/${t.id}/bidders/new`}
                  className="inline-flex h-8 items-center justify-center rounded-[4px] border border-rule px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
                >
                  Add a bidder
                </Link>
              )}
              <Link
                href={`/tenders/${t.id}`}
                className="inline-flex h-8 items-center justify-center rounded-[4px] border border-rule px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                Compare bidders
              </Link>
              <button
                onClick={() => handleDelete(t.id, t.title)}
                disabled={deletingId === t.id}
                className="inline-flex h-8 items-center justify-center rounded-[4px] border px-4 text-[13px] font-medium transition-colors disabled:opacity-40"
                style={{ borderColor: "color-mix(in srgb, var(--failed) 26%, transparent)", color: "var(--failed)" }}
                title="Delete this tender and its checklist"
              >
                {deletingId === t.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
