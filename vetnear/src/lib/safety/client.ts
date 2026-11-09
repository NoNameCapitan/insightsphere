import type { KyivAlertStatus } from "@/lib/safety/types";

export const OFFICIAL_ALERT_MAP = "https://map.ukrainealarm.com/";
export const OFFICIAL_SHELTER_MAP = "https://gis.kyivcity.gov.ua/shelter/";
export const ALERT_MAX_AGE_MS = 90_000;

export function hasFreshAlertStatus(alert: KyivAlertStatus | null, now = Date.now()): boolean {
  if (!alert || !["active", "inactive"].includes(alert.state)) return false;
  const age = now - Date.parse(alert.checkedAt);
  return Number.isFinite(age) && age >= -30_000 && age < ALERT_MAX_AGE_MS;
}

export function hasFreshActiveAlert(alert: KyivAlertStatus | null, now = Date.now()): boolean {
  return alert?.state === "active" && hasFreshAlertStatus(alert, now);
}

export function unavailableAlert(message: string): KyivAlertStatus {
  return { state: "unavailable", checkedAt: new Date().toISOString(), sourceUrl: OFFICIAL_ALERT_MAP, message };
}

/** Only same-origin public status is read here; credentials remain server-side. */
export async function fetchCurrentKyivAlert(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<KyivAlertStatus> {
  const response = await fetcher("/api/safety/alert", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Не вдалося перевірити тривогу.");
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object") throw new Error("Некоректний статус тривоги.");
  const value = raw as Record<string, unknown>;
  if (
    !["active", "inactive", "unavailable"].includes(String(value.state)) ||
    typeof value.checkedAt !== "string"
  ) throw new Error("Некоректний статус тривоги.");
  return {
    state: value.state as KyivAlertStatus["state"],
    checkedAt: value.checkedAt,
    sourceUrl: OFFICIAL_ALERT_MAP,
    level: value.level === "red" || value.level === "yellow" ? value.level : "unknown",
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    alertType: typeof value.alertType === "string" ? value.alertType : null,
    message: typeof value.message === "string" ? value.message : undefined,
  };
}
