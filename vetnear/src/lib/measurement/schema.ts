/** A deliberately small first-party event vocabulary. Never accept arbitrary text. */
export const MEASUREMENT_EVENTS = [
  "page_viewed", "nearby_search_started", "search_results_viewed", "place_profile_opened", "place_profile_viewed",
  "call_clicked", "route_clicked", "website_clicked", "place_saved", "pet_profile_created",
  "care_event_created", "calendar_exported", "add_place_started", "add_place_submitted",
] as const;
export type MeasurementName = typeof MEASUREMENT_EVENTS[number];
export type Campaign = { source?: string; medium?: string; campaign?: string };
export type MeasurementProps = { category?: string; region?: string; placeId?: string; resultCount?: number; hasLocation?: boolean; urgent?: boolean };
export type MeasurementInput = { id: string; sessionId: string; name: MeasurementName; route: string; props: MeasurementProps; campaign: Campaign };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function isMeasurementId(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
const SOURCES = new Set(["google", "facebook", "instagram", "telegram", "partner", "newsletter", "direct"]);
const MEDIUMS = new Set(["cpc", "paid_social", "organic", "referral", "email", "qr"]);
const CATEGORIES = new Set(["all", "veterinary_clinic", "vet_pharmacy", "pet_store", "grooming", "pet_boarding", "shelter", "other"]);
export function campaignCodes(value = ""): string[] { return value.split(",").map(x => x.trim()).filter(x => /^[a-z0-9_-]{1,48}$/.test(x)); }
export function sanitizeCampaign(value: unknown, allowed: string[] = []): Campaign {
  const b = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    ...(typeof b.source === "string" && SOURCES.has(b.source) ? { source: b.source } : {}),
    ...(typeof b.medium === "string" && MEDIUMS.has(b.medium) ? { medium: b.medium } : {}),
    ...(typeof b.campaign === "string" && allowed.includes(b.campaign) ? { campaign: b.campaign } : {}),
  };
}
/** Group private paths before either local storage or transport. No query/hash/IDs. */
export function measurementRoute(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/other";
  const p = value.split(/[?#]/)[0];
  if (/^\/place\/[^/]+\/?$/.test(p)) return "/place/[slug]";
  if (/^\/my-pets(?:\/|$)/.test(p)) return "/my-pets";
  const known = ["/", "/nearby", "/help", "/kyiv-updates", "/for-partners", "/partner-interest", "/add-place", "/privacy", "/terms"];
  return known.includes(p) ? p : "/other";
}
export function sanitizeProps(value: unknown): MeasurementProps {
  const b = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    ...(typeof b.category === "string" && CATEGORIES.has(b.category) ? { category: b.category } : {}),
    ...(b.region === "all" || b.region === "kyiv_city" || b.region === "kyiv_oblast" ? { region: b.region } : {}),
    ...(typeof b.placeId === "string" && /^[a-z0-9][a-z0-9_-]{1,79}$/i.test(b.placeId) ? { placeId: b.placeId } : {}),
    ...(typeof b.resultCount === "number" && Number.isSafeInteger(b.resultCount) && b.resultCount >= 0 && b.resultCount <= 100000 ? { resultCount: b.resultCount } : {}),
    ...(typeof b.hasLocation === "boolean" ? { hasLocation: b.hasLocation } : {}),
    ...(typeof b.urgent === "boolean" ? { urgent: b.urgent } : {}),
  };
}
export function isMeasurementName(value: unknown): value is MeasurementName { return (MEASUREMENT_EVENTS as readonly unknown[]).includes(value); }
export function parseMeasurement(value: unknown, allowedCampaigns: string[] = []): MeasurementInput | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Record<string, unknown>;
  if (!isMeasurementId(b.id) || !isMeasurementId(b.sessionId) || !isMeasurementName(b.name)) return null;
  return { id: b.id, sessionId: b.sessionId, name: b.name, route: measurementRoute(b.route), props: sanitizeProps(b.props), campaign: sanitizeCampaign(b.campaign, allowedCampaigns) };
}
export type MeasurementRow = { event_name: string; session_hash: string; props?: MeasurementProps; campaign?: Campaign; created_at?: string };
export function summarizeMeasurement(rows: MeasurementRow[]) {
  const sessions = new Set<string>();
  const events: Record<string, { events: number; sessions: number }> = {};
  const byEvent = new Map<string, Set<string>>();
  const campaigns = new Map<string, { sessions: Set<string>; contacts: Set<string> }>();
  let emptyResults = 0, results = 0;
  const contacts = new Set<string>();
  for (const row of rows) {
    if (!isMeasurementName(row.event_name)) continue;
    sessions.add(row.session_hash);
    const counter = events[row.event_name] ??= { events: 0, sessions: 0 }; counter.events++;
    const seen = byEvent.get(row.event_name) ?? new Set<string>(); seen.add(row.session_hash); byEvent.set(row.event_name, seen); counter.sessions = seen.size;
    const contact = ["call_clicked", "route_clicked", "website_clicked"].includes(row.event_name);
    if (contact) contacts.add(row.session_hash);
    if (row.event_name === "search_results_viewed") { results++; if (row.props?.resultCount === 0) emptyResults++; }
    const key = row.campaign?.campaign ?? "без кампанії";
    const camp = campaigns.get(key) ?? { sessions: new Set<string>(), contacts: new Set<string>() };
    camp.sessions.add(row.session_hash); if (contact) camp.contacts.add(row.session_hash); campaigns.set(key, camp);
  }
  return { sessions: sessions.size, contactSessions: contacts.size, results, emptyResults, events,
    campaigns: [...campaigns].map(([campaign, c]) => ({ campaign, sessions: c.sessions.size, contactSessions: c.contacts.size })) };
}
