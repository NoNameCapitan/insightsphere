import { z } from "zod";
import { nicheSchema, offerSchema } from "./validation";
import { migrateCampaigns } from "./campaignStages";
import type { Campaign } from "./types";
const text = z.string().max(20000);
const url = z
  .string()
  .max(2048)
  .refine((s) => {
    try {
      const u = new URL(s);
      return (
        ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
      );
    } catch {
      return false;
    }
  });
const score = z.object({
  fit: z.number().min(0).max(30),
  pain: z.number().min(0).max(35),
  reachability: z.number().min(0).max(20),
  timing: z.number().min(0).max(15),
  total: z.number().min(0).max(100),
  label: z.enum(["hot", "warm", "cold", "bad_fit"]),
  explanation: text,
  opportunityReason: text,
});
const confidence = z.object({
  score: z.number().min(0).max(100),
  label: z.enum(["high", "medium", "low"]),
  present: z.array(text).max(30),
  missing: z.array(text).max(30),
});
const lead = z.object({
  id: z.string().min(1).max(200),
  source: z.enum(["demo", "google_places"]),
  sourcePlaceId: z.string().max(400).optional(),
  attributions: z
    .array(
      z.object({ provider: z.string().max(500), providerUri: url.optional() }),
    )
    .max(50)
    .optional(),
  name: z.string().min(1).max(300),
  category: text,
  niche: nicheSchema,
  address: text,
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  distanceKm: z.number().nonnegative().optional(),
  phone: z.string().max(100).optional(),
  website: url.optional(),
  googleMapsUrl: url.optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().nonnegative().optional(),
  openingHours: z.array(text).max(14).optional(),
  isOpenNow: z.boolean().optional(),
  businessStatus: z.string().max(100).optional(),
  hasWebsite: z.boolean(),
  hasPhone: z.boolean(),
  score,
  confidence,
  signals: z
    .array(
      z.object({
        type: z.string().max(100),
        label: text,
        severity: z.enum(["high", "medium", "low"]),
        evidence: text,
      }),
    )
    .max(50),
  recommendedOffer: text,
  offerType: offerSchema,
  outreach: z.object({
    shortMessage: text,
    instagramMessage: text,
    emailMessage: text,
    callScript: text,
  }),
  status: z.string().max(30).optional(),
  outcome: z.enum(["won", "lost", "postponed"]).optional(),
  verification: z
    .object({
      phoneChecked: z.boolean().optional(),
      websiteChecked: z.boolean().optional(),
      businessActive: z.boolean().optional(),
      offerFitConfirmed: z.boolean().optional(),
      contacted: z.boolean().optional(),
      badData: z.boolean().optional(),
      doNotContact: z.boolean().optional(),
    })
    .optional(),
  notes: text.optional(),
  createdAt: z.string().datetime(),
  followUpAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  websiteAnalysis: z
    .object({
      checked: z.boolean(),
      url: text.optional(),
      reachable: z.boolean(),
      https: z.boolean(),
      hasTitle: z.boolean(),
      hasViewport: z.boolean(),
      hasContactKeyword: z.boolean(),
      hasBookingKeyword: z.boolean(),
      hasSocialLinks: z.boolean(),
      hasFormKeyword: z.boolean(),
      contacts: z
        .object({
          emails: z.array(z.string().max(254)).max(5),
          instagram: text.optional(),
          facebook: text.optional(),
          telegram: text.optional(),
          whatsapp: text.optional(),
          viber: text.optional(),
          tiktok: text.optional(),
          youtube: text.optional(),
          linkedin: text.optional(),
        })
        .optional(),
      note: text.optional(),
    })
    .optional(),
});
const campaignsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(200),
      name: z.string().min(1).max(200),
      createdAt: z.string().datetime(),
      leads: z.array(lead).max(5000),
    }),
  )
  .max(100);
export function validateCampaigns(data: unknown): Campaign[] {
  const result = campaignsSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "Файл містить некоректні кампанії. Поточні дані не змінено.",
    );
  const ids = new Set<string>();
  for (const c of result.data) {
    if (
      ids.has(c.id) ||
      new Set(c.leads.map((l) => l.id)).size !== c.leads.length
    )
      throw new Error("У файлі повторюються ідентифікатори. Дані не змінено.");
    ids.add(c.id);
  }
  return migrateCampaigns(result.data as Campaign[]).campaigns;
}
export function parseBackup(raw: string): Campaign[] {
  if (raw.length > 8000000)
    throw new Error("Резервна копія завелика (максимум 8 МБ).");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Не вдалося прочитати JSON-файл.");
  }
  const root = z
    .object({
      app: z.literal("ai-lead-hunter"),
      version: z.literal(1),
      campaigns: z.unknown(),
    })
    .safeParse(data);
  if (!root.success)
    throw new Error("Це не резервна копія AI Lead Hunter версії 1.");
  return validateCampaigns(root.data.campaigns);
}
export function serializeBackup(campaigns: Campaign[]): string {
  return JSON.stringify(
    {
      app: "ai-lead-hunter",
      version: 1,
      exportedAt: new Date().toISOString(),
      campaigns,
    },
    null,
    2,
  );
}
