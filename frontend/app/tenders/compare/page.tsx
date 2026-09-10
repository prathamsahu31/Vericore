"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Building,
  Target,
  Layers,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";
import { BidlyHeader } from "@/components/layout/BidlyHeader";
import { BIDLY_TENDERS, Tender } from "@/lib/bidlyData";

function CompareContent() {
  const searchParams = useSearchParams();
  const rawIds = searchParams.get("ids");

  const initialIds = rawIds ? rawIds.split(",") : ["tender-001", "tender-002", "tender-003"];
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  const comparedTenders = selectedIds
    .map((id) => BIDLY_TENDERS.find((t) => t.id === id))
    .filter(Boolean) as Tender[];

  const removeTender = (id: string) => {
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const addTender = (id: string) => {
    if (selectedIds.length < 3 && !selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const renderComplexityDots = (rating: number) => {
    return (
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((dot) => (
          <div
            key={dot}
            className={`w-2.5 h-2.5 rounded-full ${
              dot <= rating ? "bg-blue-600" : "bg-slate-200"
            }`}
          />
        ))}
        <span className="text-[11px] font-semibold text-slate-600 ml-1">
          {rating}/5
        </span>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <BidlySidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <BidlyHeader
          title="Tender Comparison Matrix"
          subtitle="Side-by-side strategic scoring & feasibility"
          badge={`${comparedTenders.length} Tenders`}
        />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Bar Navigation & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link
              href="/tenders"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tender Search</span>
            </Link>

            <div className="flex items-center gap-3">
              {/* Tender Selector Dropdown to add up to 3 */}
              {selectedIds.length < 3 && (
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addTender(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                  >
                    <option value="" disabled>
                      + Add Tender to Compare...
                    </option>
                    {BIDLY_TENDERS.filter((t) => !selectedIds.includes(t.id)).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.refNumber} — {t.title.slice(0, 35)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => alert("Exporting comparison matrix report as PDF...")}
                className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Matrix PDF</span>
              </button>
            </div>
          </div>

          {/* Comparison Matrix Table (Tender Search - Compare-1.png) */}
          {comparedTenders.length === 0 ? (
            <div className="bidly-card p-12 text-center">
              <SlidersHorizontal className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No tenders selected for comparison</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Return to the Tender Search page and click &quot;Compare&quot; on up to 3 tenders to benchmark win probability and requirements side-by-side.
              </p>
              <Link
                href="/tenders"
                className="mt-4 inline-block px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Go to Tender Search
              </Link>
            </div>
          ) : (
            <div className="bidly-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200">
                      <th className="py-5 px-6 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-56">
                        Evaluation Metric
                      </th>
                      {comparedTenders.map((tender) => (
                        <th
                          key={tender.id}
                          className="py-5 px-6 font-bold text-slate-900 border-l border-slate-200 min-w-[280px]"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-50 text-blue-700 rounded border border-blue-200">
                              {tender.refNumber}
                            </span>
                            <button
                              onClick={() => removeTender(tender.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Remove from comparison"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <Link
                            href={`/tenders/${tender.id}`}
                            className="text-sm font-bold text-slate-900 hover:text-blue-600 line-clamp-2 leading-snug"
                          >
                            {tender.title}
                          </Link>
                          <span className="text-[11px] font-normal text-slate-500 mt-1 block">
                            {tender.department}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200/80">
                    {/* Estimated Value */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>Contract Budget</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          <span className="text-base font-extrabold text-slate-900">
                            {tender.value}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Deadline */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>Submission Deadline</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          <span
                            className={
                              tender.status === "Closing Today"
                                ? "text-rose-600 font-bold"
                                : "text-slate-700 font-medium"
                            }
                          >
                            {tender.deadline}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Win Probability */}
                    <tr className="hover:bg-slate-50/50 bg-blue-50/20">
                      <td className="py-4 px-6 font-bold text-blue-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Win Probability</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-blue-600">
                              {tender.winProbability}%
                            </span>
                            <div className="flex-1 max-w-[120px] bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-600 h-full rounded-full"
                                style={{ width: `${tender.winProbability}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {tender.winProbability >= 75 ? "High Fit" : "Competitive"}
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Competition Level */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <Target className="w-4 h-4 text-slate-400" />
                        <span>Expected Competitors</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              {tender.competitionLevel}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600">
                              ~{tender.biddersCount} Bidders
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Complexity Rating */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>Project Complexity</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          {renderComplexityDots(tender.complexity)}
                        </td>
                      ))}
                    </tr>

                    {/* ROI Score */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        <span>Projected ROI Score</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {tender.roiScore} / 100
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Mandatory Criteria Passed */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Mandatory Qualifications</span>
                      </td>
                      {comparedTenders.map((tender) => {
                        const satisfiedCount = tender.keyRequirements.filter((r) => r.satisfied)
                          .length;
                        return (
                          <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                            <span className="font-bold text-slate-800">
                              {satisfiedCount} of {tender.keyRequirements.length} Met
                            </span>
                            <div className="mt-1 space-y-1">
                              {tender.keyRequirements.slice(0, 2).map((req, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] text-slate-500 flex items-center gap-1.5"
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      req.satisfied ? "bg-emerald-500" : "bg-amber-500"
                                    }`}
                                  />
                                  <span className="truncate">{req.text}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Top Evaluated Risk */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Primary Risk Factor</span>
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-4 px-6 border-l border-slate-200">
                          {tender.riskFactors.length > 0 ? (
                            <div>
                              <span className="font-bold text-rose-900 block">
                                {tender.riskFactors[0].title}
                              </span>
                              <span className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                {tender.riskFactors[0].desc}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Minimal risks detected</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Action Row */}
                    <tr className="bg-slate-50">
                      <td className="py-5 px-6 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                        Decision
                      </td>
                      {comparedTenders.map((tender) => (
                        <td key={tender.id} className="py-5 px-6 border-l border-slate-200">
                          <Link
                            href={`/bids?tenderId=${tender.id}`}
                            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all text-center"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Select for Bid Preparation</span>
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function TenderComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
          Loading comparison matrix...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
