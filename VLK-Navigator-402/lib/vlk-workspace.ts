/**
 * Локальні налаштування робочого місця лікаря: остання спеціальність і
 * останні переглянуті пункти.
 *
 * Зберігається лише в цьому браузері. Тут немає персональних чи медичних
 * даних пацієнта — тільки номери статей і пунктів, які лікар відкривав.
 */

import { SPECIALTIES, type SpecialtyId } from "./vlk-sample-data.ts";

export const WORKSPACE_KEY = "vlk-402-workspace-v1";
export const RECENT_LIMIT = 5;

export type RecentEntry = {
  article: string;
  /** Пункт статті або порожній рядок, якщо відкрито статтю загалом. */
  point: string;
};

export type Workspace = {
  /** Остання обрана спеціальність або "" для чистого старту. */
  specialty: SpecialtyId | "";
  recent: RecentEntry[];
};

export const EMPTY_WORKSPACE: Workspace = { specialty: "", recent: [] };

const SPECIALTY_IDS = new Set<string>(SPECIALTIES.map((item) => item.id));

function asRecent(value: unknown): RecentEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const article = typeof record.article === "string" ? record.article.trim() : "";
  if (!/^\d{1,2}$/.test(article)) return null;
  const point = typeof record.point === "string" ? record.point.trim().slice(0, 4) : "";
  return { article, point };
}

/** Читає збережене робоче місце з довільного (можливо, пошкодженого) значення. */
export function readWorkspace(raw: unknown): Workspace {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...EMPTY_WORKSPACE, recent: [] };
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...EMPTY_WORKSPACE, recent: [] };
  }

  const record = parsed as Record<string, unknown>;
  const specialty = typeof record.specialty === "string" && SPECIALTY_IDS.has(record.specialty)
    ? (record.specialty as SpecialtyId)
    : "";

  const recent: RecentEntry[] = [];
  if (Array.isArray(record.recent)) {
    for (const value of record.recent) {
      const entry = asRecent(value);
      if (!entry) continue;
      if (recent.some((item) => item.article === entry.article && item.point === entry.point)) continue;
      recent.push(entry);
      if (recent.length >= RECENT_LIMIT) break;
    }
  }

  return { specialty, recent };
}

/** Додає перегляд на початок списку без дублікатів. */
export function addRecent(recent: readonly RecentEntry[], entry: RecentEntry): RecentEntry[] {
  if (!/^\d{1,2}$/.test(entry.article)) return [...recent];
  const next: RecentEntry = { article: entry.article, point: entry.point ?? "" };
  return [
    next,
    ...recent.filter((item) => !(item.article === next.article && item.point === next.point)),
  ].slice(0, RECENT_LIMIT);
}

export function serializeWorkspace(workspace: Workspace) {
  return JSON.stringify({
    version: 1,
    specialty: workspace.specialty,
    recent: workspace.recent.slice(0, RECENT_LIMIT),
  });
}
