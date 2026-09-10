"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  Building,
  User,
  Mail,
  Phone,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Bot,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";
import { BidlyHeader } from "@/components/layout/BidlyHeader";
import { BIDLY_TENDERS, Tender } from "@/lib/bidlyData";

interface PageProps {
  params: Promise<{ tenderId: string }>;
}

export default function SpecificTenderPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const tenderId = resolvedParams.tenderId;

  // Find tender or fallback to the first one
  const tender: Tender =
    BIDLY_TENDERS.find((t) => t.id === tenderId) || BIDLY_TENDERS[0];

  // Drawer state for Document Preview + Bidly AI Assistant
  const [activeDoc, setActiveDoc] = useState<{
    name: string;
    type: string;
    size: string;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Chat state inside Drawer
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { sender: "ai" | "user"; text: string; time: string }[]
  >([
    {
      sender: "ai",
      text: `Hello Alex! I have indexed '${tender.documents[0]?.name || "RFP Specification"}'. You can ask me to extract SLAs, summarize section clauses, check compliance against our company memory, or draft specific response sections.`,
      time: "Just now",
    },
  ]);

  const handleOpenDocDrawer = (doc: { name: string; type: string; size: string }) => {
    setActiveDoc(doc);
    setDrawerOpen(true);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: userText, time: "Just now" },
    ]);
    setChatInput("");

    // Simulate smart contextual Bidly response
    setTimeout(() => {
      let reply = `Based on Section 4.2 of ${activeDoc?.name || "the RFP"}: Our architecture matches the 99.95% multi-region uptime requirement. However, clause 14.8 stipulates a $5,000/day delay penalty; our proposal should explicitly incorporate automated canary deployments to mitigate cutover risk.`;
      if (userText.toLowerCase().includes("summarize") || userText.toLowerCase().includes("summary")) {
        reply = `Summary of ${activeDoc?.name}: This RFP mandates a hybrid-cloud migration across 12 transit facilities. Key evaluation criteria: 40% Technical Solution, 30% Past Performance, and 30% Cost Schedule.`;
      } else if (userText.toLowerCase().includes("compliance") || userText.toLowerCase().includes("iso")) {
        reply = `Compliance Check: Vericore holds verified ISO 27001 & SOC 2 Type II certificates. Requirement 3.1.4 is 100% satisfied. Pre-approved audit documentation has been queued for proposal export.`;
      }

      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: reply, time: "Just now" },
      ]);
    }, 600);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <BidlySidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <BidlyHeader
          title={tender.refNumber}
          subtitle={tender.title}
          badge={tender.status}
        />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Back Navigation & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link
              href="/tenders"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tender Search</span>
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenDocDrawer(tender.documents[0])}
                className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Ask Bidly about this RFP</span>
              </button>
              <Link
                href={`/bids?tenderId=${tender.id}`}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/30 flex items-center gap-1.5 transition-all"
              >
                <span>Prepare Bid Proposal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Tender Master Header Card (Specfic Tender Page.png) */}
          <div className="bidly-card p-6 md:p-8 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                    {tender.refNumber}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {tender.department}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {tender.status}
                  </span>
                </div>

                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  {tender.title}
                </h1>

                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  {tender.scopeSummary}
                </p>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-4 text-xs pt-2">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Estimated Budget: {tender.value}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{tender.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                    <Clock className="w-4 h-4" />
                    <span>Deadline: {tender.deadline}</span>
                  </div>
                </div>
              </div>

              {/* Right Win Probability Gauge Card */}
              <div className="flex-shrink-0 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 flex flex-col items-center text-center w-full lg:w-56">
                <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-blue-100"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-blue-600"
                      strokeDasharray={`${tender.winProbability}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-base font-extrabold text-blue-900">
                    {tender.winProbability}%
                  </span>
                </div>
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Win Probability
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  {tender.competitionLevel} Competition (~{tender.biddersCount} Bidders)
                </span>
              </div>
            </div>
          </div>

          {/* 2-Column Main Section: Details on Left, Sidebar on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Mandatory Criteria & Compliance Checklist */}
              <div className="bidly-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Mandatory Criteria & Vericore Capability Match</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {tender.keyRequirements.filter((r) => r.satisfied).length} of{" "}
                    {tender.keyRequirements.length} verified
                  </span>
                </div>

                <div className="space-y-2.5">
                  {tender.keyRequirements.map((req, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                        req.satisfied
                          ? "bg-emerald-50/40 border-emerald-200"
                          : "bg-amber-50/40 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {req.satisfied ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold text-slate-900 block">{req.text}</span>
                          {req.note && (
                            <span className="text-[11px] text-slate-500 mt-0.5 block">
                              Source: {req.note}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider flex-shrink-0 ${
                          req.satisfied
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {req.satisfied ? "Verified Match" : "Action Required"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Official RFP Documents Grid */}
              <div className="bidly-card p-6">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Official Solicitation Documents ({tender.documents.length})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {tender.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-bold text-[10px] flex items-center justify-center">
                            {doc.type}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 line-clamp-1">
                              {doc.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {doc.size} • {doc.pages} pages
                            </span>
                          </div>
                        </div>
                        {doc.mandatory && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Required
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                        <button
                          onClick={() => handleOpenDocDrawer(doc)}
                          className="flex-1 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3 text-blue-600" />
                          <span>Preview & AI Q&A</span>
                        </button>
                        <button
                          onClick={() => alert(`Downloading ${doc.name}...`)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones Timeline Stepper */}
              <div className="bidly-card p-6">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Procurement Schedule & Timeline</span>
                </h3>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {tender.timeline.map((item, idx) => (
                    <div key={idx} className="relative flex items-center justify-between">
                      <div
                        className={`absolute -left-6 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                          item.status === "completed"
                            ? "border-emerald-500 bg-emerald-500"
                            : item.status === "current"
                            ? "border-blue-600 bg-white ring-4 ring-blue-100"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {item.status === "completed" && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <span
                          className={`text-xs font-bold ${
                            item.status === "current" ? "text-blue-600" : "text-slate-800"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {item.date}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                          item.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "current"
                            ? "bg-blue-100 text-blue-800 font-bold"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 1 Column Sidebar: AI Insights & Contact Card */}
            <div className="space-y-6">
              {/* Bidly Strategic Summary Card */}
              <div className="bidly-card p-6 bg-gradient-to-b from-white to-blue-50/20 border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 mb-3">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Bidly AI Insights
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">
                  Winning Strategy Summary
                </h4>
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  {tender.suggestedActions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200">
                  <Link
                    href={`/bids?tenderId=${tender.id}`}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all text-center"
                  >
                    <span>Launch Bid Preparation Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Procurement Officer Contact Card */}
              <div className="bidly-card p-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Procurement Contact</span>
                </h4>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm">
                    {tender.contactOfficer.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">
                      {tender.contactOfficer.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {tender.contactOfficer.title}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-[11px] text-blue-600">
                      {tender.contactOfficer.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{tender.contactOfficer.phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Slide-out Document Preview & Bidly Assistant Drawer (Specfic Tender Page-1.png) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white h-screen shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="h-16 px-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white line-clamp-1">
                      {activeDoc?.name || "RFP Document"}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-blue-500/30 text-blue-200">
                      AI OCR Indexed
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Live interactive document analysis powered by Bidly
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body: 2 Columns (Document Preview on Left, Bidly Chat on Right) */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Left Side: Formatted Document Preview */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto border-r border-slate-200">
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6 text-slate-800">
                  <div className="border-b border-slate-200 pb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                      Official RFP Specification Excerpt
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Section 4: Technical System Requirements & SLAs
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">
                      Ref: {tender.refNumber} — Page 42 of 128
                    </span>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-slate-700">
                    <p className="font-semibold text-slate-900">
                      4.2 High Availability & Failover Architecture
                    </p>
                    <p>
                      The Contractor shall design, implement, and validate a geo-redundant hybrid
                      cloud topology providing a minimum guaranteed service availability of{" "}
                      <span className="bg-amber-100 font-semibold px-1 py-0.5 rounded text-amber-900">
                        99.95% annualized uptime
                      </span>
                      . In the event of primary data center disruption, failover to the secondary state
                      region must occur with an RPO (Recovery Point Objective) of less than 60 seconds
                      and an RTO (Recovery Time Objective) of under 15 minutes.
                    </p>
                    <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-100">
                      <span className="text-[11px] font-bold text-blue-900 block mb-1">
                        4.2.3 Mandatory Cloud Certifications:
                      </span>
                      <p className="text-[11px] text-blue-800">
                        Bidders must provide third-party SOC 2 Type II audit reports and evidence of
                        active ISO/IEC 27001:2022 accreditation covering all hosted infrastructure.
                      </p>
                    </div>
                    <p>
                      4.3 Data Sovereignity & Access Control: All transit and citizen telemetry data
                      shall remain stored within the continental United States. End-to-end encryption
                      using FIPS 140-3 validated cryptographic modules is mandatory at rest (AES-256)
                      and in transit (TLS 1.3).
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Bidly Interactive Chat Assistant */}
              <div className="w-full md:w-96 flex flex-col bg-white">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">Bidly Document AI</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl ${
                          msg.sender === "user"
                            ? "bg-blue-600 text-white rounded-br-xs"
                            : "bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.time}</span>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-3 border-t border-slate-200 bg-white">
                  <form onSubmit={handleSendMessage} className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask Bidly about this clause or requirement..."
                      className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
