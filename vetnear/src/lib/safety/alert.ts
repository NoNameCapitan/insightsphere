import type { KyivAlertLevel, KyivAlertStatus } from "@/lib/safety/types";

const OFFICIAL_ALERT_MAP = "https://map.ukrainealarm.com/";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function recordsFrom(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ["states", "regions", "data", "alerts"]) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [value];
}

function isKyivCity(record: UnknownRecord): boolean {
  const name = String(record.regionName ?? record.regionEngName ?? record.name ?? "").toLowerCase();
  const type = String(record.regionType ?? record.type ?? "").toLowerCase();
  return (
    name === "м. київ" ||
    name === "київ" ||
    name === "kyiv city" ||
    name === "kyiv" ||
    (name.includes("київ") && (type.includes("city") || type.includes("міст")))
  );
}

function alertLevelFrom(record: UnknownRecord | undefined, parent: UnknownRecord): KyivAlertLevel {
  const text = [
    record?.level,
    record?.severity,
    record?.alertLevel,
    record?.type,
    record?.alertType,
    record?.name,
    record?.message,
    parent.level,
    parent.severity,
    parent.alertLevel,
    parent.message,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (/red|червон|масован|ракет|комбінован|ballistic|missile/.test(text)) return "red";
  if (/yellow|жовт|дронов|бпла|uav|shahed/.test(text)) return "yellow";
  return "unknown";
}

export function parseKyivAlertPayload(payload: unknown, checkedAt = new Date().toISOString()): KyivAlertStatus {
  const kyiv = recordsFrom(payload).find(isKyivCity);
  if (!kyiv) {
    return {
      state: "unavailable",
      checkedAt,
      sourceUrl: OFFICIAL_ALERT_MAP,
      message: "Офіційна відповідь не містить окремого статусу міста Києва.",
    };
  }

  if (!Array.isArray(kyiv.activeAlerts) || kyiv.activeAlerts.some((item) => !isRecord(item))) {
    return { state: "unavailable", checkedAt, sourceUrl: OFFICIAL_ALERT_MAP, message: "Некоректний перелік активних тривог для Києва." };
  }
  const alerts = kyiv.activeAlerts as UnknownRecord[];
  const active = alerts.length > 0;
  const first = alerts[0];
  return {
    state: active ? "active" : "inactive",
    checkedAt,
    sourceUrl: OFFICIAL_ALERT_MAP,
    startedAt: active ? String(first?.lastUpdate ?? first?.startedAt ?? kyiv.lastUpdate ?? "") || null : null,
    alertType: active ? String(first?.type ?? first?.alertType ?? first?.name ?? "Повітряна тривога") : null,
    level: active ? alertLevelFrom(first, kyiv) : "unknown",
  };
}

export const ALERT_SOURCE_URL = OFFICIAL_ALERT_MAP;
