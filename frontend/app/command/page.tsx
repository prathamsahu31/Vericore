"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  Layers,
  Activity,
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
  { id: "tender", name: "NIT Parser", role: "LLM · REASONING", icon: FileSearch, color: "#0F4C81", status: "done", log: "GEM/2026/B/7496914 → 15 checks extracted", detail: "Source spans + human gate" },
  { id: "sort", name: "Sorter", role: "Classifier", icon: Files, color: "#0F4C81", status: "done", log: "80pp bundle → 6 docs • 1 unclassified", detail: "Bookmarks + page-type + LLM confirm" },
  { id: "read", name: "Reader", role: "LLM · EXTRACTION", icon: ScanSearch, color: "#B7791F", status: "working", log: "Reading GST cert p.1 • confidence 0.97", detail: "Quote → locator → bbox" },
  { id: "rules", name: "Rules", role: "Deterministic", icon: Scale, color: "#16803C", status: "idle", log: "Turnover avg • GST═PAN • dates queued", detail: "No LLM math — Python only" },
  { id: "verify", name: "Verifier", role: "Portal Adapter", icon: ShieldCheck, color: "#0F4C81", status: "idle", log: "Udyam • GSTN • MCA • DigiLocker • PAN", detail: "source: live | simulated" },
  { id: "risk", name: "Risk Sentinel", role: "Counted reasons", icon: AlertTriangle, color: "#C53030", status: "idle", log: "Flags counted separately from score", detail: "CRITICAL/HIGH/MEDIUM/LOW" },
  { id: "human", name: "Officer", role: "Human Authority", icon: Stamp, color: "#111827", status: "needs_you", log: "1 needs you • 2 mandatory failed", detail: "Accept / Shortfall / Override + reason" },
];

const EVIDENCE = [
  { code: "REQ-03", name: "GST registration status", status: "COMPLIANT", src: "gst_certificate.pdf p.1", conf: 0.97, loc: "exact_quote" },
  { code: "REQ-04", name: "PAN • Holder Type C", status: "COMPLIANT", src: "pan_card.pdf p.1", conf: 0.99, loc: "exact_quote" },
  { code: "REQ-01", name: "Avg Turnover ≥ ₹10 Cr", status: "NEEDS_HUMAN_REVIEW", src: "ca_certificate.pdf p.2", conf: 0.62, loc: "page_fallback" },
  { code: "REQ-07", name: "OEM Authorisation", status: "MISSING_EVIDENCE", src: "—", conf: null, loc: "—" },
  { code: "REQ-12", name: "Certificate Validity vs Due", status: "EXPIRED", src: "iso_cert.pdf p.1", conf: 0.96, loc: "exact_quote" },
  { code: "REQ-14", name: "Name Consistency Cross-Doc", status: "INCONSISTENT", src: "pan vs gst p.1", conf: 0.88, loc: "fuzzy 0.84" },
];

const AUDIT_TAPE = [
  "a3f7c9… prev: 000000 → tender: GEM/2026/B/7496914 uploaded sha256:e3b0c4…",
  "b8d2e1… prev: a3f7c9 → requirements extracted 15 items (gemini-2.0-flash, reasoning)",
  "c1a4f5… prev: b8d2e1 → bidder A docs: 6 files • hash: 9f2c…",
  "d6e8a2… prev: c1a4f5 → REQ-03 COMPLIANT (gst p.1 exact) • confidence 0.97",
  "e9c0b3… prev: d6e8a2 → cross-doc INCONSISTENT pan≠gst flagged",
  "f2d5e7… prev: e9c0b3 → officer override REQ-01 → COMPLIANT (statutory reason sealed)",
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
        setAgents((prev) =>
          prev.map((ag, i) => {
            if (i === next)
              return {
                ...ag,
                status: ag.id === "human" ? "needs_you" : ("working" as const),
              };
            if (i === a) return { ...ag, status: "done" as const };
            return ag;
          }),
        );
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [paused, agents.length]);

  // Evidence ticker
  useEffect(() => {
    const id = setInterval(() => setEvidenceIdx((i) => (i + 1) % EVIDENCE.length), 1600);
    return () => clearInterval(id);
  }, []);

  // Tape auto-scroll
  useEffect(() => {
    const el = tapeRef.current;
    if (!el) return;
    const id = setInterval(() => {
      el.scrollLeft += 1;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth) el.scrollLeft = 0;
    }, 35);
    return () => clearInterval(id);
  }, []);

  const activeAgent = agents[active];

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      {/* Govt Sub-Banner */}
      <div className="border-b border-rule bg-surface-muted text-ink-muted">
        <div className="mx-auto max-w-[1240px] px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-2 font-medium">
            <Landmark className="h-3.5 w-3.5 text-seal" />
            <span>Government of India · Ministry of Petroleum & Natural Gas · CPCL · GeM SIH26100</span>
          </span>
          <div className="flex items-center gap-3 font-mono">
            <span className="flex items-center gap-1 text-verified font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-verified animate-pulse" />
              <span>Pipeline Active</span>
            </span>
            <span className="text-rule">·</span>
            <span className="text-ink-faint">Audit: Hash-Chained</span>
          </div>
        </div>
      </div>

      <SiteHeader />

      {/* Header */}
      <div className="mx-auto max-w-[1240px] px-6 pt-8 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-[2px] border border-rule bg-surface px-2.5 py-0.5 text-[11px] font-mono font-semibold text-seal">
              <Layers size={13} />
              <span>Multi-Agent Modular Architecture · 7 Roles, 1 Ledger</span>
            </div>
            <h1 className="mt-2 font-serif text-[28px] sm:text-[34px] font-semibold text-ink leading-tight">
              Engine Pipeline Command Console
            </h1>
            <p className="mt-1 max-w-[65ch] text-[13px] text-ink-muted leading-relaxed">
              Every stage of the nine-layer pipeline operates with explicit role isolation.
              The LLM extracts and narrates; deterministic code judges; the procurement officer decides.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-rule bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-muted hover:border-ink hover:text-ink transition-colors"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              <span>{paused ? "Resume Animation" : "Pause"}</span>
            </button>
            <Link
              href="/tenders"
              className="inline-flex items-center gap-1 rounded-[3px] bg-seal px-4 py-2 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors"
            >
              <span>Tender Registry</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* 7 Pipeline Agents / Desks */}
      <section className="mx-auto max-w-[1240px] px-6 mt-6">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          {agents.map((a, i) => {
            const Icon = a.icon;
            const isActive = i === active;
            return (
              <div
                key={a.id}
                onClick={() => setActive(i)}
                className={`relative rounded-[4px] border p-3.5 cursor-pointer transition-all ${
                  isActive
                    ? "border-seal bg-surface ring-1 ring-seal/20 panel-shadow"
                    : "border-rule bg-surface hover:bg-surface-subtle"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-[3px] border bg-surface-muted"
                    style={{ borderColor: a.color, color: a.color }}
                  >
                    <Icon size={14} />
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      a.status === "working"
                        ? "bg-amber-500 animate-pulse"
                        : a.status === "done"
                          ? "bg-verified"
                          : a.status === "needs_you"
                            ? "bg-failed animate-pulse"
                            : "bg-ink-faint"
                    }`}
                  />
                </div>

                <p className="mt-2.5 text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: a.color }}>
                  {a.role}
                </p>
                <p className="text-[13px] font-semibold text-ink leading-tight mt-0.5">{a.name}</p>
                <p className="mt-1 text-[11px] text-ink-muted line-clamp-2 leading-tight font-mono">{a.log}</p>

                <div className="mt-3 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  {a.status === "working" && <span>Working…</span>}
                  {a.status === "done" && <span className="text-verified">Done ✓</span>}
                  {a.status === "needs_you" && <span className="text-failed">Needs You ◆</span>}
                  {a.status === "idle" && <span>Idle</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Agent Detail Card */}
      <section className="mx-auto max-w-[1240px] px-6 mt-6">
        <div className="rounded-[4px] border border-rule bg-surface p-6 panel-shadow">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-seal tracking-wider">
                Stage {active + 1} of 7 · Role Inspection
              </span>
              <h2 className="font-serif text-[20px] font-semibold text-ink mt-0.5">
                {activeAgent.name} ({activeAgent.role})
              </h2>
            </div>
            <span className="rounded-[2px] bg-surface-muted border border-rule px-2.5 py-1 text-[11px] font-mono text-ink font-medium">
              {activeAgent.detail}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
            <div className="rounded-[3px] border border-rule bg-surface-subtle p-3">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-faint block">Design Principle</span>
              <p className="mt-1 text-ink-muted">
                {activeAgent.id === "tender" && "Extracts clause checklist from NIT prose with human officer review gate."}
                {activeAgent.id === "sort" && "PyMuPDF segmentation isolates discrete documents inside consolidated multi-file bundles."}
                {activeAgent.id === "read" && "Schema-constrained extraction with deterministic locator ladder (exact quote → bbox)."}
                {activeAgent.id === "rules" && "Strict Python rule execution: turnover averages, dates, GSTIN/PAN matching. Zero LLM math."}
                {activeAgent.id === "verify" && "Unified adapter interface with mandatory LIVE or SIMULATED labeling on every response."}
                {activeAgent.id === "risk" && "Counts distinct discrepancy flags. Kept strictly separate from the compliance score."}
                {activeAgent.id === "human" && "The officer decides. The system never qualifies or disqualifies bidders autonomously."}
              </p>
            </div>

            <div className="rounded-[3px] border border-rule bg-surface-subtle p-3">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-faint block">Audit Reference</span>
              <p className="mt-1 font-mono text-[12px] text-ink">
                sha256_event_chain · PostgreSQL append-only trigger prevents UPDATE and DELETE.
              </p>
            </div>

            <div className="rounded-[3px] border border-rule bg-surface-subtle p-3">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-faint block">Verification Status</span>
              <p className="mt-1 text-ink font-medium">
                Current Activity: <span className="font-mono text-seal">{activeAgent.log}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence Stream */}
      <section className="mx-auto max-w-[1240px] px-6 mt-6">
        <div className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-6 py-3.5 bg-surface-subtle">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Eye size={15} className="text-seal" />
              <span>Live Evidence Stream & Citations</span>
            </div>
            <span className="text-[11px] font-mono text-ink-faint">
              Traceable to exact PDF bounding box coordinates
            </span>
          </div>

          <div className="divide-y divide-rule font-mono text-[12px]">
            {EVIDENCE.map((e, i) => (
              <div
                key={e.code}
                className={`flex flex-wrap items-center justify-between gap-3 px-6 py-3 transition-colors ${
                  evidenceIdx === i ? "bg-seal-tint" : "bg-surface hover:bg-surface-subtle"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-seal">{e.code}</span>
                  <span className="font-sans font-medium text-ink">{e.name}</span>
                  <span
                    className={`rounded-[2px] px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider border ${
                      e.status === "COMPLIANT"
                        ? "bg-verified-bg border-verified-border text-verified"
                        : "bg-review-bg border-review-border text-review"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-ink-faint">
                  <span className="text-ink">{e.src}</span>
                  <span className="hidden sm:inline text-ink-muted">locator: {e.loc}</span>
                  {e.conf !== null && (
                    <span className="rounded-[2px] bg-surface-muted border border-rule px-1.5 py-0.2 text-ink">
                      {Math.round(e.conf * 100)}% conf
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audit Tape */}
      <section className="mx-auto max-w-[1240px] px-6 mt-6 pb-12">
        <div className="rounded-[4px] border border-rule bg-surface-muted p-4 panel-shadow">
          <div className="flex items-center justify-between border-b border-rule pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Gavel size={14} className="text-seal" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink">
                Append-Only Audit Stream (SHA-256 Chained)
              </span>
            </div>
            <span className="text-[10px] font-mono text-ink-faint">
              trigger: raises exception on UPDATE / DELETE
            </span>
          </div>

          <div
            ref={tapeRef}
            className="flex gap-3 overflow-x-auto whitespace-nowrap pb-1 font-mono text-[11px]"
          >
            {AUDIT_TAPE.concat(AUDIT_TAPE).map((t, i) => (
              <span
                key={i}
                className="shrink-0 rounded-[2px] border border-rule bg-surface px-3 py-1.5 text-ink-muted"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
