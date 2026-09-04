"use client";
// Client → server sync (Phase 2). Offline-first: localStorage stays the local
// copy; when the backend is enabled we ALSO push to the API. Failures never
// break the local flow — they're logged and the local copy remains.
import type { PartnerSubmission, ReportIssue } from "@/lib/types";

export function isBackendEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BACKEND_ENABLED === "1";
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

/** Push a partner submission to the server. Fire-and-forget safe. */
export async function syncSubmissionToServer(
  sub: Omit<PartnerSubmission, "id" | "status" | "createdAt" | "updatedAt">,
): Promise<{ ok: boolean; id?: string }> {
  if (!isBackendEnabled()) return { ok: false };
  try {
    return await post("/api/submissions", sub);
  } catch (e) {
    console.warn("[backend] submission sync failed, local copy kept:", e);
    return { ok: false };
  }
}

/** Push a report to the server. Fire-and-forget safe. */
export async function syncReportToServer(
  placeId: string,
  reason: ReportIssue["reason"],
  message?: string,
): Promise<{ ok: boolean }> {
  if (!isBackendEnabled()) return { ok: false };
  try {
    return await post("/api/reports", { placeId, reason, message });
  } catch (e) {
    console.warn("[backend] report sync failed, local copy kept:", e);
    return { ok: false };
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
  await adminFetch("/api/admin/submissions", {
    method: "POST",
    body: JSON.stringify({ id, status, reason }),
  });
}

export async function fetchServerReports(): Promise<ReportIssue[]> {
  const data = await adminFetch<{ reports: ReportIssue[] }>("/api/admin/reports");
  return data.reports;
}
