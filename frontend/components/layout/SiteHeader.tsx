"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

/**
 * Institutional Site Header
 * Restrained, authoritative navigation for public procurement officers.
 * No floating bouncy pills or glowing backgrounds.
 */
export function SiteHeader() {
  const pathname = usePathname();

  const navItems = [
    { href: "/tenders", label: "Tenders" },
    { href: "/command", label: "Engine Pipeline" },
    { href: "/problem-statement", label: "Problem Brief" },
    { href: "/about-us", label: "Project Team" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur-xs">
      <div className="mx-auto flex h-[58px] max-w-[1240px] items-center justify-between gap-4 px-6">
        {/* Brand & Context */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-seal text-white font-serif font-bold text-xs tracking-wider">
              VC
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-[16px] font-semibold tracking-tight text-ink leading-none">
                Vericore
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint leading-tight mt-0.5">
                Bid Verification
              </span>
            </div>
          </Link>
          <span className="hidden sm:inline-block h-4 w-px bg-rule mx-1" aria-hidden="true" />
          <span className="hidden sm:inline-flex items-center rounded-[2px] bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted">
            CPCL / GeM SIH26100
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex items-center gap-1" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-[3px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-seal-tint text-seal font-semibold"
                    : "text-ink-muted hover:text-ink hover:bg-surface-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/tenders/new"
            className="hidden md:inline-flex items-center rounded-[3px] border border-seal bg-seal px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-seal-strong"
          >
            + New Tender
          </Link>
        </div>
      </div>
    </header>
  );
}