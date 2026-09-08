import type { ComplianceStatus, RiskLevel, Severity } from "../../types/api";

/**
 * Status is never conveyed by colour alone (CLAUDE.md §11 quality floor).
 * Every chip carries a mark, a text label and a colour, so it survives
 * greyscale printing and colour-blindness alike.
 */
const STATUS: Record<
  ComplianceStatus,
  { label: string; mark: string; fg: string; bg: string; border: string }
> = {
  COMPLIANT:           { label: "Compliant",    mark: "✓", fg: "var(--verified)", bg: "color-mix(in srgb, var(--verified) 9%, transparent)",       border: "color-mix(in srgb, var(--verified) 26%, transparent)" },
  NON_COMPLIANT:       { label: "Not met",      mark: "✕", fg: "var(--failed)",   bg: "color-mix(in srgb, var(--failed) 9%, transparent)",         border: "color-mix(in srgb, var(--failed) 26%, transparent)" },
  EXPIRED:             { label: "Expired",      mark: "✕", fg: "var(--failed)",   bg: "color-mix(in srgb, var(--failed) 9%, transparent)",         border: "color-mix(in srgb, var(--failed) 26%, transparent)" },
  INCONSISTENT:        { label: "Inconsistent", mark: "≠", fg: "var(--failed)",   bg: "color-mix(in srgb, var(--failed) 9%, transparent)",         border: "color-mix(in srgb, var(--failed) 26%, transparent)" },
  PARTIALLY_COMPLIANT: { label: "Partial",      mark: "◐", fg: "var(--review)",   bg: "color-mix(in srgb, var(--review) 9%, transparent)",         border: "color-mix(in srgb, var(--review) 26%, transparent)" },
  NEEDS_HUMAN_REVIEW:  { label: "Your review",  mark: "◆", fg: "var(--review)",   bg: "color-mix(in srgb, var(--review) 9%, transparent)",         border: "color-mix(in srgb, var(--review) 26%, transparent)" },
  UNVERIFIED:          { label: "Unverified",   mark: "?", fg: "var(--review)",   bg: "color-mix(in srgb, var(--review) 9%, transparent)",         border: "color-mix(in srgb, var(--review) 26%, transparent)" },
  MISSING_EVIDENCE:    { label: "No document",  mark: "○", fg: "var(--review)",   bg: "color-mix(in srgb, var(--review) 9%, transparent)",         border: "color-mix(in srgb, var(--review) 26%, transparent)" },
  NOT_APPLICABLE:      { label: "N/A",          mark: "–", fg: "var(--inactive)", bg: "color-mix(in srgb, var(--inactive) 9%, transparent)",      border: "color-mix(in srgb, var(--inactive) 26%, transparent)" },
};

export function StatusChip({
  status,
  overridden = false,
  size = "normal",
}: {
  status: ComplianceStatus;
  overridden?: boolean;
  size?: "normal" | "compact";
}) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border font-medium"
      style={{
        color: s.fg,
        background: s.bg,
        borderColor: s.border,
        fontSize: size === "compact" ? "11px" : "13px",
        padding: size === "compact" ? "1px 6px" : "3px 8px",
      }}
      title={overridden ? `${s.label} — recorded by the officer` : s.label}
    >
      <span aria-hidden>{s.mark}</span>
      {s.label}
      {overridden && <span aria-hidden title="Officer's verdict">·⌂</span>}
    </span>
  );
}

export function statusLabel(status: ComplianceStatus) {
  return STATUS[status].label;
}

const RISK: Record<RiskLevel, { fg: string; mark: string }> = {
  LOW:      { fg: "var(--verified)", mark: "▁" },
  MEDIUM:   { fg: "var(--review)",   mark: "▄" },
  HIGH:     { fg: "var(--review)",   mark: "▆" },
  CRITICAL: { fg: "var(--failed)",   mark: "█" },
};

export function RiskChip({ level }: { level: RiskLevel | null }) {
  if (!level) return <span className="text-ink-faint">—</span>;
  const r = RISK[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: r.fg }}>
      <span aria-hidden>{r.mark}</span>
      {level.charAt(0) + level.slice(1).toLowerCase()} risk
    </span>
  );
}

const SEVERITY: Record<Severity, { fg: string; label: string; mark: string }> = {
  critical: { fg: "var(--failed)",   label: "Critical", mark: "▲" },
  high:     { fg: "var(--failed)",   label: "High",     mark: "▲" },
  warning:  { fg: "var(--review)",   label: "Medium",   mark: "◆" },
  info:     { fg: "var(--inactive)", label: "Note",     mark: "•" },
};

export function SeverityMark({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: s.fg }}>
      <span aria-hidden>{s.mark}</span>
      {s.label}
    </span>
  );
}

/**
 * Simulated data carries a visible chip everywhere it appears, including in
 * exports. CLAUDE.md §2 rule 2 — non-negotiable.
 */
export function SourceChip({ source }: { source: "live" | "simulated" | null }) {
  if (!source) return null;
  const simulated = source === "simulated";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-px text-[11px]"
      style={{
        color: simulated ? "var(--review)" : "var(--verified)",
        borderColor: simulated
          ? "color-mix(in srgb, var(--review) 30%, transparent)"
          : "color-mix(in srgb, var(--verified) 30%, transparent)",
        background: simulated
          ? "color-mix(in srgb, var(--review) 8%, transparent)"
          : "color-mix(in srgb, var(--verified) 8%, transparent)",
      }}
      title={
        simulated
          ? "Simulated — this check did not contact a live government system"
          : "Retrieved from a live source"
      }
    >
      {simulated ? "simulated" : "live"}
    </span>
  );
}

/**
 * Every identifier in the interface is monospaced (CLAUDE.md §11).
 */
export function Identifier({ value, className = "" }: { value: string | null; className?: string }) {
  if (!value) return <span className="text-ink-faint">—</span>;
  return <span className={`identifier ${className}`}>{value}</span>;
}
