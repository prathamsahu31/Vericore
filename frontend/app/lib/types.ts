/** Mirrors the API's response models. Kept narrow: only what the UI renders. */

export type ComplianceStatus =
  | "COMPLIANT"
  | "NON_COMPLIANT"
  | "PARTIALLY_COMPLIANT"
  | "MISSING_EVIDENCE"
  | "INCONSISTENT"
  | "EXPIRED"
  | "UNVERIFIED"
  | "NOT_APPLICABLE"
  | "NEEDS_HUMAN_REVIEW";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "info" | "warning" | "high" | "critical";
export type VerificationSource = "live" | "simulated";

export interface ComplianceRow {
  requirement_code: string;
  requirement_name: string;
  category: string | null;
  mandatory: boolean;
  weight: string;
  applicability_scope: string;
  /** What the system concluded. Never overwritten by an officer. */
  status: ComplianceStatus;
  reasoning: string | null;
  confidence: number | null;
  verification_method: string | null;
  external_check_portal: string | null;
  external_check_status: string | null;
  external_check_source: VerificationSource | null;
  evidence_field_ids: string[];
  /** The officer's verdict, stored alongside the machine's. */
  override_status: ComplianceStatus | null;
  override_reason: string | null;
  override_at: string | null;
  /** What the gate and the score actually count. */
  effective_status: ComplianceStatus | null;
}

export interface Finding {
  id: string;
  finding_type: string;
  severity: Severity;
  description: string;
  field_name: string | null;
  value_a: string | null;
  value_b: string | null;
  similarity_score: number | null;
}

export interface RiskFlag {
  id: string;
  code: string;
  category: string | null;
  severity: Severity;
  description: string;
}

export interface VerificationSummary {
  bid_id: string;
  bidder_name: string;
  run_status: string;
  bid_due_date: string | null;
  compliance_score: string | null;
  mandatory_gate_passed: boolean | null;
  /** Evaluated and found wanting. Only an override clears these. */
  mandatory_failed: string[];
  /** Unresolved, not failed. An acceptance clears these. */
  pending_review: string[];
  qualifiable: boolean;
  risk_level: RiskLevel | null;
  status_counts: Record<string, number>;
  requirements: ComplianceRow[];
  cross_document_findings: Finding[];
  risk_flags: RiskFlag[];
  external_checks_simulated: number;
  external_checks_live: number;
}

export interface ExtractedField {
  id: string;
  document_segment_id: string;
  field_name: string;
  field_value: string | null;
  source_span: string | null;
  page: number;
  x0: number; y0: number; x1: number; y1: number;
  locator_status: string;
  locator_score: number | null;
  confidence: number;
  llm_provider: string | null;
  llm_model_id: string | null;
}

export interface AuditEvent {
  seq: number;
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  actor_component: string | null;
  previous_state: string | null;
  new_state: string | null;
  reason: string | null;
  llm_provider: string | null;
  llm_model_id: string | null;
  prev_hash: string;
  row_hash: string;
  created_at: string;
}

export interface AuditTrail {
  integrity: {
    total_events: number;
    intact: boolean;
    first_broken_seq: number | null;
    head_hash: string | null;
  };
  events: AuditEvent[];
}
