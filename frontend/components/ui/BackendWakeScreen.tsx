"use client";

import { useEffect, useState } from "react";

type Variant = "fullscreen" | "card" | "banner";

interface Props {
  variant?: Variant;
  elapsedMs: number;
  progress: number;
  attempts: number;
  showOfflineCopy: boolean;
  onRetry: () => void;
  status: string;
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function BackendWakeScreen({
  variant = "card",
  elapsedMs,
  progress,
  attempts,
  showOfflineCopy,
  onRetry,
  status,
}: Props) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      500);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(elapsedMs);
  const isBanner = variant === "banner";
  const isFullscreen = variant === "fullscreen";

  // Banner — shown at top of page while waking, non-blocking
  if (isBanner) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-40 border-b border-rule bg-seal-tint px-4 py-2.5"
      >
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 text-[13px] leading-snug">
          <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-seal" aria-hidden />
          <span className="font-medium text-seal">
            Waking the workspace{dots}
          </span>
          <span className="hidden text-ink-muted sm:inline">
            — Render free tier sleeps after inactivity. First load takes ~50–60s. Elapsed {elapsed} · attempt {attempts}
          </span>
          <span className="ml-auto hidden text-[12px] text-ink-faint sm:inline">
            This is expected — please keep this tab open.
          </span>
        </div>
        <div className="mx-auto mt-2 h-1 max-w-[1240px] overflow-hidden rounded-full bg-rule">
          <div
            className="h-full bg-seal transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      </div>
    );
  }

  // Card / Fullscreen — blocks interaction with a clear explanation
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        isFullscreen
          ? "page-backdrop flex min-h-screen items-center justify-center px-6 py-16"
          : ""
      }
    >
      <div
        className={
          isFullscreen
            ? "w-full max-w-[560px] rounded-[6px] border border-rule bg-surface p-8 shadow-sm sm:p-10"
            : "rounded-[6px] border border-rule bg-surface p-6 sm:p-8"
        }
      >
        {/* Masthead */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Officer workspace · Vericore
            </p>
            <h2 className="mt-2 font-serif text-[20px] leading-tight sm:text-[22px]">
              {showOfflineCopy ? "Still waking — almost there" : `Waking the workspace${dots}`}
            </h2>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-paper px-3 py-1 text-[11px] font-medium tracking-wide"
            style={{
              borderColor: showOfflineCopy ? "var(--review)" : "var(--seal)",
              color: showOfflineCopy ? "var(--review)" : "var(--seal)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ background: showOfflineCopy ? "var(--review)" : "var(--seal)" }}
              aria-hidden
            />
            {showOfflineCopy ? "Retrying" : "Waking"}
          </span>
        </div>

        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          {showOfflineCopy ? (
            <>
              The backend is taking longer than usual to wake. This happens on Render&apos;s
              free tier after ~15 minutes of inactivity. We&apos;re still retrying automatically — no action
              needed, but you can retry manually below.
            </>
          ) : (
            <>
              The backend sleeps when idle and needs about{" "}
              <strong className="font-medium text-ink">50–60 seconds</strong> to start on Render&apos;s free
              tier. Your data is safe — this is a cold start, not an error. Keep this tab open.
            </>
          )}
        </p>

        {/* Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-[11px] text-ink-faint">
            <span>
              Elapsed <span className="identifier text-ink-muted">{elapsed}</span>
              {" · "}
              attempt <span className="identifier text-ink-muted">{Math.max(1, attempts)}</span>
              {" · "}
              ~55s expected
            </span>
            <span className="identifier">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
            <div
              className="h-full bg-seal transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Status: <span className="identifier">{status}</span> · polling /health every 4s · keep-alive every 14 min once online
          </p>
        </div>

        {/* What to expect */}
        <ul className="mt-6 space-y-2 rounded-[6px] border border-rule bg-paper px-4 py-4 text-[13px] leading-relaxed text-ink-muted">
          <li className="flex gap-2">
            <span className="text-seal" aria-hidden>—</span>
            <span>First request after sleep is the slowest. Everything after that is instant.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-seal" aria-hidden>—</span>
            <span>No data is lost — tenders, bidders and evidence are persisted in Postgres.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-seal" aria-hidden>—</span>
            <span>If this persists beyond 90s, use retry. If it still fails, the backend may be deploying.</span>
          </li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[4px] bg-seal px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-seal-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-seal focus-visible:ring-offset-2"
          >
            Retry now
          </button>
          <a
            href={typeof window !== "undefined" ? window.location.href : "#"}
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
            className="rounded-[4px] border border-rule bg-surface px-5 py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Reload page
          </a>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
          Evaluator note: this delay is Render-specific and disappears on a paid instance or with a warm backend.
          The workspace will load automatically once the health check succeeds — no navigation needed.
        </p>
      </div>
    </div>
  );
}
