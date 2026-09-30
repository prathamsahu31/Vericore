"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  FileSearch,
  Files,
  ScanSearch,
  Scale,
  ShieldCheck,
  Stamp,
  Eye,
  Gavel,
  Landmark,
  Clock,
  Check,
  AlertTriangle,
  FileCheck,
  Database,
  Hash,
  ArrowRight,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: any;
  color: string;
  status: "idle" | "working" | "done" | "needs_you";
  log: string;
  detail: string;
};

const AGENTS_INIT: Agent[] = [
  { id: "tender", name: "NIT Parser", role: "LLM • REASONING", icon: FileSearch, color: "#7B3A14", status: "done", log: "GEM/2026/B/7496914 → 15 checks extracted", detail: "Source spans + human gate" },
  { id: "sort", name: "Sorter", role: "Classifier", icon: Files, color: "#B78A2B", status: "done", log: "80pp bundle → 6 docs • 1 unclassified", detail: "Bookmarks + page-type + LLM confirm" },
  { id: "read", name: "Reader", role: "LLM • EXTRACTION", icon: ScanSearch, color: "#B78A2B", status: "working", log: "Reading GST cert p.1 • confidence 0.97", detail: "Quote → locator → bbox" },
  { id: "rules", name: "Rules", role: "Deterministic", icon: Scale, color: "#9B3A26", status: "idle", log: "Turnover avg • GST═PAN • dates queued", detail: "No LLM math — Python only" },
  { id: "verify", name: "Verifier", role: "Portal Adapter", icon: ShieldCheck, color: "#6B6B3E", status: "idle", log: "Udyam • GSTN • MCA • DigiLocker • PAN", detail: "source: live | simulated" },
  { id: "risk", name: "Risk Sentinel", role: "Counted reasons", icon: AlertTriangle, color: "#8E2E1F", status: "idle", log: "Flags counted separately from score", detail: "CRITICAL/HIGH/MEDIUM/LOW" },
  { id: "human", name: "You", role: "Officer • Human", icon: Stamp, color: "#2A1A10", status: "needs_you", log: "1 needs you • 2 mandatory failed", detail: "Accept / Seek clarification / Override + reason" },
];

const EVIDENCE = [
  { code: "REQ-03", name: "GST registration", status: "COMPLIANT", src: "gst_certificate.pdf p.1", conf: 0.97, loc: "exact" },
  { code: "REQ-04", name: "PAN • holder type C", status: "COMPLIANT", src: "pan_card.pdf p.1", conf: 0.99, loc: "exact" },
  { code: "REQ-01", name: "Avg turnover ≥ ₹100 Cr", status: "NEEDS_HUMAN_REVIEW", src: "ca_cert.pdf p.2", conf: 0.62, loc: "page_fallback" },
  { code: "REQ-07", name: "OEM authorisation", status: "MISSING_EVIDENCE", src: "—", conf: null, loc: "—" },
  { code: "REQ-12", name: "Certificate validity vs bid due", status: "EXPIRED", src: "iso_cert.pdf p.1", conf: 0.96, loc: "exact" },
  { code: "REQ-14", name: "Name consistency", status: "INCONSISTENT", src: "pan vs gst p.1", conf: 0.88, loc: "fuzzy 0.84" },
];

const AUDIT_TAPE = [
  "a3f7c9… prev: 000000 → tender: GEM/2026/B/7496914 uploaded sha256:e3b0c4…",
  "b8d2e1… prev: a3f7c9 → requirements extracted 15 items (model: gemini-2.0-flash, reasoning)",
  "c1a4f5… prev: b8d2e1 → bidder A docs: 6 files • hash: 9f2c…",
  "d6e8a2… prev: c1a4f5 → REQ-03 COMPLIANT (gst p.1 exact) • confidence 0.97",
  "e9c0b3… prev: d6e8a2 → cross-doc INCONSISTENT pan≠gst flagged",
  "f2d5e7… prev: e9c0b3 → officer 1d537368 override REQ-01 → COMPLIANT (reason recorded)",
];

export default function CommandPage() {
  const [agents, setAgents] = useState<Agent[]>(AGENTS_INIT);
  const [active, setActive] = useState(2);
  const [paused, setPaused] = useState(false);
  const [evidenceIdx, setEvidenceIdx] = useState(0);
  const tapeRef = useRef<HTMLDivElement>(null);

  // Cycle active agent
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((a) => {
        const next = (a + 1) % agents.length;
        setAgents((prev) => prev.map((ag, i) => {
          if (i === next) return { ...ag, status: ag.id === "human" ? "needs_you" : "working" as const };
          if (i === a) return { ...ag, status: "done" as const };
          return ag;
        }));
        return next;
      });
    }, 1800);
    return () => clearInterval(id);
  }, [paused, agents.length]);

  // Evidence ticker
  useEffect(() => {
    const id = setInterval(() => setEvidenceIdx((i) => (i + 1) % EVIDENCE.length), 1400);
    return () => clearInterval(id);
  }, []);

  // Tape auto-scroll
  useEffect(() => {
    const el = tapeRef.current;
    if (!el) return;
    const id = setInterval(() => {
      el.scrollLeft += 1;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth) el.scrollLeft = 0;
    }, 30);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/20">
      {/* Govt rail */}
      <div className="border-b border-[#D8C4A6] bg-[#FFF1D6] text-[#5A2610]">
        <div className="mx-auto max-w-[1280px] px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <Landmark className="h-3.5 w-3.5" /> भारत सरकार · Government of India · Ministry of Petroleum & Natural Gas · CPCL · GeM
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#5B6B3A] animate-pulse" /> Dak Room • Live</span>
            <span className="rounded border border-[#D8C4A6] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">File: GEM/2026/B/7496914</span>
            <span className="hidden md:inline text-[#9A8B7F]">Bid due: 2024-03-31 • Audit: hash-chained</span>
          </span>
        </div>
      </div>

      <SiteHeader />

      {/* Header */}
      <div className="mx-auto max-w-[1280px] px-6 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 border border-[#D8C4A6] bg-white px-3 py-1 text-[11px] font-bold text-[#7B3A14]">
              <Sparkles className="h-3.5 w-3.5" /> Agentic Command — 7 agents, one ledger
            </div>
            <h1 className="mt-3 font-display text-[32px] font-black tracking-tight sm:text-[40px]">The Dak Room is open.</h1>
            <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-muted">
              Not a dashboard. A registry table where each agent sits at its desk, stamps its work, and pushes the file to the next. You watch the paper move. Every stamp cites a page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaused((p) => !p)} className="inline-flex items-center gap-2 border border-rule bg-white px-4 py-2 text-[13px] font-semibold hover:border-seal">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Resume" : "Pause"}
            </button>
            <Link href="/tenders" className="bg-seal px-5 py-2.5 text-[13px] font-bold text-white hover:bg-seal-strong">Open workspace <ArrowRight className="ml-1 inline h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      {/* AGENTS — desks */}
      <section className="mx-auto max-w-[1280px] px-6 mt-8">
        <div className="grid gap-4 lg:grid-cols-7">
          {agents.map((a, i) => {
            const Icon = a.icon;
            const isActive = i === active;
            return (
              <motion.div
                key={a.id}
                layout
                onClick={() => setActive(i)}
                className={`relative overflow-hidden rounded border bg-surface p-4 cursor-pointer transition-all ${isActive ? "border-seal ring-1 ring-seal/20" : "border-rule/80 hover:border-seal/30"}`}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-white text-seal" style={{ borderColor: a.color, color: a.color }}><Icon className="h-4 w-4" /></span>
                  <span className={`h-2 w-2 rounded-full ${a.status === "working" ? "bg-amber-500 animate-pulse" : a.status === "done" ? "bg-[#5B6B3A]" : a.status === "needs_you" ? "bg-[#8E2E1F] animate-pulse" : "bg-ink-faint"}`} />
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: a.color }}>{a.role}</p>
                <p className="text-[13px] font-bold leading-tight">{a.name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted line-clamp-2">{a.log}</p>
                {isActive && (
                  <motion.div layoutId="agent-bar" className="absolute bottom-0 left-0 h-1 bg-seal" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1.6 }} />
                )}
                <div className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  {a.status === "working" && <><Clock className="h-3 w-3" /> Working</>}
                  {a.status === "done" && <><Check className="h-3 w-3 text-[#5B6B3A]" /> Stamped</>}
                  {a.status === "needs_you" && <><Gavel className="h-3 w-3 text-[#8E2E1F]" /> Needs you</>}
                  {a.status === "idle" && <>Idle</>}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detail + flow */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded border border-rule bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-seal">Now at {agents[active].name}’s desk</p>
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="mt-2">
                <p className="text-[13px] font-semibold">{agents[active].detail}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{agents[active].log}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded border border-rule bg-surface px-2.5 py-1 font-mono text-[11px]">file: GEM/2026/B/7496914</span>
                  <span className="rounded border border-rule bg-surface px-2.5 py-1 text-[11px]">page + bbox cited</span>
                  <span className="rounded border border-rule bg-surface px-2.5 py-1 text-[11px] text-seal">stamp: {new Date().toLocaleTimeString()}</span>
                </div>
              </motion.div>
            </AnimatePresence>
            {/* Flow line */}
            <div className="mt-5 flex items-center gap-1 overflow-x-auto">
              {agents.map((a, i) => (
                <div key={a.id} className="flex items-center gap-1 shrink-0">
                  <div className={`h-2 w-2 rounded-full ${i <= active ? "bg-seal" : "bg-rule"}`} />
                  {i < agents.length - 1 && <div className={`h-px w-6 sm:w-10 ${i < active ? "bg-seal" : "bg-rule"}`} />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-rule bg-surface p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Government touch — what you can cite</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded bg-white border border-rule p-3">
                <Landmark className="h-4 w-4 text-seal" />
                <p className="mt-2 text-xs font-bold">GeM Custom Bid</p>
                <p className="text-[11px] text-ink-muted">PQ table + ATC, not catalogue</p>
              </div>
              <div className="rounded bg-white border border-rule p-3">
                <Database className="h-4 w-4 text-seal" />
                <p className="mt-2 text-xs font-bold">One Postgres</p>
                <p className="text-[11px] text-ink-muted">17 tables, hash-chained audit</p>
              </div>
              <div className="rounded bg-white border border-rule p-3">
                <Hash className="h-4 w-4 text-seal" />
                <p className="mt-2 text-xs font-bold">Every stamp hashes</p>
                <p className="text-[11px] text-ink-muted">prev_hash → row_hash</p>
              </div>
              <div className="rounded bg-white border border-rule p-3">
                <FileCheck className="h-4 w-4 text-seal" />
                <p className="mt-2 text-xs font-bold">Simulated labelled</p>
                <p className="text-[11px] text-ink-muted">source: live | simulated</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EVIDENCE RIVER — live */}
      <section className="mx-auto max-w-[1280px] px-6 mt-6">
        <div className="rounded border border-rule bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3 bg-paper/60">
            <p className="text-[12px] font-bold flex items-center gap-2"><Eye className="h-4 w-4 text-seal" /> Evidence river — live verdicts</p>
            <span className="text-[11px] text-ink-faint">Click any row → Evidence ledger (page + bbox)</span>
          </div>
          <div className="divide-y divide-rule/60">
            {EVIDENCE.map((e, i) => (
              <motion.div key={e.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${evidenceIdx === i ? "bg-seal-tint" : "bg-white"} transition-colors`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-seal">{e.code}</span>
                  <span className="text-[13px] font-medium">{e.name}</span>
                    <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${e.status === "COMPLIANT" ? "bg-[#EAF6EC] border-[#5B6B3A] text-[#5B6B3A]" : e.status === "NEEDS_HUMAN_REVIEW" ? "bg-[#FFF1D6] border-[#9E5A18] text-[#9E5A18]" : e.status === "MISSING_EVIDENCE" ? "bg-ink/5 border-ink-faint text-ink-muted" : e.status === "EXPIRED" ? "bg-[#FFF1D6] border-[#9E5A18] text-[#9E5A18]" : "bg-[#FCE8E6] border-[#8E2E1F] text-[#8E2E1F]"}`}>{e.status}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-ink-faint">
                  <span className="font-mono">{e.src}</span>
                  <span className="hidden sm:inline">locator: {e.loc}</span>
                  {e.conf !== null && <span className="rounded bg-paper border border-rule px-2 py-0.5">{Math.round(e.conf * 100)}%</span>}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="px-5 py-3 bg-surface/50 text-[11px] text-ink-muted flex items-center justify-between">
            <span>15 requirements · Bidder A — mostly compliant · 3 need you</span>
            <Link href="/bids/demo" className="bg-seal px-3 py-1 text-xs font-bold text-white">Open ledger →</Link>
          </div>
        </div>
      </section>

      {/* AUDIT TAPE */}
      <section className="mx-auto max-w-[1280px] px-6 mt-6">
        <div className="rounded border border-rule bg-[#2A1A10] text-[#EFE1C6] p-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#D8C4A6] flex items-center gap-2"><Gavel className="h-3.5 w-3.5" /> Audit tape — append-only, hash-chained</p>
            <span className="text-[10px] font-mono text-[#9A8B7F]">trigger: raises on UPDATE/DELETE</span>
          </div>
          <div ref={tapeRef} className="mt-3 flex gap-4 overflow-x-auto scrollbar-none whitespace-nowrap pb-1">
            {AUDIT_TAPE.concat(AUDIT_TAPE).map((t, i) => (
              <span key={i} className="shrink-0 rounded border border-[#6E5A46] bg-white/5 px-3 py-1.5 font-mono text-[11px]">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <div className="mx-auto max-w-[1280px] px-6 py-10 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[12px] text-ink-faint">This dashboard is simulated. In production, <span className="font-mono">verification_runs</span> are polled via <span className="font-mono">FastAPI BackgroundTasks</span> — no Celery, no queue to operate.</p>
        <div className="flex gap-2">
          <Link href="/tenders/new" className="bg-seal px-5 py-2.5 text-sm font-bold text-white">Start a tender</Link>
          <Link href="/" className="border border-rule bg-white px-5 py-2.5 text-sm font-bold">Back to landing</Link>
        </div>
      </div>
    </div>
  );
}
