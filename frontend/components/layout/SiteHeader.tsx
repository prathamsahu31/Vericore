"use client";
import Link from "next/link";
import { AnimatedBackground } from "@/components/core/animated-background";
/**
 * Site-wide wordmark and navigation. The monogram is the "seal" — the deep
 * official navy that anchors the whole identity (CLAUDE.md §11). The wordmark
 * sits beside it in the serif the headings use, so the identity that governs
 * the ledgers also governs the frame around them.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-surface/20 backdrop-blur-sm">
      <div className="mx-auto flex h-[64px] max-w-[1240px] items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <img src="logo.png" alt="Logo" height={25} width={25} />
          <span className="text-[15px] font-semibold tracking-tight text-navy-blue leading-none">
            Vericore
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          <AnimatedBackground
            className="rounded-[4px] bg-seal-tint" // The background color of the hover pill
            transition={{
              type: 'spring',
              bounce: 0.2,
              duration: 0.3,
            }}
            enableHover
          >
            <Link
              data-id="problem-statement"
              href="/problem-statement"
              className="rounded-[4px] px-3 py-2 text-[14px] transition-colors hover:text-seal"
            >
              Problem Statement
            </Link>
            <Link
              data-id="about-us"
              href="/about-us"
              className="rounded-[4px] px-3 py-2 text-[14px] text-navy transition-colors hover:text-seal">
              About Us
            </Link>
          </AnimatedBackground>
        </nav>
      </div>
    </header>
  );
}