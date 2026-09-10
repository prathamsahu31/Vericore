import type {
  AuditTrail,
  Bidder,
  Comparison,
  DocumentSummary,
  ExtractedField,
  Requirement,
  Tender,
  UploadResult,
  VerificationSummary,
} from "../types/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function tenderReportPageUrl(tenderId: string) {
  return `${BASE}/tenders/${tenderId}/report.html`;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function getCompliance(bidId: string) {
  return get<VerificationSummary>(`/bids/${bidId}/compliance`);
}

export function getComparison(tenderId: string) {
  return get<Comparison>(`/tenders/${tenderId}/comparison`);
}

export function getAudit(bidId: string) {
  return get<AuditTrail>(`/bids/${bidId}/audit`);
}

export function getDocuments(bidId: string) {
  return get<DocumentSummary[]>(`/bids/${bidId}/documents`);
}

export function getDocumentFields(documentId: string) {
  return get<ExtractedField[]>(`/documents/${documentId}/fields`);
}

export async function submitReview(
  bidId: string,
  body: {
    requirement_code: string;
    action: "accept" | "override";
    officer_id: string;
    reason: string;
    override_status?: string;
  },
): Promise<VerificationSummary> {
  return post(`/bids/${bidId}/review`, body);
}

// ── Tender setup ─────────────────────────────────────────────────────────────
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail ? String(payload.detail) : "Request failed.");
  }
  return payload as T;
}

async function del<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 204) return {} as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail ? String(payload.detail) : "Delete failed.");
  }
  return payload as T;
}

export function createTender(body: {
  title: string;
  bid_number?: string;
  buyer_organisation?: string;
  bid_due_date?: string;
  estimated_value?: string;
  contract_start_date?: string;
}) {
  return post<Tender>("/tenders", body);
}

export function getTender(tenderId: string) {
  return get<Tender>(`/tenders/${tenderId}`);
}

export function deleteTender(tenderId: string) {
  return del(`/tenders/${tenderId}`);
}

export function listTenders() {
  return get<Tender[]>("/tenders");
}

export function uploadNit(tenderId: string, file: File) {
  return uploadFile<DocumentSummary>(`/tenders/${tenderId}/document`, file);
}

export function extractRequirements(tenderId: string) {
  return post<Requirement[]>(`/tenders/${tenderId}/extract-requirements`, {});
}

export function getRequirements(tenderId: string) {
  return get<Requirement[]>(`/tenders/${tenderId}/requirements`);
}

export function updateRequirement(
  requirementId: string,
  changes: {
    name?: string;
    mandatory?: boolean;
    weight?: number;
    applicability_scope?: string;
    external_check?: string;
  },
) {
  return patch<Requirement>(`/requirements/${requirementId}`, changes);
}

export function confirmRequirements(tenderId: string, officerId: string) {
  // Send officer ID in request body to avoid 422 errors when query params are rejected
  return post<Tender>(`/tenders/${tenderId}/confirm-requirements`, { officer_id: officerId });
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail ? String(payload.detail) : "Request failed.");
  }
  return payload as T;
}

// ── Bidder upload ────────────────────────────────────────────────────────────
async function uploadFile<T>(path: string, file: File, extra?: Record<string, string>): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(extra ?? {})) {
    form.append(key, value);
  }
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail ? String(payload.detail) : "Upload failed.");
  }
  return payload as T;
}

export function createBidder(body: {
  legal_name: string;
  pan?: string;
  gstin?: string;
  udyam_urn?: string;
  cin?: string;
}) {
  return post<Bidder>("/bidders", body);
}

export function listBidders() {
  return get<Bidder[]>("/bidders");
}

export function createBid(body: { tender_id: string; bidder_id: string }) {
  return post<{ id: string; tender_id: string; created_at: string }>("/bids", body);
}

export function uploadDocument(
  bidId: string,
  file: File,
  ingestionMode: string,
  docType?: string,
) {
  const extra: Record<string, string> = { ingestion_mode: ingestionMode };
  if (docType) extra.doc_type = docType;
  return uploadFile<UploadResult>(`/bids/${bidId}/documents`, file, extra);
}

export function verifyBid(bidId: string) {
  return post<VerificationSummary>(`/bids/${bidId}/verify`, {});
}

export function verifyAllBids(tenderId: string) {
  return post<VerificationSummary[]>(`/tenders/${tenderId}/verify-all`, {});
}
