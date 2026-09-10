"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  FileText,
  Sparkles,
  Bookmark,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface BidlySidebarProps {
  collapsed?: boolean;
}

export function BidlySidebar({ collapsed = false }: BidlySidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Tender Search",
      href: "/tenders",
      icon: Search,
      badge: "24 New",
      active: pathname.startsWith("/tenders") && !pathname.includes("/compare"),
    },
    {
      label: "Tender Compare",
      href: "/tenders/compare",
      icon: ShieldCheck,
      active: pathname.startsWith("/tenders/compare"),
    },
    {
      label: "Bid Preparation",
      href: "/bids",
      icon: FileText,
      badge: "Active",
      active: pathname.startsWith("/bids"),
    },
    {
      label: "Bidly AI Hub",
      href: "/command",
      icon: Sparkles,
      highlight: true,
      active: pathname.startsWith("/command"),
    },
  ];

  const bottomItems = [
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      active: pathname.startsWith("/settings"),
    },
  ];

  if (collapsed) {
    return (
      <aside className="w-16 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-4 justify-between h-screen sticky top-0 z-30 select-none">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo Glyph */}
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 hover:scale-105 transition-transform"
            title="Bidly"
          >
            <Zap className="w-5 h-5 fill-white" />
          </Link>

          {/* Navigation Icons */}
          <nav className="flex flex-col items-center gap-2 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    item.active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                      : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Rail Icons */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  item.active
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-400">
            AM
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-slate-900">Bidly</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                  AI 2.0
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Tender Intelligence</span>
            </div>
          </Link>
        </div>

        {/* Main Nav Items */}
        <div className="px-3 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Main Menu
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        item.active ? "text-white" : item.highlight ? "text-blue-500" : "text-slate-400"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.active
                          ? "bg-blue-500 text-white"
                          : "bg-blue-50 text-blue-600 border border-blue-100"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mt-6 mb-2">
            Preferences & System
          </div>
          <nav className="space-y-1">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${item.active ? "text-white" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/80 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              AM
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-semibold text-slate-900 truncate">Alex Morgan</span>
              <span className="text-[11px] text-slate-400 truncate">alex@vericore.ai</span>
            </div>
          </div>
          <Link
            href="/settings"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Account Settings"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
