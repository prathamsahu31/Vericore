"use client";

import React from "react";
import Link from "next/link";
import { Search, Bell, Sparkles, Filter, Plus } from "lucide-react";

interface BidlyHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function BidlyHeader({ title, subtitle, badge, actions }: BidlyHeaderProps) {
  return (
    <header className="h-16 px-8 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-20">
      {/* Title / Breadcrumb */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {badge && (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {badge}
          </span>
        )}
        {subtitle && <span className="text-sm text-slate-400 hidden md:inline">| {subtitle}</span>}
      </div>

      {/* Right Utility Bar */}
      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="relative hidden lg:block w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tenders, IDs, keywords..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Custom Actions if provided */}
        {actions}

        {/* Notifications */}
        <button
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* Quick AI Action */}
        <Link
          href="/command"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-sky-500 text-white rounded-xl shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ask Bidly</span>
        </Link>
      </div>
    </header>
  );
}
