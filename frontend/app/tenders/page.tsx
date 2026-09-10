"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Check,
  Filter,
  Layers,
  ChevronDown,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";
import { BidlyHeader } from "@/components/layout/BidlyHeader";
import { AIAnalysisModal } from "@/components/tenders/AIAnalysisModal";
import { BIDLY_TENDERS, Tender } from "@/lib/bidlyData";

export default function TenderSearchPage() {
  const router = useRouter();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedValueRange, setSelectedValueRange] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedDeadline, setSelectedDeadline] = useState("all");
  const [sortBy, setSortBy] = useState("match");

  // Selected for comparison (up to 3)
  const [compareIds, setCompareIds] = useState<string[]>(["tender-001", "tender-002"]);

  // Modal state
  const [modalTender, setModalTender] = useState<Tender | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter options
  const departments = [
    { value: "all", label: "All Departments" },
    { value: "Department of Transportation & Infrastructure", label: "Transportation (TxDOT)" },
    { value: "State Health & Human Services Commission", label: "Health & Human Services (HHS)" },
    { value: "City of San Antonio — Smart City Department", label: "Smart City San Antonio" },
    { value: "Department of Information Resources (DIR)", label: "Information Resources (DIR)" },
    { value: "Lower Colorado River Authority (LCRA)", label: "Water Authority (LCRA)" },
    { value: "Texas Department of Criminal Justice (TDCJ)", label: "Criminal Justice (TDCJ)" },
  ];

  const valueRanges = [
    { value: "all", label: "All Values" },
    { value: "under-3m", label: "Under $3,000,000" },
    { value: "3m-5m", label: "$3,000,000 – $5,000,000" },
    { value: "over-5m", label: "Over $5,000,000" },
  ];

  const locations = [
    { value: "all", label: "All Locations" },
    { value: "Austin", label: "Austin, TX" },
    { value: "Houston", label: "Houston / Dallas" },
    { value: "San Antonio", label: "San Antonio, TX" },
    { value: "Huntsville", label: "Huntsville, TX" },
  ];

  const deadlines = [
    { value: "all", label: "All Deadlines" },
    { value: "urgent", label: "Closing in 48 Hours" },
    { value: "7days", label: "Next 7 Days" },
    { value: "30days", label: "Next 30 Days" },
  ];

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedDept("all");
    setSelectedValueRange("all");
    setSelectedLocation("all");
    setSelectedDeadline("all");
    setSortBy("match");
  };

  // Filtered & Sorted Tenders
  const filteredTenders = useMemo(() => {
    return BIDLY_TENDERS.filter((tender) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          tender.title.toLowerCase().includes(q) ||
          tender.department.toLowerCase().includes(q) ||
          tender.refNumber.toLowerCase().includes(q) ||
          tender.scopeSummary.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Department
      if (selectedDept !== "all" && tender.department !== selectedDept) {
        return false;
      }

      // Value Range
      if (selectedValueRange === "under-3m" && tender.rawValue >= 3000000) return false;
      if (
        selectedValueRange === "3m-5m" &&
        (tender.rawValue < 3000000 || tender.rawValue > 5000000)
      )
        return false;
      if (selectedValueRange === "over-5m" && tender.rawValue <= 5000000) return false;

      // Location
      if (selectedLocation !== "all" && !tender.location.includes(selectedLocation)) {
        return false;
      }

      // Deadline
      if (selectedDeadline === "urgent" && tender.deadlineDaysLeft > 2) return false;
      if (selectedDeadline === "7days" && tender.deadlineDaysLeft > 7) return false;
      if (selectedDeadline === "30days" && tender.deadlineDaysLeft > 30) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "match") return b.winProbability - a.winProbability;
      if (sortBy === "value-desc") return b.rawValue - a.rawValue;
      if (sortBy === "value-asc") return a.rawValue - b.rawValue;
      if (sortBy === "deadline") return a.deadlineDaysLeft - b.deadlineDaysLeft;
      return 0;
    });
  }, [
    searchQuery,
    selectedDept,
    selectedValueRange,
    selectedLocation,
    selectedDeadline,
    sortBy,
  ]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const openAnalysis = (tender: Tender) => {
    setModalTender(tender);
    setIsModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <BidlySidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <BidlyHeader
          title="Tender Search & Discovery"
          subtitle="Explore live federal & state solicitations"
          badge={`${filteredTenders.length} Active`}
        />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Filter Container (Tender Search .png) */}
          <div className="bidly-card p-5 space-y-4">
            {/* Search Input Row */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tenders by keyword, reference ID, agency, or technology..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>

            {/* Dropdown Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
              {/* Department */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                >
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Range */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Value Range
                </label>
                <select
                  value={selectedValueRange}
                  onChange={(e) => setSelectedValueRange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                >
                  {valueRanges.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                >
                  {locations.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Deadline
                </label>
                <select
                  value={selectedDeadline}
                  onChange={(e) => setSelectedDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                >
                  {deadlines.map((dl) => (
                    <option key={dl.value} value={dl.value}>
                      {dl.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Header with Sorting and Compare Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900">
                Showing {filteredTenders.length} matching tenders
              </span>
              {compareIds.length > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {compareIds.length} selected to compare
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Sort By */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                >
                  <option value="match">Match Score (High to Low)</option>
                  <option value="value-desc">Value (High to Low)</option>
                  <option value="value-asc">Value (Low to High)</option>
                  <option value="deadline">Deadline (Earliest)</option>
                </select>
              </div>

              {/* Compare Button */}
              {compareIds.length > 1 && (
                <Link
                  href={`/tenders/compare?ids=${compareIds.join(",")}`}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Compare ({compareIds.length})</span>
                </Link>
              )}
            </div>
          </div>

          {/* Tender Cards Grid */}
          <div className="space-y-4">
            {filteredTenders.map((tender) => {
              const isCompared = compareIds.includes(tender.id);

              return (
                <div
                  key={tender.id}
                  className="bidly-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-300 transition-all group"
                >
                  {/* Left Column: Title & Metadata */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 font-mono">
                            {tender.refNumber}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {tender.department}
                          </span>
                        </div>
                        <Link
                          href={`/tenders/${tender.id}`}
                          className="text-base md:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1"
                        >
                          {tender.title}
                        </Link>
                      </div>

                      {/* Win Match Score Pill */}
                      <div className="flex-shrink-0 flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs font-bold">{tender.winProbability}% Match</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {tender.competitionLevel} competition
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {tender.scopeSummary}
                    </p>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>Est: {tender.value}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{tender.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span
                          className={
                            tender.status === "Closing Today"
                              ? "text-rose-600 font-bold"
                              : "text-slate-600"
                          }
                        >
                          Deadline: {tender.deadline}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 3 Action Buttons */}
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-2.5 flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="w-full md:w-36 px-3 py-2 text-xs font-semibold text-center text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
                    >
                      View Details
                    </Link>

                    <button
                      onClick={() => openAnalysis(tender)}
                      className="w-full md:w-36 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>AI Analysis</span>
                    </button>

                    <button
                      onClick={() => toggleCompare(tender.id)}
                      className={`w-full md:w-36 px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                        isCompared
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                          : "bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {isCompared ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Compared</span>
                        </>
                      ) : (
                        <>
                          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                          <span>Compare</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* AI Analysis Modal */}
      <AIAnalysisModal
        tender={modalTender}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}