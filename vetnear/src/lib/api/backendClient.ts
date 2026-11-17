"use client";
// Client → server sync. Callers must distinguish a confirmed server receipt
// from a local draft; a timeout may have happened after a server commit.
import type {
  LeadSummary,
  PartnerSubmission,
  PlaceTier,
  ReportIssue,
} from "@/lib/types";

export function isBackendEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BACKEND_ENABLED === "1";
}

export type DeliveryResult =
  | { status: "sent"; id: string }
  | { status: "local" }
  | { status: "unconfirmed" };

async function post(path: string, body: unknown): Promise<DeliveryResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true || !("id" in data) || typeof data.id !== "string" || !data.id) {
    throw new Error("Server did not confirm receipt");
  }
  return { status: "sent", id: data.id };
}

/** Resolve only after a receipt, a disabled backend, or an unconfirmed attempt. */
export async function syncSubmissionToServer(
  sub: Omit<PartnerSubmission, "id" | "status" | "createdAt" | "updatedAt">,
): Promise<DeliveryResult> {
  if (!isBackendEnabled()) return { status: "local" };
  try {
    return await post("/api/submissions", sub);
  } catch (e) {
    console.warn("[backend] submission receipt unconfirmed:", e);
    return { status: "unconfirmed" };
  }
}

/** Report delivery is independent of whether the local draft was saved. */
export async function syncReportToServer(
  placeId: string,
  reason: ReportIssue["reason"],
  message?: string,
): Promise<DeliveryResult> {
  if (!isBackendEnabled()) return { status: "local" };
  try {
    return await post("/api/reports", { placeId, reason, message });
  } catch (e) {
    console.warn("[backend] report receipt unconfirmed:", e);
    return { status: "unconfirmed" };
  }
}

// ── Admin client (moderation page) ─────────────────────────────────────────
const TOKEN_KEY = "vetnear:admin-token"; // sessionStorage only, never localStorage

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
}
export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getAdminToken(),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export async function fetchServerSubmissions(): Promise<PartnerSubmission[]> {
  const data = await adminFetch<{ submissions: PartnerSubmission[] }>("/api/admin/submissions");
  return data.submissions;
}

export async function setServerSubmissionStatus(
  id: string,
  status: PartnerSubmission["status"],
  reason?: string,
): Promise<void> {
  const result = await adminFetch<{ published?: { ok: boolean; reason?: string } }>("/api/admin/submissions", {
    method: "POST",
    body: JSON.stringify({ id, status, reason }),
  });
  if (result.published?.ok !== true) {
    throw new Error("Статус змінено, але публікацію або зняття з публікації не підтверджено. Перевірте запис перед повторною дією.");
  }
}

export async function fetchServerReports(): Promise<ReportIssue[]> {
  const data = await adminFetch<{ reports: ReportIssue[] }>("/api/admin/reports");
  return data.reports;
}

// ── Leads & tiers (v1.9) ───────────────────────────────────────────────────

/** Real, server-recorded lead counts for one place. */
export async function fetchLeadSummary(
  placeId: string,
  days = 30,
): Promise<{ summary: LeadSummary; billableLeads: number }> {
  return adminFetch<{ summary: LeadSummary; billableLeads: number }>(
    `/api/partner/leads?placeId=${encodeURIComponent(placeId)}&days=${days}`,
  );
}

/** Set a place's commercial tier. `promotedDays` is required for "promoted". */
export async function setPlaceTier(
  placeId: string,
  tier: PlaceTier,
  promotedDays?: number,
): Promise<{ ok: boolean; promotedUntil: string | null }> {
  return adminFetch<{ ok: boolean; promotedUntil: string | null }>(
    "/api/admin/places/tier",
    { method: "POST", body: JSON.stringify({ placeId, tier, promotedDays }) },
  );
}
