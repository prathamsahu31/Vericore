"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Tenders", href: "/tenders" },
  { label: "New Tender", href: "/tenders/new" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);


  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
        ? "bg-[#080808]/80 backdrop-blur-2xl shadow-lg"
        : ""
        }`}
    >
      <div className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <img src="logo.png" alt="Logo" height={25} width={25} />
          <span className="text-[15px] font-semibold tracking-tight text-navy leading-none">
            Vericore
          </span>
        </Link>

        {/* Navigation — absolutely centred so it's always at the true midpoint */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-7">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors duration-200"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-right gap-3">
        </div>
      </div>
    </nav>
  );
}