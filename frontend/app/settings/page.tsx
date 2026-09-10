"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  User,
  Building,
  Sparkles,
  Bell,
  Shield,
  CreditCard,
  Upload,
  CheckCircle2,
  Trash2,
  Save,
  Check,
  Globe,
  Mail,
  Lock,
  FileText,
  Clock,
  ArrowRight,
  Database,
  Sliders,
} from "lucide-react";
import { BidlySidebar } from "@/components/layout/BidlySidebar";
import { BidlyHeader } from "@/components/layout/BidlyHeader";
import { MOCK_COMPANY_INFO } from "@/lib/bidlyData";

function SettingsHubContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "company";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: "Alex Morgan",
    email: "alex@vericore.ai",
    role: "Senior Bid Strategy Director",
    department: "Enterprise Government Solutions",
    timezone: "America/Chicago (CST)",
  });

  // Company Form State
  const [companyData, setCompanyData] = useState({
    legalName: MOCK_COMPANY_INFO.legalName,
    tradeName: MOCK_COMPANY_INFO.tradeName,
    regNumber: MOCK_COMPANY_INFO.registrationNumber,
    industry: MOCK_COMPANY_INFO.industry,
    taxId: MOCK_COMPANY_INFO.taxId,
    headquarters: MOCK_COMPANY_INFO.headquarters,
    website: MOCK_COMPANY_INFO.website,
    employees: MOCK_COMPANY_INFO.employeeCount,
    revenue: MOCK_COMPANY_INFO.annualRevenue,
    clearance: MOCK_COMPANY_INFO.clearanceLevel,
  });

  // Notification Toggles
  const [notifications, setNotifications] = useState({
    dailyDigest: true,
    urgentClosing: true,
    bidStatusChanges: true,
    aiAnalysisAlerts: true,
    emailChannel: true,
    inAppChannel: true,
    smsUrgent: false,
  });

  // Capability Memory files
  const [knowledgeDocs, setKnowledgeDocs] = useState(
    MOCK_COMPANY_INFO.uploadedKnowledgeDocs
  );

  const [capabilities, setCapabilities] = useState(MOCK_COMPANY_INFO.capabilities);
  const [newTagInput, setNewTagInput] = useState("");

  const handleSave = () => {
    setSaveFeedback(true);
    setTimeout(() => {
      setSaveFeedback(false);
    }, 2000);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim() && !capabilities.includes(newTagInput.trim())) {
      setCapabilities((prev) => [...prev, newTagInput.trim()]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setCapabilities((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <BidlySidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <BidlyHeader
          title="Settings & Organization Profile"
          subtitle="Configure enterprise parameters & AI memory"
          badge="Enterprise Tier"
        />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Left 2-Level Settings Navigation (Settings.png) */}
            <div className="md:col-span-1 space-y-6">
              {/* Account Section */}
              <div className="bidly-card p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block">
                  Account Settings
                </span>

                <button
                  onClick={() => setActiveTab("profile")}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeTab === "profile"
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Personal Profile</span>
                </button>

                <button
                  onClick={() => setActiveTab("company")}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeTab === "company"
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>Company Information</span>
                </button>

                <button
                  onClick={() => setActiveTab("capability")}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition-colors text-left ${
                    activeTab === "capability"
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Capability Matching</span>
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800">
                    AI
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("notifications")}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeTab === "notifications"
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Bell className="w-4 h-4 text-slate-400" />
                  <span>Notifications & Alerts</span>
                </button>
              </div>

              {/* System Section */}
              <div className="bidly-card p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block">
                  System & Security
                </span>

                <button
                  onClick={() => setActiveTab("security")}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeTab === "security"
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Security & SSO</span>
                </button>

                <button
                  onClick={() => setActiveTab("billing")}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeTab === "billing"
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <span>Plan & Billing</span>
                </button>
              </div>
            </div>

            {/* Right Main Panel: Dynamic Tab View */}
            <div className="md:col-span-3 space-y-6">
              {/* TAB 1: COMPANY INFORMATION (Settings - Company Information.png) */}
              {activeTab === "company" && (
                <div className="bidly-card p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Company Information</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        This data automatically populates your RFP bid proposals, tax schedules, and officer certifications.
                      </p>
                    </div>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      {saveFeedback ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Legal Business Name
                      </label>
                      <input
                        type="text"
                        value={companyData.legalName}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, legalName: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Trade Name / DBA
                      </label>
                      <input
                        type="text"
                        value={companyData.tradeName}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, tradeName: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Business Registration Number (EIN)
                      </label>
                      <input
                        type="text"
                        value={companyData.regNumber}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, regNumber: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Primary Sector / Industry
                      </label>
                      <input
                        type="text"
                        value={companyData.industry}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, industry: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Headquarters Physical Address
                      </label>
                      <input
                        type="text"
                        value={companyData.headquarters}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, headquarters: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Website URL</label>
                      <input
                        type="text"
                        value={companyData.website}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, website: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Employee Count
                      </label>
                      <input
                        type="text"
                        value={companyData.employees}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, employees: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Annual Revenue Bracket
                      </label>
                      <input
                        type="text"
                        value={companyData.revenue}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, revenue: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Security Facility Clearance Level
                      </label>
                      <input
                        type="text"
                        value={companyData.clearance}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, clearance: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CAPABILITY MATCHING & AI MEMORY (Settings - Capability Matching.png) */}
              {activeTab === "capability" && (
                <div className="space-y-6">
                  {/* Core Memory Upload Zone */}
                  <div className="bidly-card p-6">
                    <div className="flex items-center gap-2 text-blue-700 mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Bidly Core AI Memory
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mb-1">
                      Knowledge Base & Capability Documents
                    </h2>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                      Upload past winning proposals, case studies, audit reports, and capability
                      statements. Bidly indexes these into vector memory to automatically match RFP
                      specifications and cite verified past performance.
                    </p>

                    {/* Drag and drop upload zone */}
                    <div
                      onClick={() => alert("Document upload trigger...")}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Drag &amp; drop PDF, DOCX, or XLSX capability files here
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Support for up to 50MB per file. Automatically parsed for ISO, FAR, and technical credentials.
                      </span>
                    </div>
                  </div>

                  {/* Indexed Documents List */}
                  <div className="bidly-card p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                      <span>Indexed Memory Documents ({knowledgeDocs.length})</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vector Synced
                      </span>
                    </h3>

                    <div className="divide-y divide-slate-100">
                      {knowledgeDocs.map((doc, idx) => (
                        <div
                          key={idx}
                          className="py-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 rounded-lg px-2 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                              PDF
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{doc.name}</span>
                              <span className="text-[11px] text-slate-400">
                                {doc.size} • Indexed {doc.date}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {doc.status}
                            </span>
                            <button
                              onClick={() =>
                                setKnowledgeDocs((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extracted Capability Tags */}
                  <div className="bidly-card p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      Recognized Organizational Competencies
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      These tags drive automated fit scores and requirement matching during tender discovery.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {capabilities.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                        >
                          <span>{tag}</span>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <form onSubmit={handleAddTag} className="flex gap-2 max-w-sm">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="Add capability or certification..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                      >
                        Add Tag
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS & ALERTS (Settings - Notifications & Alerts.png) */}
              {activeTab === "notifications" && (
                <div className="bidly-card p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Notifications &amp; Alerts</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure automated alerts for newly released tenders, closing deadlines, and AI evaluation runs.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Toggle 1: Daily Digest */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/40">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Daily Tender Intelligence Digest
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Receive an 8:00 AM summary of all state &amp; federal solicitations matching your capability profile.
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setNotifications({
                            ...notifications,
                            dailyDigest: !notifications.dailyDigest,
                          })
                        }
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          notifications.dailyDigest ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            notifications.dailyDigest ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 2: Closing Soon */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/40">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Urgent Closing Tender Warnings (48h)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          High-priority push notifications when followed tenders approach the final submission window.
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setNotifications({
                            ...notifications,
                            urgentClosing: !notifications.urgentClosing,
                          })
                        }
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          notifications.urgentClosing ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            notifications.urgentClosing ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 3: Bid Status Updates */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/40">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Bid Status &amp; Addenda Alerts
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Instant notice when official addenda, clarifications, or award decisions are filed by the agency.
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setNotifications({
                            ...notifications,
                            bidStatusChanges: !notifications.bidStatusChanges,
                          })
                        }
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          notifications.bidStatusChanges ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            notifications.bidStatusChanges ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 4: AI Analysis Alerts */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/40">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          AI Win Rate &amp; Risk Re-evaluations
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Receive alerts when competitor intelligence triggers a recalculation of win probability.
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setNotifications({
                            ...notifications,
                            aiAnalysisAlerts: !notifications.aiAnalysisAlerts,
                          })
                        }
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          notifications.aiAnalysisAlerts ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            notifications.aiAnalysisAlerts ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PERSONAL PROFILE */}
              {activeTab === "profile" && (
                <div className="bidly-card p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Personal Profile</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage your contact details and role representation on submitted bid packages.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white text-lg font-black shadow-md">
                      AM
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">Alex Morgan</span>
                      <span className="text-xs text-slate-500">Senior Bid Strategy Director</span>
                      <button
                        onClick={() => alert("Avatar upload dialog...")}
                        className="mt-1 text-[11px] text-blue-600 font-semibold hover:underline block"
                      >
                        Change Avatar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Role Title</label>
                      <input
                        type="text"
                        value={profileData.role}
                        onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                      <input
                        type="text"
                        value={profileData.timezone}
                        onChange={(e) =>
                          setProfileData({ ...profileData, timezone: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SECURITY & SSO */}
              {activeTab === "security" && (
                <div className="bidly-card p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Security &amp; Access Controls</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage enterprise Single Sign-On (SAML/Okta) and active API verification tokens.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          Enterprise SAML 2.0 / Okta SSO
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Enforces organization-wide multi-factor authentication for bid officers.
                        </span>
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active &amp; Enforced
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          Audit Trail Retention
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Immutable logging of all AI queries, proposal edits, and officer sign-offs.
                        </span>
                      </div>
                      <span className="text-slate-700 font-semibold font-mono">
                        7 Years (FAR Compliant)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: PLAN & BILLING */}
              {activeTab === "billing" && (
                <div className="bidly-card p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Subscription &amp; Usage</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Your enterprise license includes unlimited tender tracking and AI proposal drafting.
                      </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Enterprise Unlimited
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Active Seats
                      </span>
                      <span className="text-2xl font-black text-slate-900">25 / 50</span>
                      <p className="text-[11px] text-slate-400 mt-1">Bid strategists &amp; reviewers</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        AI RFP Indexing
                      </span>
                      <span className="text-2xl font-black text-slate-900">Unlimited</span>
                      <p className="text-[11px] text-slate-400 mt-1">Full-text vector indexing</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Next Billing Date
                      </span>
                      <span className="text-2xl font-black text-slate-900">Jan 1, 2027</span>
                      <p className="text-[11px] text-slate-400 mt-1">Annual invoice prepaid</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
          Loading settings...
        </div>
      }
    >
      <SettingsHubContent />
    </Suspense>
  );
}
