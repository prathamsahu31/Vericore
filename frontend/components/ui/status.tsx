import type { ComplianceStatus, RiskLevel, Severity } from "../../types/api";

/**
 * Status tokens: Restrained, accessible, institutional design.
 * Status is never conveyed by color alone. Every badge pairs an unambiguous symbol,
 * an exact text label, and subtle contrast background.
 */
const STATUS: Record<
  ComplianceStatus,
  { label: string; mark: string; fg: string; bg: string; border: string }
> = {
  COMPLIANT: {
    label: "Compliant",
    mark: "✓",
    fg: "#16803C",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  NON_COMPLIANT: {
    label: "Failed",
    mark: "✕",
    fg: "#C53030",
    bg: "#FEF2F2",
    border: "#FECACA",
  },
  EXPIRED: {
    label: "Expired",
    mark: "◷",
    fg: "#C53030",
    bg: "#FEF2F2",
    border: "#FECACA",
  },
  INCONSISTENT: {
    label: "Contradiction",
    mark: "≠",
    fg: "#C53030",
    bg: "#FEF2F2",
    border: "#FECACA",
  },
  PARTIALLY_COMPLIANT: {
    label: "Partial",
    mark: "◐",
    fg: "#B7791F",
    bg: "#FEFCE8",
    border: "#FEF08A",
  },
  NEEDS_HUMAN_REVIEW: {
    label: "Officer Review",
    mark: "◆",
    fg: "#B7791F",
    bg: "#FEFCE8",
    border: "#FEF08A",
  },
  UNVERIFIED: {
    label: "Unverified",
    mark: "?",
    fg: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
  },
  MISSING_EVIDENCE: {
    label: "Missing Doc",
    mark: "○",
    fg: "#B7791F",
    bg: "#FEFCE8",
    border: "#FEF08A",
  },
  NOT_APPLICABLE: {
    label: "Not Applicable",
    mark: "–",
    fg: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
  },
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
  const s = STATUS[status] ?? {
    label: status,
    mark: "•",
    fg: "#4B5563",
    bg: "#F3F4F6",
    border: "#D9DDE3",
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border font-medium leading-tight"
      style={{
        color: s.fg,
        backgroundColor: s.bg,
        borderColor: s.border,
        fontSize: size === "compact" ? "11px" : "12px",
        padding: size === "compact" ? "1px 6px" : "2.5px 8px",
      }}
      title={overridden ? `${s.label} — Override recorded by officer` : s.label}
    >
      <span aria-hidden="true" className="font-bold text-[11px]">{s.mark}</span>
      <span>{s.label}</span>
      {overridden && (
        <span
          className="ml-0.5 rounded-[2px] bg-seal/10 px-1 text-[9px] font-bold uppercase tracking-wider text-seal"
          title="Officer override recorded"
        >
          Officer
        </span>
      )}
    </span>
  );
}

export function statusLabel(status: ComplianceStatus) {
  return STATUS[status]?.label ?? status;
}

const RISK: Record<RiskLevel, { fg: string; bg: string; border: string; mark: string }> = {
  LOW: { fg: "#16803C", bg: "#F0FDF4", border: "#BBF7D0", mark: "LOW" },
  MEDIUM: { fg: "#B7791F", bg: "#FEFCE8", border: "#FEF08A", mark: "MED" },
  HIGH: { fg: "#B7791F", bg: "#FEFCE8", border: "#FEF08A", mark: "HIGH" },
  CRITICAL: { fg: "#C53030", bg: "#FEF2F2", border: "#FECACA", mark: "CRIT" },
};

export function RiskChip({ level }: { level: RiskLevel | null }) {
  if (!level) return <span className="text-ink-faint">—</span>;
  const r = RISK[level] ?? { fg: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", mark: level };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{
        color: r.fg,
        backgroundColor: r.bg,
        borderColor: r.border,
      }}
    >
      <span>{level.toLowerCase()} risk</span>
    </span>
  );
}

const SEVERITY: Record<Severity, { fg: string; bg: string; border: string; label: string; mark: string }> = {
  critical: { fg: "#C53030", bg: "#FEF2F2", border: "#FECACA", label: "Critical", mark: "▲" },
  high: { fg: "#C53030", bg: "#FEF2F2", border: "#FECACA", label: "High", mark: "▲" },
  warning: { fg: "#B7791F", bg: "#FEFCE8", border: "#FEF08A", label: "Warning", mark: "◆" },
  info: { fg: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", label: "Note", mark: "•" },
};

export function SeverityMark({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.info;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: s.fg,
        backgroundColor: s.bg,
        borderColor: s.border,
      }}
    >
      <span aria-hidden="true">{s.mark}</span>
      <span>{s.label}</span>
    </span>
  );
}

/**
 * Simulated data carries a visible chip everywhere it appears, including in exports.
 * Rule: Never allow a simulated result to masquerade as live government data.
 */
export function SourceChip({ source }: { source: "live" | "simulated" | null }) {
  if (!source) return null;
  const simulated = source === "simulated";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.2 text-[10px] font-mono uppercase tracking-wider font-semibold"
      style={{
        color: simulated ? "#B7791F" : "#16803C",
        borderColor: simulated ? "#FEF08A" : "#BBF7D0",
        backgroundColor: simulated ? "#FEFCE8" : "#F0FDF4",
      }}
      title={
        simulated
          ? "Simulated adapter check: Did not contact live government database (mocked for demo)"
          : "Live API check: Verified against active government registry"
      }
    >
      {simulated ? "simulated" : "live"}
    </span>
  );
}

/**
 * Identifiers (PAN, GSTIN, Udyam URN, CIN, Hashes, Coordinates) rendered in monospace
 * for unambiguous character-by-character inspection.
 */
export function Identifier({
  value,
  className = "",
}: {
  value: string | null;
  className?: string;
}) {
  if (!value) return <span className="text-ink-faint">—</span>;
  return <span className={`identifier font-mono text-[12px] tracking-wide ${className}`}>{value}</span>;
}
