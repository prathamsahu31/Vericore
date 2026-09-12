"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// Render free-tier sleeps after ~15 min inactivity and takes 50-60s to wake.
// We poll /health with a short timeout so the UI can explain, rather than hang.
export type BackendStatus = "checking" | "online" | "waking" | "offline";

export interface UseBackendHealthOptions {
  /** Poll every N ms while waking/offline. Default 4000 */
  pollIntervalMs?: number;
  /** Consider waking after this many consecutive failures. Default 1 */
  wakingAfterFailures?: number;
  /** Per-request timeout ms. Default 5000 */
  timeoutMs?: number;
  /** Keep-alive ping interval once online (prevents Render sleep). Default 14*60*1000 (14 min) */
  keepAliveIntervalMs?: number;
  /** Auto-start polling on mount. Default true */
  autoStart?: boolean;
}

export function useBackendHealth(opts: UseBackendHealthOptions = {}) {
  const {
    pollIntervalMs = 4000,
    timeoutMs = 5000,
    keepAliveIntervalMs = 14 * 60 * 1000,
    autoStart = true,
  } = opts;

  const [status, setStatus] = useState<BackendStatus>("checking");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const checkOnce = useCallback(async (): Promise<boolean> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Use /health — liveness only, no DB. Fast even while waking; avoids DB timeout noise.
      // Add cache-buster so CDN/browser doesn't serve stale failure.
      const res = await fetch(`${BASE}/health?_=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
        // keepalive keeps the request alive across navigations
        keepalive: true,
      });
      if (res.ok) return true;
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(id);
    }
  }, [timeoutMs]);

  const probe = useCallback(async () => {
    if (!mountedRef.current) return;
    const ok = await checkOnce();
    if (!mountedRef.current) return;
    setLastCheckedAt(new Date());
    if (ok) {
      setStatus("online");
      setElapsedMs(0);
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
      // keep the backend warm while the tab is open
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        // fire-and-forget keep-alive — don't disturb UI state on failure
        checkOnce();
      }, keepAliveIntervalMs);
      return true;
    }
    // not ok
    setAttempts((a) => a + 1);
    // first failure -> waking, persistent failure -> offline but still retrying
    setStatus((prev) => (prev === "checking" ? "waking" : prev === "online" ? "waking" : prev));
    if (!startRef.current) startRef.current = Date.now();
    if (!elapsedRef.current) {
      elapsedRef.current = setInterval(() => {
        if (startRef.current) setElapsedMs(Date.now() - startRef.current);
      }, 250);
    }
    return false;
  }, [checkOnce, keepAliveIntervalMs]);

  const retryNow = useCallback(async () => {
    setStatus("checking");
    await probe();
  }, [probe]);

  useEffect(() => {
    mountedRef.current = true;
    if (!autoStart) return;
    // kick off immediately
    probe();
    // poll while not online
    timerRef.current = setInterval(() => {
      // only poll if not online — if online, keepAliveRef handles it
      setStatus((s) => {
        if (s === "online") return s;
        // trigger probe async — don't block interval
        probe();
        return s;
      });
    }, pollIntervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // tab came back — re-check immediately (Render may have slept)
        probe();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, [autoStart, pollIntervalMs, probe]);

  // Derive a friendly estimate: Render cold start is typically 50-60s.
  const estimatedTotalMs = 55_000;
  const progress = status === "online" ? 100 : Math.min(92, Math.round((elapsedMs / estimatedTotalMs) * 100));
  // After ~75s of waking without success, show offline copy but keep retrying
  const showOfflineCopy = status !== "online" && elapsedMs > 75_000;

  return {
    status,
    elapsedMs,
    progress,
    attempts,
    lastCheckedAt,
    showOfflineCopy,
    retryNow,
    isWaking: status === "waking" || status === "checking",
    isOnline: status === "online",
  };
}
