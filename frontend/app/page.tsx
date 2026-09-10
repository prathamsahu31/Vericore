"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  TrendingUp,
  Clock,
  Calendar,
  CheckCircle,
  ArrowRight,
  FileText,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Award,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";
import { BidlyHeader } from "@/components/layout/BidlyHeader";
import { AIAnalysisModal } from "@/components/tenders/AIAnalysisModal";
import { BIDLY_TENDERS, Tender } from "@/lib/bidlyData";

export default function DashboardPage() {
  const router = useRouter();
  const [askQuery, setAskQuery] = useState("");
  const [selectedTenderForAnalysis, setSelectedTenderForAnalysis] = useState<Tender | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim()) return;
    router.push(`/command?prompt=${encodeURIComponent(askQuery)}`);
  };

  const handleChipClick = (chipText: string) => {
    router.push(`/command?prompt=${encodeURIComponent(chipText)}`);
  };

  const handleOpenAnalysis = (tender: Tender) => {
    setSelectedTenderForAnalysis(tender);
    setIsAnalysisOpen(true);
  };

  // Status badge style helper
  const getStatusBadge = (status: Tender["status"]) => {
    switch (status) {
      case "Closing Today":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Opening Soon":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "Awarded":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <BidlySidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <BidlyHeader
          title="Dashboard"
          subtitle="Tender Overview & Live Intelligence"
          badge="Live Feed"
        />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Welcome Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Good morning, Alex
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                You have <span className="font-semibold text-rose-600">3 high-priority tenders</span> closing within 48 hours. Bid readiness is at 88%.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/tenders/compare"
                className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Compare Matrix</span>
              </Link>
              <Link
                href="/bids"
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm shadow-blue-500/25 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Prepare New Bid</span>
              </Link>
            </div>
          </div>

          {/* 4 Top Metric Cards (Bidly Dashboard.png) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Active Tenders */}
            <div className="bidly-card p-5 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Tenders
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">24</span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center">
                  +3 this week
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Across 6 state and municipal portals</p>
            </div>

            {/* Card 2: Closing Today */}
            <div className="bidly-card p-5 relative overflow-hidden group border-rose-100 bg-gradient-to-b from-white to-rose-50/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                  Closing Today
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-700">3</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  Urgent
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Final compliance sign-offs needed</p>
            </div>

            {/* Card 3: Opening Soon */}
            <div className="bidly-card p-5 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Opening Soon
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">8</span>
                <span className="text-xs text-slate-500">Next 7 days</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Drafting pre-proposal templates</p>
            </div>

            {/* Card 4: Awarded Today */}
            <div className="bidly-card p-5 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Awarded Today
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">2</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  +$6.1M
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">TDCJ Health Network confirmed</p>
            </div>
          </div>

          {/* Ask Bidly Container (Interactive AI Hero Card) */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl shadow-blue-950/10 border border-blue-900/60 relative overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  Ask Bidly
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-2">
                What would you like to solve or discover today?
              </h3>
              <p className="text-xs md:text-sm text-slate-300 mb-6">
                Query tenders across all state databases, run instant win-probability simulations, or generate compliance matrices in seconds.
              </p>

              {/* Prompt Input Form */}
              <form onSubmit={handleAskSubmit} className="relative mb-4">
                <input
                  type="text"
                  value={askQuery}
                  onChange={(e) => setAskQuery(e.target.value)}
                  placeholder="Ask Bidly anything (e.g., 'Summarize technical requirements for DOT cloud tender' or 'Find IT RFPs over $2M')..."
                  className="w-full pl-5 pr-28 py-3.5 text-sm bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-slate-400 rounded-xl border border-white/15 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all backdrop-blur-md"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI</span>
                </button>
              </form>

              {/* Quick Prompt Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-medium text-slate-400 mr-1">Quick Prompts:</span>
                {[
                  "Summarize closing tenders",
                  "Draft bid proposal",
                  "Check compliance risks",
                  "Find high-value IT tenders",
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    className="px-3 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 rounded-full transition-all hover:scale-105"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Quick Actions Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/bids"
                className="bidly-card-interactive p-4 flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    New Bid Preparation
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Open 5-column draft studio</p>
                </div>
              </Link>

              <Link
                href="/tenders"
                className="bidly-card-interactive p-4 flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Search All Tenders
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Filter 24+ live solicitations</p>
                </div>
              </Link>

              <button
                onClick={() => handleOpenAnalysis(BIDLY_TENDERS[0])}
                className="bidly-card-interactive p-4 flex items-center gap-3.5 text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                    AI Tender Evaluation
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Instant win probability & risks</p>
                </div>
              </button>

              <Link
                href="/settings"
                className="bidly-card-interactive p-4 flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    Capability Matching
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Manage AI memory & profile</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Tenders Table */}
          <div className="bidly-card overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Tenders</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time updates from Texas DIR, DOT, HHS, and municipal portals
                </p>
              </div>
              <Link
                href="/tenders"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
              >
                <span>View all 24 tenders</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-6">Tender Title & ID</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Est. Value</th>
                    <th className="py-3.5 px-4">Deadline</th>
                    <th className="py-3.5 px-4">Win Fit</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {BIDLY_TENDERS.slice(0, 5).map((tender) => (
                    <tr key={tender.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-4 px-6 font-medium text-slate-900 max-w-xs">
                        <Link
                          href={`/tenders/${tender.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 line-clamp-1 text-xs transition-colors"
                        >
                          {tender.title}
                        </Link>
                        <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                          {tender.refNumber}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600 max-w-[200px] truncate">
                        {tender.department}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">{tender.value}</td>
                      <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                        <span
                          className={
                            tender.status === "Closing Today"
                              ? "text-rose-600 font-semibold"
                              : "text-slate-600"
                          }
                        >
                          {tender.deadline}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${tender.winProbability}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700">
                            {tender.winProbability}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${getStatusBadge(
                            tender.status
                          )}`}
                        >
                          {tender.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenAnalysis(tender)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>AI Analysis</span>
                          </button>
                          <Link
                            href={`/tenders/${tender.id}`}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* AI Analysis Modal */}
      <AIAnalysisModal
        tender={selectedTenderForAnalysis}
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
      />
    </div>
  );
}