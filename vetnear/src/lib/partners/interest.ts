import { isValidEmail } from "@/lib/security/url";
import { isPartnerPlan } from "./plans";
import type { PartnerPlan } from "@/lib/types";

export interface PartnerInterestInput {
  requestId: string;
  organization: string;
  contactName: string;
  contactEmail: string;
  locality: string;
  officialWebsite: string;
  requestedPlan: PartnerPlan;
  foundingPartner: boolean;
  message: string;
  /** Requests manual verification only; never grants account ownership. */
  claimPlaceSlug?: string;
  consent: true;
}

export function parsePartnerInterest(raw: unknown): { ok: true; value: PartnerInterestInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Перевірте дані заявки." };
  const r = raw as Record<string, unknown>;
  const text = (key: string, max: number) => typeof r[key] === "string" ? (r[key] as string).trim().slice(0, max) : "";
  const requestId = text("requestId", 36);
  const organization = text("organization", 180);
  const contactName = text("contactName", 120);
  const contactEmail = text("contactEmail", 254);
  const locality = text("locality", 160);
  const officialWebsite = text("officialWebsite", 500);
  const claimPlaceSlug = text("claimPlaceSlug", 160);
  if (claimPlaceSlug && !/^[a-z0-9_-]{1,160}$/i.test(claimPlaceSlug)) return { ok: false, error: "Перевірте посилання на профіль закладу." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return { ok: false, error: "Оновіть сторінку й повторіть спробу." };
  if (organization.length < 2 || !locality || !isValidEmail(contactEmail)) return { ok: false, error: "Вкажіть назву закладу, населений пункт і коректний email." };
  if (officialWebsite) {
    try { if (!["http:", "https:"].includes(new URL(officialWebsite).protocol)) throw new Error(); }
    catch { return { ok: false, error: "Вкажіть повне посилання на офіційний сайт." }; }
  }
  if (!isPartnerPlan(r.requestedPlan) || r.consent !== true) return { ok: false, error: "Оберіть план і погодьте обробку заявки." };
  return { ok: true, value: { requestId, organization, contactName, contactEmail, locality, officialWebsite, requestedPlan: r.requestedPlan, foundingPartner: r.foundingPartner === true, message: text("message", 1500), ...(claimPlaceSlug ? { claimPlaceSlug } : {}), consent: true } };
}
