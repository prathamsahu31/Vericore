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
} from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiErrorPayload = {
  detail?: unknown;
  error?: { code?: string; message?: string; detail?: { hint?: string } };
};

function asErrorMessage(path: string, response: Response, payload: ApiErrorPayload | null): string {
  const errorMessage = payload?.error?.message;
  if (typeof errorMessage === "string" && errorMessage.trim()) {
    const hint = payload?.error?.detail?.hint;
    return typeof hint === "string" && hint.trim() ? `${errorMessage} ${hint}` : errorMessage;
  }
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  return `${response.status} ${response.statusText} for ${path}`;
}

export function tenderReportPageUrl(tenderId: string) {
  return `${BASE}/tenders/${tenderId}/report.html`;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    throw new Error(asErrorMessage(path, response, payload));
  }
  return payload as T;
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

export function documentFileUrl(documentId: string) {
  return `${BASE}/documents/${documentId}/file`;
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
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    throw new Error(asErrorMessage(path, response, payload));
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
    normalized_clause?: string | null;
    category?: string | null;
    condition?: Record<string, unknown> | null;
    mandatory?: boolean;
    weight?: number;
    applicability_scope?: string;
    accepts_document_types?: string[];
    required_fields?: string[];
    external_check?: string | null;
  },
) {
  return patch<Requirement>(`/requirements/${requirementId}`, changes);
}

export function confirmRequirements(tenderId: string, officerId: string) {
  return post<Tender>(`/tenders/${tenderId}/confirm-requirements?officer_id=${officerId}`, {});
}

export async function deleteTender(tenderId: string): Promise<void> {
  const response = await fetch(`${BASE}/tenders/${tenderId}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new Error(asErrorMessage(`/tenders/${tenderId}`, response, payload));
  }
}

export function resetRequirements(tenderId: string) {
  return post<Tender>(`/tenders/${tenderId}/reset-requirements`, {});
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    throw new Error(asErrorMessage(path, response, payload));
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
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    throw new Error(asErrorMessage(path, response, payload));
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
