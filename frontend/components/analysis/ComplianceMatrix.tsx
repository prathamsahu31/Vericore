"use client";

import { useMemo, useState } from "react";
import type { ComplianceRow, VerificationSummary } from "../../types/api";
import { Identifier, SourceChip, StatusChip } from "../ui/status";
import { ExternalLink, Filter } from "lucide-react";

const SCOPE_LABEL: Record<string, string> = {
  lead_only: "Lead Bidder",
  any_member: "Any Member",
  all_members: "All Members",
  aggregate: "Aggregate Consortium",
};

const CATEGORY_ORDER = [
  "statutory",
  "financial_eligibility",
  "experience",
  "technical",
  "bid_security",
  "declarations",
];

function categoryLabel(key: string | null) {
  if (!key) return "General Conditions";
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * ComplianceMatrix: The core document evaluation instrument.
 * Displays tender clauses against bidder evidence with audit traceability.
 */
export function ComplianceMatrix({
  summary,
  onSelect,
  selectedCode,
}: {
  summary: VerificationSummary;
  onSelect: (row: ComplianceRow) => void;
  selectedCode: string | null;
}) {
  const [filter, setFilter] = useState<
    "all" | "outstanding" | "mandatory" | "compliant" | "review"
  >("all");

  const grouped = useMemo(() => {
    const rows = summary.requirements.filter((r) => {
      const effective = r.effective_status ?? r.status;
      if (filter === "mandatory") return r.mandatory;
      if (filter === "outstanding") {
        return effective !== "COMPLIANT" && effective !== "NOT_APPLICABLE";
      }
      if (filter === "compliant") return effective === "COMPLIANT";
      if (filter === "review")
        return (
          effective === "NEEDS_HUMAN_REVIEW" ||
          effective === "MISSING_EVIDENCE" ||
          effective === "UNVERIFIED" ||
          effective === "PARTIALLY_COMPLIANT"
        );
      return true;
    });

    const buckets = new Map<string, ComplianceRow[]>();
    for (const row of rows) {
      const key = row.category ?? "other";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    }

    return [...buckets.entries()].sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a[0]) + 1 || 99) -
        (CATEGORY_ORDER.indexOf(b[0]) + 1 || 99),
    );
  }, [summary.requirements, filter]);

  const outstanding = summary.requirements.filter((r) => {
    const e = r.effective_status ?? r.status;
    return e !== "COMPLIANT" && e !== "NOT_APPLICABLE";
  }).length;

  return (
    <section className="rounded-[4px] border border-rule bg-surface panel-shadow overflow-hidden">
      {/* Table Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule bg-surface px-7 py-4.5">
        <div>
          <h2 className="font-serif text-[19px] font-semibold text-ink">
            Tender Eligibility Checklist
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {summary.requirements.length} conditions codified from NIT ·{" "}
            {outstanding === 0 ? (
              <span className="text-verified font-medium">All conditions satisfied</span>
            ) : (
              <span className="text-review font-medium">{outstanding} outstanding</span>
            )}
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter conditions">
          {(
            [
              ["all", "All Conditions"],
              ["outstanding", "Outstanding"],
              ["mandatory", "Mandatory Only"],
              ["compliant", "Compliant"],
              ["review", "Officer Review"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-[3px] border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === key
                  ? "border-seal bg-seal text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-ink-faint hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Checklist Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule bg-surface-subtle text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              <th scope="col" className="w-[100px] px-6 py-3 font-semibold">Ref Code</th>
              <th scope="col" className="px-6 py-3 font-semibold">Tender Requirement / Clause</th>
              <th scope="col" className="w-[180px] px-6 py-3 font-semibold">Scope & Verification</th>
              <th scope="col" className="w-[200px] px-6 py-3 font-semibold">Verdict & Evidence</th>
            </tr>
          </thead>

          {grouped.map(([category, rows]) => (
            <tbody key={category} className="border-b border-rule last:border-0">
              <tr>
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="border-t border-b border-rule bg-surface-muted px-6 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted"
                >
                  <div className="flex items-center justify-between">
                    <span>{categoryLabel(category)}</span>
                    <span className="text-[10px] font-normal text-ink-faint font-mono">
                      {rows.length} clause{rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </th>
              </tr>

              {rows.map((row) => {
                const effective = row.effective_status ?? row.status;
                const overridden = row.override_status !== null;
                const selected = selectedCode === row.requirement_code;

                return (
                  <tr
                    key={row.requirement_code}
                    onClick={() => onSelect(row)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(row);
                      }
                    }}
                    aria-selected={selected}
                    className={`cursor-pointer border-b border-rule-subtle align-top transition-colors group ${
                      selected
                        ? "bg-seal-tint/70 border-l-4 border-l-seal"
                        : "hover:bg-surface-subtle border-l-4 border-l-transparent"
                    }`}
                  >
                    {/* Ref Column */}
                    <td className="px-6 py-3.5">
                      <Identifier
                        value={row.requirement_code}
                        className="rounded-[2px] bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted border border-rule"
                      />
                      {row.mandatory && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-failed">
                          Mandatory
                        </p>
                      )}
                    </td>

                    {/* Condition Description */}
                    <td className="px-6 py-3.5">
                      <p className="text-[14px] font-medium text-ink leading-snug">
                        {row.requirement_name}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                        {Number(row.weight) > 0 && (
                          <span className="font-mono">Weight: {Number(row.weight)}</span>
                        )}
                        {row.external_check_portal && (
                          <span className="flex items-center gap-1.5 font-mono">
                            <span>Portal: {row.external_check_portal}</span>
                            <SourceChip source={row.external_check_source} />
                          </span>
                        )}
                      </div>

                      {row.reasoning && (
                        <p className="mt-2 line-clamp-2 max-w-[65ch] text-[12px] leading-relaxed text-ink-muted bg-surface-subtle/80 rounded-[2px] p-1.5 border border-rule-subtle">
                          {row.reasoning}
                        </p>
                      )}
                    </td>

                    {/* Scope & Verification Method */}
                    <td className="px-6 py-3.5">
                      <p className="text-[12px] font-medium text-ink">
                        {SCOPE_LABEL[row.applicability_scope] ?? row.applicability_scope}
                      </p>
                      {row.verification_method && (
                        <p className="mt-0.5 text-[11px] text-ink-faint font-mono">
                          {row.verification_method.replace(/_/g, " ")}
                        </p>
                      )}
                    </td>

                    {/* Verdict & Evidence Drill-Down */}
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusChip status={effective} overridden={overridden} />

                        {row.confidence !== null && (
                          <p className="text-[11px] text-ink-faint font-mono mt-0.5">
                            {Math.round(row.confidence * 100)}% confidence
                          </p>
                        )}

                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-seal opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Inspect page evidence</span>
                          <ExternalLink size={11} />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
