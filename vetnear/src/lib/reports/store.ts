"use client";
// "Report incorrect info" submissions (Modules 4 & 12).
// Local copy in localStorage + explicit delivery result from the server API.
import { track } from "@/lib/analytics";
import { syncReportToServer, type DeliveryResult } from "@/lib/api/backendClient";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import type { ReportIssue } from "@/lib/types";

const KEY = "vetnear:reports";

/** UA labels for report reasons — single source for the button + moderation UI. */
export const REPORT_REASON_LABELS: Record<ReportIssue["reason"], string> = {
  wrong_phone: "Невірний телефон",
  wrong_address: "Невірна адреса",
  wrong_hours: "Невірний графік роботи",
  closed_permanently: "Заклад закрито",
  duplicate: "Дублікат",
  other: "Інше",
};

export function getReports(): ReportIssue[] {
  return readJSON<ReportIssue[]>(KEY, []);
}

export async function createReport(
  placeId: string,
  reason: ReportIssue["reason"],
  message?: string,
): Promise<ReportIssue & { delivery: DeliveryResult; localSaved: boolean }> {
  const report: ReportIssue = {
    id: makeId("rep"),
    placeId,
    reason,
    message,
    createdAt: nowIso(),
  };
  writeJSON(KEY, [report, ...getReports()]);
  const localSaved = getReports().some((item) => item.id === report.id);
  track("report_issue_submitted", { placeId, reason });
  const delivery = await syncReportToServer(placeId, reason, message);
  return { ...report, delivery, localSaved };
}
