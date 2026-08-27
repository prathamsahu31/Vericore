import type { AuditTrail, ExtractedField, VerificationSummary } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

export function getAudit(bidId: string) {
  return get<AuditTrail>(`/bids/${bidId}/audit`);
}

export interface DocumentSummary {
  id: string;
  original_filename: string;
  sha256: string;
  page_count: number | null;
  uploaded_at: string;
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
  const response = await fetch(`${BASE}/bids/${bidId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Review could not be recorded.");
  }
  return payload as VerificationSummary;
}
