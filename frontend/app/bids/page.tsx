"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Search,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Share2,
  Save,
  Send,
  Upload,
  Cpu,
  Shield,
  Layers,
  ChevronRight,
  Maximize2,
  Eye,
  Check,
  Zap,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";
import { BIDLY_TENDERS } from "@/lib/bidlyData";

function BidPreparationWorkspace() {
  const searchParams = useSearchParams();
  const tenderIdParam = searchParams.get("tenderId") || "tender-001";

  // Active Session state
  const [sessions, setSessions] = useState([
    {
      id: "session-1",
      title: "Statewide Cloud Migration TxDOT",
      tenderId: "tender-001",
      department: "Dept of Transportation",
      progress: 78,
      docsCount: 5,
      updatedAt: "10 mins ago",
      active: true,
    },
    {
      id: "session-2",
      title: "Hospital AI Diagnostics & EHR",
      tenderId: "tender-002",
      department: "State Health Commission",
      progress: 45,
      docsCount: 3,
      updatedAt: "2 hours ago",
      active: false,
    },
    {
      id: "session-3",
      title: "Smart Municipal Traffic Grid",
      tenderId: "tender-003",
      department: "City of San Antonio",
      progress: 90,
      docsCount: 4,
      updatedAt: "Yesterday",
      active: false,
    },
  ]);

  const activeSession = sessions.find((s) => s.active) || sessions[0];

  // Active Checklist tab
  const [checklistTab, setChecklistTab] = useState<"required" | "all">("required");

  // Required proposal sections checklist
  const [requiredDocs, setRequiredDocs] = useState([
    {
      id: "doc-1",
      title: "1.0 Executive Summary",
      status: "completed",
      author: "Alex Morgan",
      confidence: "98%",
    },
    {
      id: "doc-2",
      title: "2.0 Technical Architecture & SLAs",
      status: "in-progress",
      author: "Bidly AI Drafted",
      confidence: "94%",
    },
    {
      id: "doc-3",
      title: "3.0 Cost Breakdown & Pricing Schedule",
      status: "in-progress",
      author: "Finance Team",
      confidence: "88%",
    },
    {
      id: "doc-4",
      title: "4.0 Mandatory Compliance & Certs",
      status: "pending",
      author: "Legal / Compliance",
      confidence: "90%",
    },
    {
      id: "doc-5",
      title: "5.0 Subcontractor & HUB Plan",
      status: "completed",
      author: "Alex Morgan",
      confidence: "100%",
    },
  ]);

  const [activeSectionId, setActiveSectionId] = useState("doc-2");

  // AI Assistant Chat state
  const [aiChat, setAiChat] = useState([
    {
      role: "assistant",
      content:
        "I have drafted Section 2.0 (Technical Architecture) adhering to TxDOT's 99.95% uptime requirement. Notice the dual-region failover diagram generated below. Would you like me to calibrate the latency SLAs or add disaster recovery protocols?",
      time: "11:24 AM",
    },
  ]);
  const [aiInput, setAiInput] = useState("");

  const handleSendAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const userText = aiInput;
    setAiChat((prev) => [
      ...prev,
      { role: "user", content: userText, time: "Just now" },
    ]);
    setAiInput("");

    setTimeout(() => {
      let reply =
        "Updated Section 2.2 with sub-15ms cross-region latency guarantees and FIPS 140-3 cryptographic cipher suites. I also cross-referenced with your TxDOT 2024 Past Performance record to substantiate the SLA.";
      if (userText.toLowerCase().includes("cost") || userText.toLowerCase().includes("price")) {
        reply =
          "Pricing Schedule Benchmark: The median competitor award for DOT-IT solicitations is $4,650,000. Our recommended target bid price is $4,480,000 to maximize price evaluation points while retaining a 24% gross operating margin.";
      }
      setAiChat((prev) => [
        ...prev,
        { role: "assistant", content: reply, time: "Just now" },
      ]);
    }, 700);
  };

  const handleChipPrompt = (prompt: string) => {
    setAiInput(prompt);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden select-none">
      {/* COLUMN 1: Slim Rail Navigation */}
      <BidlySidebar collapsed={true} />

      {/* COLUMN 2: Chat Sessions & RFP History */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">Bid Sessions</span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full">
              {sessions.length}
            </span>
          </div>
          <button
            onClick={() => alert("Creating new proposal draft session...")}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Create New Session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search sessions */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sessions..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => {
                setSessions((prev) =>
                  prev.map((s) => ({ ...s, active: s.id === session.id }))
                );
              }}
              className={`p-3 rounded-xl cursor-pointer transition-all ${
                session.active
                  ? "bg-blue-50/80 border border-blue-200 shadow-xs"
                  : "hover:bg-slate-50 border border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span
                  className={`text-xs font-bold line-clamp-1 ${
                    session.active ? "text-blue-900" : "text-slate-800"
                  }`}
                >
                  {session.title}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block truncate">
                {session.department}
              </span>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <div className="w-10 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>
                  <span className="font-semibold text-slate-600">{session.progress}%</span>
                </div>
                <span>{session.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMN 3: Documents Checklist & Requirements */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
        {/* Tab switcher */}
        <div className="p-3 border-b border-slate-200 flex items-center gap-1 bg-slate-50/60">
          <button
            onClick={() => setChecklistTab("required")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              checklistTab === "required"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Proposal Checklist
          </button>
          <button
            onClick={() => setChecklistTab("all")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              checklistTab === "all"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Attached Files (4)
          </button>
        </div>

        {/* Header summary */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-800">Submission Readiness</span>
            <span className="text-xs font-extrabold text-blue-600">78% Ready</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: "78%" }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            3 of 5 mandatory sections drafted and validated.
          </p>
        </div>

        {/* Checklist items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {requiredDocs.map((doc) => {
            const isSelected = activeSectionId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => setActiveSectionId(doc.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? "text-blue-900" : "text-slate-800"
                    }`}
                  >
                    {doc.title}
                  </span>
                  {doc.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : doc.status === "in-progress" ? (
                    <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>{doc.author}</span>
                  <span className="font-semibold text-emerald-600">AI Match: {doc.confidence}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload Reference File */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => alert("File upload dialog opened...")}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload Reference Doc</span>
          </button>
        </div>
      </div>

      {/* COLUMN 4: Document Preview & Editor Canvas */}
      <div className="flex-1 bg-slate-100 flex flex-col h-full overflow-hidden">
        {/* Editor Top Toolbar */}
        <div className="h-14 px-6 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-slate-900">
              TxDOT_Cloud_Migration_Technical_Proposal_v3.docx
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
              Live Synchronized
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert("Draft saved to cloud vault.")}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              onClick={() => alert("Generating full formatted PDF...")}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Document Canvas (Scrollable Paper Preview) */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border border-slate-200 p-10 space-y-8 text-slate-800">
            {/* Proposal Header Banner */}
            <div className="border-b border-slate-200 pb-6 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 block mb-1">
                  Vericore Proposal Submission • Solicitation DOT-IT-2026-8941
                </span>
                <h1 className="text-xl font-extrabold text-slate-900">
                  Technical Solution & Architectural Narrative
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Prepared for: Texas Department of Transportation & Infrastructure
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white font-black text-sm">
                VERI
              </div>
            </div>

            {/* Section 2.0 Header */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2">
                2.0 High Availability Hybrid Architecture & Microservices Deployment
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 mb-4">
                Vericore Technologies proposes an enterprise-grade, zero-trust hybrid cloud
                topology across AWS GovCloud (US-East) and Google Cloud Platform (US-Central),
                guaranteeing an annualized service availability of 99.98% exceeding TxDOT&apos;s 99.95%
                SLA threshold.
              </p>
            </div>

            {/* Blueprint Schematic Architecture Diagram Box (Bid Doc Preparation .png) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 text-white border border-slate-800 shadow-inner space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold tracking-wide uppercase text-blue-300">
                    Figure 2.1: Dual-Region Zero-Trust Cloud Architecture
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">FIPS 140-3 Validated</span>
              </div>

              {/* Visual Schematic Diagram Flow */}
              <div className="grid grid-cols-3 gap-4 text-center text-xs py-2">
                {/* Node 1 */}
                <div className="p-3 rounded-xl bg-white/10 border border-white/15 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center mb-1.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-[11px]">12 Edge Transit Hubs</span>
                  <span className="text-[10px] text-slate-300 mt-0.5">TLS 1.3 Sensor Grid</span>
                </div>

                {/* Node 2 */}
                <div className="p-3 rounded-xl bg-blue-600/30 border border-blue-400/40 flex flex-col items-center relative">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center mb-1.5 shadow-sm">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-[11px]">Envoy API Gateway</span>
                  <span className="text-[10px] text-blue-200 mt-0.5">&lt;15ms Dual Failover</span>
                </div>

                {/* Node 3 */}
                <div className="p-3 rounded-xl bg-white/10 border border-white/15 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-1.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-[11px]">Kubernetes GovCloud</span>
                  <span className="text-[10px] text-slate-300 mt-0.5">SOC 2 &amp; ISO 27001</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center italic">
                Bidly Automated Blueprint: Multi-zone database clustering with active-active Postgres replication.
              </p>
            </div>

            {/* Detailed text narrative */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <h3 className="font-bold text-slate-900">2.1 Disaster Recovery &amp; RPO/RTO Commitments</h3>
              <p>
                To eliminate business interruption across metropolitan transit routes, state
                databases leverage real-time write-ahead logging (WAL) replication across geographically
                separated availability zones. Automated failover triggers within 22 seconds of any
                packet anomaly, backed by our 24/7 dedicated Austin-based SRE engineering unit.
              </p>

              <h3 className="font-bold text-slate-900 pt-2">2.2 Compliance &amp; Security Assurance</h3>
              <p>
                In strict adherence to RFP Section 4.3, all citizen telemetry and transaction logs
                remain encrypted using AES-256 at rest and TLS 1.3 in transit. Full third-party SOC 2
                Type II audit reports and ISO/IEC 27001 certificates are attached in Appendix D.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 5: Bidly AI Assistant Right Panel */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 h-full">
        {/* AI Panel Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-950 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold">Bidly Copilot</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200">
            Proposal Mode
          </span>
        </div>

        {/* Quick Action Prompt Chips */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Suggested Actions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Calibrate SLA to 99.98%",
              "Benchmark pricing schedule",
              "Check FAR compliance",
              "Add SOC 2 citations",
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipPrompt(chip)}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-left transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* AI Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {aiChat.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`p-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-xs"
                    : "bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60"
                }`}
              >
                <p className="leading-relaxed text-xs">{msg.content}</p>
              </div>
              <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}
        </div>

        {/* Prompt Input Form */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form onSubmit={handleSendAi} className="relative">
            <textarea
              rows={2}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask Bidly to draft, rewrite, or verify..."
              className="w-full p-2.5 pr-9 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 resize-none"
            />
            <button
              type="submit"
              className="absolute right-2 bottom-3 p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function BidPreparationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
          Loading proposal studio...
        </div>
      }
    >
      <BidPreparationWorkspace />
    </Suspense>
  );
}
