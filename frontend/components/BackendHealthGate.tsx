"use client";

import { createContext, useContext, useMemo } from "react";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { BackendWakeScreen } from "@/components/ui/BackendWakeScreen";

type GateMode = "banner" | "fullscreen" | "silent";

const BackendHealthContext = createContext<ReturnType<typeof useBackendHealth> | null>(null);

export function useBackendHealthContext() {
  return useContext(BackendHealthContext);
}

/**
 * Global warm-up gate for Render free-tier cold starts (~50-60s).
 *
 * - Polls /health on mount, every 4s while waking, and keep-alive every 14 min once online.
 * - `banner` (default): shows a sticky non-blocking banner while waking; children stay visible.
 * - `fullscreen`: blocks children with the full wake card until online (use on critical flows).
 * - `silent`: no UI, just provides context + keep-alive (useful if per-page UI is preferred).
 *
 * The provider is mounted once in layout.tsx so the warm-up starts on first paint,
 * before any page fetches its own data.
 */
export function BackendHealthGate({
  children,
  mode = "banner",
}: {
  children: React.ReactNode;
  mode?: GateMode;
}) {
  const health = useBackendHealth();

  const ctxValue = useMemo(() => health, [health]);

  const showBanner = mode === "banner" && !health.isOnline;
  const showFullscreen = mode === "fullscreen" && !health.isOnline;

  // Silent still polls via the hook — just no UI.

  if (showFullscreen) {
    return (
      <BackendHealthContext.Provider value={ctxValue}>
        <BackendWakeScreen
          variant="fullscreen"
          elapsedMs={health.elapsedMs}
          progress={health.progress}
          attempts={health.attempts}
          showOfflineCopy={health.showOfflineCopy}
          onRetry={health.retryNow}
          status={health.status}
        />
      </BackendHealthContext.Provider>
    );
  }

  return (
    <BackendHealthContext.Provider value={ctxValue}>
      {showBanner && (
        <BackendWakeScreen
          variant="banner"
          elapsedMs={health.elapsedMs}
          progress={health.progress}
          attempts={health.attempts}
          showOfflineCopy={health.showOfflineCopy}
          onRetry={health.retryNow}
          status={health.status}
        />
      )}
      {children}
    </BackendHealthContext.Provider>
  );
}

/**
 * Inline fallback for server-component pages that failed to fetch.
 * Use inside a `catch` branch where the server had no chance to show the banner.
 * It re-uses the same health hook so the retry is shared with the global gate if present.
 */
export function BackendWakeFallback({ message }: { message?: string }) {
  const health = useBackendHealth();
  if (health.isOnline) {
    return (
      <div className="rounded-[6px] border border-rule bg-surface p-6 text-[14px] leading-relaxed text-ink-muted">
        <p>Backend is back online. <button onClick={() => window.location.reload()} className="font-medium text-seal underline">Reload</button> to continue.</p>
        {message && <p className="mt-2 text-[13px] text-ink-faint">{message}</p>}
      </div>
    );
  }
  return (
    <BackendWakeScreen
      variant="card"
      elapsedMs={health.elapsedMs}
      progress={health.progress}
      attempts={health.attempts}
      showOfflineCopy={health.showOfflineCopy}
      onRetry={health.retryNow}
      status={health.status}
    />
  );
}
