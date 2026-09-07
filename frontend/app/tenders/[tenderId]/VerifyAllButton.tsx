"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyAllBids } from "../../lib/api";

export function VerifyAllButton({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleVerify() {
    setError(null);
    setDone(false);
    setVerifying(true);
    try {
      await verifyAllBids(tenderId);
      setDone(true);
      router.refresh();
      // Force reload of server component data — refresh is soft, so also trigger hard reload after short delay for comparison matrix
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleVerify}
        disabled={verifying}
        className="inline-flex items-center gap-2 rounded-[4px] bg-seal px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
      >
        {verifying ? "Verifying all bidders…" : done ? "✓ Verified — refreshing…" : "Verify all bidders"}
      </button>
      {error && (
        <p className="max-w-[40ch] text-[12px] leading-relaxed" style={{ color: "var(--failed)" }}>
          {error}
        </p>
      )}
      {done && !error && (
        <p className="text-[12px] text-ink-muted">Done. The matrix below is now up to date.</p>
      )}
    </div>
  );
}
