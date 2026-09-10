"use client";

import React from "react";
import Link from "next/link";
import {
  X,
  Sparkles,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  FileCheck,
  Target,
} from "lucide-react";
import { Tender } from "@/lib/bidlyData";

interface AIAnalysisModalProps {
  tender: Tender | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AIAnalysisModal({ tender, isOpen, onClose }: AIAnalysisModalProps) {
  if (!isOpen || !tender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                  Bidly Intelligence Report
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40">
                  AI Evaluated
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight line-clamp-1">
                {tender.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Key Metrics Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Win Probability Circular Gauge */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-blue-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-600 transition-all duration-1000 ease-out"
                    strokeDasharray={`${tender.winProbability}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold text-blue-900 leading-none">
                    {tender.winProbability}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Win Probability
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {tender.winProbability >= 75 ? "High Fit" : "Competitive"}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Top 10% match with our past past delivery
                </p>
              </div>
            </div>

            {/* Competition Level */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold uppercase tracking-wider">Competition</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{tender.competitionLevel}</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">
                  ~{tender.biddersCount} Bidders
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Expected 2 major defense incumbents</p>
            </div>

            {/* Estimated Value & Est ROI */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Target className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold uppercase tracking-wider">Estimated Budget</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{tender.value}</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  ROI: {tender.roiScore}/100
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Margin projected between 22% – 28%</p>
            </div>
          </div>

          {/* Key Requirements Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                Mandatory Qualifications & Fit Checklist
              </h3>
              <span className="text-xs font-medium text-slate-500">
                {tender.keyRequirements.filter((r) => r.satisfied).length} of{" "}
                {tender.keyRequirements.length} criteria met
              </span>
            </div>
            <div className="space-y-2">
              {tender.keyRequirements.map((req, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                    req.satisfied
                      ? "bg-emerald-50/50 border-emerald-200 text-slate-800"
                      : "bg-amber-50/50 border-amber-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {req.satisfied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-900">{req.text}</span>
                      {req.note && <p className="text-slate-500 text-[11px] mt-0.5">{req.note}</p>}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider flex-shrink-0 ${
                      req.satisfied
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {req.satisfied ? "Verified" : "Action Required"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Actions (Numbered 1-3) */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Strategic Recommendations to Maximize Score
            </h3>
            <div className="space-y-2.5">
              {tender.suggestedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed font-medium">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Factors */}
          {tender.riskFactors.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Evaluated Risk Factors
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tender.riskFactors.map((risk, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-xl bg-rose-50/40 border border-rose-200 text-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-rose-950">{risk.title}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            risk.severity === "high"
                              ? "bg-rose-200 text-rose-800"
                              : "bg-amber-200 text-amber-800"
                          }`}
                        >
                          {risk.severity} risk
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{risk.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close Analysis
          </button>
          <div className="flex items-center gap-3">
            <Link
              href={`/tenders/${tender.id}`}
              className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
            >
              View Full RFP Details
            </Link>
            <Link
              href={`/bids?tenderId=${tender.id}`}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/30 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <span>Start Bid Preparation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
