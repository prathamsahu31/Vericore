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
  /** Advisory narrative (layer 8) — labelled as advice, never as a decision (§11). */
  recommendation_text: string | null;
  recommendation_action: string | null;
  recommendation_cited_requirements: string[];
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


// ── Comparison across bidders (architecture.md §9.4) ────────────────────────
export interface ComparisonBidder {
  bid_id: string;
  bidder_name: string;
  compliance_score: string | null;
  risk_level: RiskLevel | null;
  mandatory_failed: string[];
  pending_review: string[];
  qualifiable: boolean;
  verified: boolean;
}

export interface ComparisonCell {
  bid_id: string;
  status: ComplianceStatus | null;
  effective_status: ComplianceStatus | null;
  overridden: boolean;
}

export interface ComparisonRow {
  requirement_code: string;
  requirement_name: string;
  category: string | null;
  mandatory: boolean;
  weight: string;
  applicability_scope: string;
  cells: ComparisonCell[];
  /** The bidders do not all land in the same place on this condition. */
  differentiating: boolean;
}

export interface Comparison {
  tender_id: string;
  tender_title: string;
  bid_due_date: string | null;
  bidders: ComparisonBidder[];
  requirements: ComparisonRow[];
}

// ── Tender setup and bidder upload (CLAUDE.md §11 screens 1–2) ───────────────
export type TenderStatus =
  | "draft"
  | "requirements_extracted"
  | "requirements_confirmed"
  | "closed";

export interface Tender {
  id: string;
  title: string;
  bid_number: string | null;
  buyer_organisation: string | null;
  bid_due_date: string | null;
  estimated_value: string | null;
  status: TenderStatus;
  requirements_confirmed_at: string | null;
}

export interface Requirement {
  id: string;
  code: string;
  name: string;
  category: string | null;
  raw_clause: string | null;
  normalized_clause: string | null;
  condition: Record<string, unknown> | null;
  mandatory: boolean;
  weight: string;
  applicability_scope: string;
  accepts_document_types: string[];
  required_fields: string[];
  external_check: string | null;
  source_page: number | null;
  source_clause_ref: string | null;
  confirmed: boolean;
  edited_by_officer: boolean;
  extraction_confidence: number | null;
}

export interface Bidder {
  id: string;
  legal_name: string;
  pan: string | null;
  gstin: string | null;
  udyam_urn: string | null;
  cin: string | null;
}

export type IngestionMode = "separate" | "auto_classify" | "merged";

export interface DocumentSummary {
  id: string;
  bid_id: string | null;
  original_filename: string;
  sha256: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  ingestion_mode: IngestionMode;
  uploaded_at: string;
}

export interface UploadSegment {
  id: string;
  doc_type: string;
  page_start: number;
  page_end: number;
  needs_review: boolean;
}

export interface UploadResult {
  document: DocumentSummary;
  segments: UploadSegment[];
  extracted_fields: ExtractedField[];
  fields_located: number;
  fields_unlocated: number;
  injection_suspected: boolean;
  duplicate_of: string[];
  extraction_error: string | null;
}
