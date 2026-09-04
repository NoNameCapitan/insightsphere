"use client";
// "Report incorrect info" submissions (Modules 4 & 12).
// Local copy in localStorage + non-blocking push to the server API when enabled.
import { track } from "@/lib/analytics";
import { syncReportToServer } from "@/lib/api/backendClient";
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

export function createReport(
  placeId: string,
  reason: ReportIssue["reason"],
  message?: string,
): ReportIssue {
  const report: ReportIssue = {
    id: makeId("rep"),
    placeId,
    reason,
    message,
    createdAt: nowIso(),
  };
  writeJSON(KEY, [report, ...getReports()]);
  track("report_issue_submitted", { placeId, reason });
  void syncReportToServer(placeId, reason, message);
  return report;
}
