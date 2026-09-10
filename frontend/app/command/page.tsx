"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Paperclip,
  Globe,
  Brain,
  Hash,
  Send,
  Plus,
  Search,
  MessageSquare,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Bot,
  Copy,
  RotateCcw,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  chips?: string[];
}

function CommandCenterContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt");

  // Chat History Sidebar State
  const [activeChatId, setActiveChatId] = useState("chat-1");
  const [searchChats, setSearchChats] = useState("");

  const chatSessions = [
    {
      period: "Today",
      chats: [
        { id: "chat-1", title: "TxDOT Cloud Migration Proposal Draft" },
        { id: "chat-2", title: "RFP Section 4.2 Latency SLAs" },
      ],
    },
    {
      period: "Previous 7 Days",
      chats: [
        { id: "chat-3", title: "San Antonio Smart City Sensor SLA" },
        { id: "chat-4", title: "DFIR State Cyber Retainer HUB Plan" },
        { id: "chat-5", title: "Hospital EHR AI Diagnostic Inference" },
      ],
    },
    {
      period: "Older",
      chats: [
        { id: "chat-6", title: "EPA SCADA Water Modernization Review" },
        { id: "chat-7", title: "Texas DIR Vendor Registration Guidelines" },
      ],
    },
  ];

  // Active Chat Message Stream
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("Bidly 2.0 Pro");

  // Action chips state
  const [activeChips, setActiveChips] = useState<string[]>(["Search"]);

  const toggleChip = (chip: string) => {
    setActiveChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  // Initial prompt handler from URL
  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate smart AI response
    setTimeout(() => {
      let aiContent = `I analyzed your request against current state procurement guidelines and Vericore's indexed capability profile.\n\n### Key Findings & Recommendations:\n1. **Technical Fit**: High alignment (94%). Your past performance with TxDOT 2024 satisfies mandatory experience criteria.\n2. **Compliance**: Verified ISO 27001 & SOC 2 Type II certificates meet RFP Clause 3.1.\n3. **Price Benchmark**: To achieve maximum score in the financial evaluation, aim for $4,480,000 (3.5% under competitor median).\n\nWould you like me to generate Section 2 of your proposal or draft an executive summary?`;

      if (text.toLowerCase().includes("executive") || text.toLowerCase().includes("summary")) {
        aiContent = `### Executive Summary Draft:\n\n**Vericore Technologies Inc.** is pleased to submit this comprehensive proposal to modernize and secure state transit infrastructure. Drawing upon 5+ years of mission-critical cloud engineering and an unblemished record of 99.98% operational uptime across Texas transit hubs, our solution guarantees zero-downtime database migration, FIPS 140-3 validated encryption, and 24/7 dedicated Austin-based SRE engineering support.\n\n*Ready to export to proposal builder.*`;
      } else if (text.toLowerCase().includes("compliance") || text.toLowerCase().includes("rfp")) {
        aiContent = `### RFP Compliance & Disqualification Scan:\n\n- **Mandatory Criteria 1 (ISO 27001)**: Passed (Valid through Nov 2027)\n- **Mandatory Criteria 2 (Local Key Personnel)**: Passed (Lead architect located in Austin, TX)\n- **Mandatory Criteria 3 (Performance Bond 10%)**: Pending Underwriter Letter\n- **Disqualification Hazards**: Liquidated damages clause 14.8 requires explicit acceptance; standard indemnification exclusion will trigger bid rejection.`;
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiContent,
        time: "Just now",
        chips: ["Generate Section 2", "Export to PDF", "Check Price Benchmark"],
      };

      setMessages((prev) => [...prev, aiMessage]);
    }, 700);
  };

  const handleQuickActionCard = (title: string, prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden select-none">
      {/* COLUMN 1: Slim Rail Navigation */}
      <BidlySidebar collapsed={true} />

      {/* COLUMN 2: Secondary Chats Sidebar (Bidly - AI.png) */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
        {/* Top + New Chat Button */}
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => {
              setMessages([]);
              setActiveChatId(`chat-${Date.now()}`);
            }}
            className="w-full py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Chats Input */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchChats}
              onChange={(e) => setSearchChats(e.target.value)}
              placeholder="Search chat history..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
          </div>
        </div>

        {/* Categorized Chats List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {chatSessions.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block">
                {group.period}
              </span>
              {group.chats
                .filter((c) =>
                  searchChats
                    ? c.title.toLowerCase().includes(searchChats.toLowerCase())
                    : true
                )
                .map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      if (messages.length === 0) {
                        handleSendMessage(`Summarize progress on ${chat.title}`);
                      }
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center gap-2 ${
                      activeChatId === chat.id
                        ? "bg-blue-50 text-blue-800 font-semibold border border-blue-200 shadow-xs"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{chat.title}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* COLUMN 3: Main Conversational Canvas */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
        {/* Top Model Selector Header */}
        <div className="h-14 px-8 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-slate-900">Bidly AI Assistant</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors">
              <Brain className="w-3.5 h-3.5 text-blue-600" />
              <span>{selectedModel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/bids"
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Open Proposal Studio</span>
            </Link>
          </div>
        </div>

        {/* Dynamic Chat Canvas */}
        {messages.length === 0 ? (
          /* HERO VIEW (Matching Bidly - AI.png) */
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl w-full mx-auto overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-4">
              <Sparkles className="w-7 h-7 fill-white" />
            </div>

            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 text-center">
              What can I help with?
            </h1>
            <p className="text-xs text-slate-500 mb-8 text-center max-w-md">
              Ask questions across 24+ live tender RFPs, evaluate win probability, check legal
              disqualification clauses, or generate technical proposal drafts.
            </p>

            {/* Centered Large Prompt Input Box (Bidly - AI.png) */}
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-4 space-y-3">
              <textarea
                rows={3}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask Bidly anything about your tenders, compliance, or proposal drafting..."
                className="w-full text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none bg-transparent"
              />

              {/* Action Chips & Submit Row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {/* 5 Chips: Attach, Search, Reason, Tender ID, Enhance Prompt */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => toggleChip("Attach")}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                      activeChips.includes("Attach")
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Attach</span>
                  </button>

                  <button
                    onClick={() => toggleChip("Search")}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                      activeChips.includes("Search")
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Search</span>
                  </button>

                  <button
                    onClick={() => toggleChip("Reason")}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                      activeChips.includes("Reason")
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Brain className="w-3 h-3" />
                    <span>Reason</span>
                  </button>

                  <button
                    onClick={() => toggleChip("Tender ID")}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                      activeChips.includes("Tender ID")
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Hash className="w-3 h-3" />
                    <span>Tender ID</span>
                  </button>

                  <button
                    onClick={() =>
                      setInputValue(
                        (prev) =>
                          "Act as a principal bid strategist. Evaluate win probability and generate a competitive response narrative for: " +
                          prev
                      )
                    }
                    className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span>Enhance Prompt</span>
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  onClick={() => handleSendMessage()}
                  className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition-transform hover:scale-105"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4 Action Cards Below Hero (Bidly - AI.png) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl mt-6">
              <div
                onClick={() =>
                  handleQuickActionCard(
                    "Analyze RFP Compliance",
                    "Scan DOT-IT-2026-8941 for mandatory disqualification criteria and penalty clauses."
                  )
                }
                className="bidly-card-interactive p-4 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Analyze RFP Compliance</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Upload an RFP to scan for mandatory criteria and disqualification risks.
                </p>
              </div>

              <div
                onClick={() =>
                  handleQuickActionCard(
                    "Generate Executive Summary",
                    "Draft a winning executive summary based on our company profile for the TxDOT cloud tender."
                  )
                }
                className="bidly-card-interactive p-4 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Generate Executive Summary</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Draft a winning executive summary based on your company capability profile.
                </p>
              </div>

              <div
                onClick={() =>
                  handleQuickActionCard(
                    "Compare Competitor Pricing",
                    "Benchmark historical winning bids for state transit and cloud infrastructure tenders."
                  )
                }
                className="bidly-card-interactive p-4 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Compare Competitor Pricing</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Benchmark historical winning bids for similar government IT tenders.
                </p>
              </div>

              <div
                onClick={() =>
                  handleQuickActionCard(
                    "Draft Technical Architecture",
                    "Generate dual-region cloud failover technical architecture narrative adhering to 99.95% SLA."
                  )
                }
                className="bidly-card-interactive p-4 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Draft Technical Architecture</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Create system architecture descriptions adhering to tender specifications.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE CONVERSATIONAL STREAM */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Scrollable chat messages */}
            <div className="flex-1 p-8 overflow-y-auto space-y-6 max-w-4xl w-full mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                      <Sparkles className="w-4 h-4 fill-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl p-5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-xs shadow-xs"
                        : "bg-white text-slate-800 rounded-bl-xs border border-slate-200 shadow-sm whitespace-pre-line"
                    }`}
                  >
                    <p>{msg.content}</p>

                    {msg.chips && (
                      <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100">
                        {msg.chips.map((chip, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(chip)}
                            className="px-3 py-1 text-xs font-semibold bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-full transition-colors"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Docked Input Box */}
            <div className="p-4 bg-white border-t border-slate-200 max-w-4xl w-full mx-auto rounded-t-2xl shadow-lg">
              <div className="relative">
                <textarea
                  rows={2}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask a follow-up or provide feedback..."
                  className="w-full p-3 pr-24 text-xs md:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 resize-none"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="absolute right-3 bottom-4 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BidlyCommandHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
          Loading Bidly AI Hub...
        </div>
      }
    >
      <CommandCenterContent />
    </Suspense>
  );
}
