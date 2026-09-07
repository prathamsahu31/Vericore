"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "vericore-theme";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Theme toggle: flips `dark` on <html> and persists the choice. The initial
 * value is applied before first paint by an inline script in layout.tsx so the
 * toggle never relies on hydration to avoid flashing light, and this component
 * only reflects — and changes — what that script already decided.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === null ? systemPrefersDark() : stored === "dark";
    setDark(document.documentElement.classList.contains("dark") || initial);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 250);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="ml-2 grid h-9 w-9 place-items-center rounded-[4px] border border-rule text-ink-muted transition-colors hover:border-seal hover:text-seal"
    >
      <span aria-hidden className="text-[15px] leading-none">
        {dark ? "☀" : "☾"}
      </span>
    </button>
  );
}