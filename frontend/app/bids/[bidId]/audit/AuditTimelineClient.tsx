"use client";

import { useMemo, useState } from "react";
import { Identifier } from "@/components/ui/status";
import type { AuditEvent, VerificationSummary, AuditTrail } from "@/types/api";

type Props = {
  trail: AuditTrail;
  summary: VerificationSummary;
};

export default function AuditTimelineClient({ trail, summary }: Props) {
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState<"all" | "system" | "officer">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return trail.events.filter((e) => {
      if (actorFilter !== "all" && e.actor_type !== actorFilter) return false;
      if (typeFilter !== "all" && !e.event_type.includes(typeFilter)) return false;
      if (!q) return true;
      const hay = `${e.event_type} ${e.actor_type} ${e.actor_component ?? ""} ${e.reason ?? ""} ${e.previous_state ?? ""} ${e.new_state ?? ""} ${e.requirement_id ?? ""} ${e.llm_provider ?? ""} ${e.llm_model_id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [trail.events, search, actorFilter, typeFilter]);

  const byDay = useMemo(() => groupByDay(filtered), [filtered]);

  const hasFilters = search || actorFilter !== "all" || typeFilter !== "all";

  const handleExport = () => {
    const payload = {
      bidder: summary.bidder_name,
      bid_id: summary.bid_id,
      integrity: trail.integrity,
      exported_at: new Date().toISOString(),
      events: filtered,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${summary.bidder_name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (trail.events.length === 0) {
    return (
      <section className="overflow-hidden rounded-[6px] border border-rule bg-surface">
        <div className="px-7 py-10">
          <p className="font-serif text-[16px]">No history yet</p>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-muted">
            Upload this bidder&apos;s documents and run <span className="font-medium text-ink">Verify this bidder</span>{" "}
            (on the Compliance tab). The first system check will appear here, and any officer decision you
            record afterwards will sit alongside it with your name, time, and reason.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[6px] border border-rule bg-surface">
      {/* Header + controls */}
      <div className="border-b border-rule px-7 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="font-serif text-[20px]">What happened — in the order it was sealed</h2>
            <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-ink-muted">
              Read top to bottom: earlier actions are at the top, later ones at the bottom. Each card says{" "}
              <span className="font-medium text-ink">who acted, when, what they did, and why</span> — plain sentences
              an officer can quote. Technical hashes are tucked under &ldquo;Why this is trustworthy&rdquo;.
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            {hasFilters ? `${filtered.length} of ${trail.events.length} entries` : `${trail.events.length} entries`} · newest last
          </p>
        </div>

        {/* Filter bar — the improvement */}
        <div className="mt-4 flex flex-col gap-3 rounded-[6px] border border-rule bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reason, requirement, state, model…"
                className="w-full rounded-[4px] border border-rule bg-white px-3 py-2 text-[13px] placeholder:text-ink-faint focus:border-seal focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] text-ink-faint hover:bg-rule hover:text-ink"
                >
                  clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-[4px] border border-rule bg-white">
                {(["all", "system", "officer"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setActorFilter(v)}
                    className={`px-3 py-2 text-[12px] font-medium capitalize transition-colors ${actorFilter === v ? "bg-seal text-white" : "bg-white text-ink-muted hover:text-ink hover:bg-paper"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-[4px] border border-rule bg-white px-3 py-2 text-[12px] text-ink-muted focus:border-seal focus:outline-none"
              >
                <option value="all">All types</option>
                <option value="verification">Verification</option>
                <option value="document">Documents</option>
                <option value="officer">Officer</option>
                <option value="tender">Tender</option>
                <option value="requirement">Requirements</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-[4px] border border-rule bg-white px-3 py-2 text-[12px] font-medium text-ink-muted hover:border-seal hover:text-seal"
            >
              {expanded ? "Collapse details" : "Expand details"}
            </button>
            <button
              onClick={handleExport}
              className="rounded-[4px] bg-seal px-3 py-2 text-[12px] font-medium text-white hover:bg-seal-strong"
            >
              Export {hasFilters ? `(${filtered.length})` : ""} JSON
            </button>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setActorFilter("all");
                  setTypeFilter("all");
                }}
                className="rounded-[4px] border border-rule bg-white px-3 py-2 text-[12px] text-ink-faint hover:text-ink"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        {hasFilters && filtered.length === 0 && (
          <p className="mt-3 rounded-[4px] border border-rule bg-white px-3 py-2 text-[12px] text-ink-muted">
            No entries match your filters — try clearing search or switching &ldquo;All&rdquo;.
          </p>
        )}
      </div>

      <div className="px-7 py-6">
        <div className="relative">
          <div aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-rule" />
          <ol className="space-y-5">
            {Object.entries(byDay).map(([dayLabel, dayEvents]) => (
              <li key={dayLabel}>
                <p className="mb-3 ml-10 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  {dayLabel} · {dayEvents.length} {dayEvents.length === 1 ? "entry" : "entries"}
                </p>
                <ol className="space-y-4">
                  {dayEvents.map((event) => {
                    const human = humanizeEvent(event, summary);
                    const isOfficer = event.actor_type === "officer";
                    return (
                      <li key={event.id} className="relative ml-10">
                        <span
                          aria-hidden
                          className="absolute -left-[30px] top-[14px] h-[11px] w-[11px] rounded-full border-2 bg-white"
                          style={{
                            borderColor: isOfficer ? "var(--seal)" : "var(--rule)",
                            boxShadow: isOfficer ? "0 0 0 3px var(--seal-tint)" : undefined,
                          }}
                        />
                        <article
                          className={`overflow-hidden rounded-[6px] border bg-white ${isOfficer ? "border-seal/20" : "border-rule"}`}
                        >
                          <div className="px-5 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-medium leading-snug">
                                  <span
                                    className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${isOfficer ? "border-seal bg-seal-tint text-seal" : "border-rule bg-paper text-ink-faint"}`}
                                  >
                                    {isOfficer ? "officer" : human.actorLabel}
                                  </span>
                                  <span className="font-serif text-[16px]">{human.title}</span>
                                </h3>
                                <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                                  {formatDate(event.created_at)} · {relativeTime(event.created_at)} ·{" "}
                                  <span className="identifier">#{event.seq}</span> · by {human.actorSentence}
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${human.badgeClass}`}>
                                {human.badge}
                              </span>
                            </div>

                            <p className="mt-3 max-w-[76ch] text-[14px] leading-relaxed text-ink">{human.summary}</p>

                            {human.detail && (
                              <p className="mt-2 max-w-[76ch] rounded-[4px] border border-rule bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
                                {human.detail}
                              </p>
                            )}

                            {event.reason && human.showReason && (
                              <blockquote className="mt-3 border-l-2 border-seal/30 pl-3">
                                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                                  {isOfficer ? "Officer’s justification (required)" : "System note"}
                                </p>
                                <p className="mt-1 text-[13px] leading-relaxed text-ink">
                                  &ldquo;{tidyReason(event.reason)}&rdquo;
                                </p>
                              </blockquote>
                            )}

                            {human.nextSteps && (
                              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{human.nextSteps}</p>
                            )}
                          </div>

                          <details open={expanded} className="border-t border-rule bg-paper/60">
                            <summary className="cursor-pointer px-5 py-2 text-[11px] text-ink-faint hover:text-ink">
                              Why this is trustworthy — hashes, states, model
                            </summary>
                            <div className="space-y-2 px-5 py-3 text-[11px] leading-relaxed text-ink-faint">
                              <p>
                                <span className="font-medium text-ink">Seal:</span>{" "}
                                <Identifier value={`${event.row_hash.slice(0, 24)}…`} /> full{" "}
                                <Identifier value={event.row_hash.slice(0, 12)} className="text-ink-faint" /> · prev{" "}
                                <Identifier value={`${event.prev_hash.slice(0, 12)}…`} />
                              </p>
                              {(event.previous_state || event.new_state) && (
                                <p>
                                  <span className="font-medium text-ink">State change (raw):</span>{" "}
                                  <span className="identifier">{event.previous_state ?? "—"}</span>{" "}
                                  <span aria-hidden>→</span>{" "}
                                  <span className="identifier">{event.new_state ?? "—"}</span>{" "}
                                  <span className="text-ink-faint">— {human.stateHelp}</span>
                                </p>
                              )}
                              {event.requirement_id && (
                                <p>
                                  <span className="font-medium text-ink">Requirement:</span>{" "}
                                  <Identifier value={event.requirement_id.slice(0, 8)} />{" "}
                                  <span className="text-ink-faint">(code shown when payload exposes it; ID is the technical ref)</span>
                                </p>
                              )}
                              {event.llm_provider && (
                                <p>
                                  <span className="font-medium text-ink">Language model:</span>{" "}
                                  <Identifier value={event.llm_model_id ?? event.llm_provider} /> via{" "}
                                  <span className="identifier">{event.llm_provider}</span> · {human.llmHelp}
                                </p>
                              )}
                              <p className="text-[11px] text-ink-faint">
                                Sequence <span className="identifier">#{event.seq}</span> · stored at{" "}
                                <span className="identifier">{event.created_at}</span> (UTC) · tampering would break
                                every later seal.
                              </p>
                            </div>
                          </details>
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── helpers (copied from page, client-safe) ───────────────────────────────

function groupByDay(events: AuditEvent[]) {
  const groups: Record<string, AuditEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.created_at);
    const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    (groups[label] ??= []).push(e);
  }
  return groups;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const w = Math.round(days / 7);
  return `${w} week${w === 1 ? "" : "s"} ago`;
}

function humanizeStatus(s: string | null) {
  if (!s) return "—";
  const m: Record<string, string> = {
    COMPLIANT: "Compliant",
    NON_COMPLIANT: "Not compliant",
    PARTIALLY_COMPLIANT: "Partially compliant",
    MISSING_EVIDENCE: "Missing evidence",
    INCONSISTENT: "Contradicts other docs",
    EXPIRED: "Expired at bid due date",
    UNVERIFIED: "Could not be verified",
    NOT_APPLICABLE: "Not applicable",
    NEEDS_HUMAN_REVIEW: "Needs your review",
    LOW: "Low risk",
    MEDIUM: "Medium risk",
    HIGH: "High risk",
    CRITICAL: "Critical risk",
  };
  return m[s] ?? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function humanizeEventType(t: string) {
  const m: Record<string, string> = {
    verification_run_completed: "Automatic check finished",
    verification_run_started: "Automatic check started",
    document_uploaded: "Document uploaded",
    document_segmented: "Bundle split into documents",
    officer_accept: "Officer accepted a pending item",
    officer_override: "Officer overrode the system",
    officer_decision: "Officer recorded a decision",
    tender_created: "Tender created",
    requirements_extracted: "Checklist extracted from NIT",
    requirements_confirmed: "Checklist confirmed by officer",
  };
  return m[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Humanized = {
  title: string;
  summary: string;
  detail: string | null;
  showReason: boolean;
  nextSteps: string | null;
  actorLabel: string;
  actorSentence: string;
  badge: string;
  badgeClass: string;
  stateHelp: string;
  llmHelp: string;
};

function humanizeEvent(event: AuditEvent, summary: VerificationSummary): Humanized {
  const isOfficer = event.actor_type === "officer";
  const type = event.event_type;

  if (type === "verification_run_completed") {
    const risk = humanizeStatus(event.new_state);
    const signals = event.reason ?? "";
    const sigHuman = signals
      .replace("signal(s)", "risk signal(s)")
      .replace("No risk signals fired.", "No risk signals fired — nothing looks deceptive, which is not the same as having every document.");
    return {
      title: "System re-check finished",
      summary: `The rule engine and the language model re-read this bidder’s documents against all ${summary.requirements.length} tender conditions, ran arithmetic checks (turnover averaging, dates vs bid due date, GSTIN/PAN match), and left judgement-based items for you. ${sigHuman}`,
      detail: `Result now: score ${summary.compliance_score ?? "—"} · risk ${summary.risk_level ?? risk} · ${summary.status_counts.COMPLIANT ?? 0} compliant, ${summary.pending_review.length} need you, ${summary.mandatory_failed.length} mandatory not met. External checks: ${summary.external_checks_simulated} simulated, ${summary.external_checks_live} live.`,
      showReason: false,
      nextSteps:
        summary.pending_review.length > 0
          ? `Next: open the Compliance tab — ${summary.pending_review.length} items are waiting on your reading.`
          : summary.mandatory_failed.length > 0
            ? "Next: a mandatory condition failed — an override with a written reason is the only way to clear it."
            : "All mandatory items are satisfied or accepted — the officer’s decision can now be recorded on the Compliance tab.",
      actorLabel: "system",
      actorSentence: event.actor_component ? `the system (${event.actor_component})` : "the system",
      badge: risk,
      badgeClass: "bg-paper border border-rule text-ink-faint",
      stateHelp: "For system runs, the new state is the risk band (LOW → CRITICAL), not a requirement verdict.",
      llmHelp: "Shown when a field was read by a language model; every such field stores provider, model and confidence.",
    };
  }

  if (type === "officer_accept" || type === "officer_override") {
    const reqLabel = event.requirement_id ? `Requirement ${event.requirement_id.slice(0, 8)}…` : "A requirement";
    const from = humanizeStatus(event.previous_state);
    const to = humanizeStatus(event.new_state);
    const isAccept = type === "officer_accept";
    return {
      title: isAccept ? `${reqLabel} — you accepted it` : `${reqLabel} — you overrode the system`,
      summary: isAccept
        ? `You read the evidence for this condition and recorded that it satisfies you. The system had left it as “${from}” and you set it to “${to}”. Your justification below is sealed alongside the machine’s original verdict — neither erases the other.`
        : `You deliberately substituted a different verdict: the system said “${from}”, you set “${to}”. This is recorded as an override (stronger than an acceptance) and requires the reason below.`,
      detail: null,
      showReason: true,
      nextSteps: "This changes the mandatory gate and score immediately. Return to the Compliance tab to see the updated totals.",
      actorLabel: "officer",
      actorSentence: event.actor_id ? `Officer ${event.actor_id.slice(0, 8)}…` : "an officer (ID will show once sign-in is added)",
      badge: to,
      badgeClass: "bg-seal-tint border border-seal/20 text-seal",
      stateHelp: "Officer actions always keep the machine’s verdict in status and store the officer’s in override_status; scoring uses the latter.",
      llmHelp: "If this requirement was read by a model, its provider/model are kept on the original compliance row, not on this audit entry.",
    };
  }

  if (type.includes("document")) {
    return {
      title: humanizeEventType(type),
      summary: `A file was handled for this bid. The original PDF is kept by its SHA-256 hash so every later citation can open the exact page it came from.`,
      detail: null,
      showReason: true,
      nextSteps: null,
      actorLabel: isOfficer ? "officer" : "system",
      actorSentence: isOfficer ? "an officer" : event.actor_component ? `the system (${event.actor_component})` : "the system",
      badge: "Document",
      badgeClass: "bg-paper border border-rule text-ink-faint",
      stateHelp: "Document events track which files were considered; they never decide a verdict themselves.",
      llmHelp: "Extraction that follows may list a model; document handling itself does not.",
    };
  }

  if (type.includes("requirement") || type.includes("tender")) {
    return {
      title: humanizeEventType(type),
      summary: event.reason ? tidyReason(event.reason) : "The tender’s checklist was built or confirmed. Nothing is verified until the checklist is confirmed by an officer.",
      detail: null,
      showReason: false,
      nextSteps: "Officers confirm the checklist at the Tender Setup gate before any bidder is verified.",
      actorLabel: isOfficer ? "officer" : "system",
      actorSentence: isOfficer ? "an officer" : event.actor_component ? `the system (${event.actor_component})` : "the system",
      badge: "Checklist",
      badgeClass: "bg-paper border border-rule text-ink-faint",
      stateHelp: "Tender-level events don’t change a bidder’s verdict directly; they enable or gate verification.",
      llmHelp: event.llm_model_id ? `Checklist was read by ${event.llm_model_id}.` : "No model used.",
    };
  }

  return {
    title: humanizeEventType(type),
    summary:
      event.reason && event.reason.trim()
        ? tidyReason(event.reason)
        : `Recorded ${humanizeEventType(type).toLowerCase()} — ${fromToSentence(event.previous_state, event.new_state)}`,
    detail: null,
    showReason: !event.reason,
    nextSteps: null,
    actorLabel: isOfficer ? "officer" : "system",
    actorSentence: isOfficer ? "an officer" : event.actor_component ? `the system (${event.actor_component})` : "the system",
    badge: humanizeStatus(event.new_state) !== "—" ? humanizeStatus(event.new_state) : humanizeEventType(type),
    badgeClass: "bg-paper border border-rule text-ink-faint",
    stateHelp: "Raw previous → new states are shown collapsed below; the sentence above is the human version.",
    llmHelp: event.llm_model_id ? `Model ${event.llm_model_id} via ${event.llm_provider}.` : "No language model was involved in this step.",
  };
}

function fromToSentence(prev: string | null, next: string | null) {
  if (!prev && !next) return "no state change";
  if (!prev) return `now ${humanizeStatus(next).toLowerCase()}`;
  if (!next) return `was ${humanizeStatus(prev).toLowerCase()}`;
  return `${humanizeStatus(prev)} → ${humanizeStatus(next)}`.toLowerCase();
}

function tidyReason(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 420 ? `${cleaned.slice(0, 417)}…` : cleaned;
}
