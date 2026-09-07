import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Site-wide wordmark and navigation. The monogram is the "seal" — the deep
 * official navy that anchors the whole identity (CLAUDE.md §11). The wordmark
 * sits beside it in the serif the headings use, so the identity that governs
 * the ledgers also governs the frame around them.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-surface/80 backdrop-blur-sm">
      <div className="mx-auto flex h-[64px] max-w-[1240px] items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-[6px] bg-seal font-serif text-[18px] font-semibold text-white"
          >
            V
          </span>
          <span className="font-serif text-[19px] font-semibold tracking-tight">Vericore</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          <Link
            href="/tenders"
            className="rounded-[4px] px-3 py-2 text-[14px] text-ink-muted transition-colors hover:bg-seal-tint hover:text-seal"
          >
            Tenders
          </Link>
          <Link
            href="/tenders/new"
            className="ml-2 rounded-[4px] bg-seal px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Start a tender
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}