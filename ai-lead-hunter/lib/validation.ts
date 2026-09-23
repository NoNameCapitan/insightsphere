import { z } from "zod";

export const nicheSchema = z.enum([
  "beauty",
  "dental",
  "vet",
  "carwash",
  "cafe",
  "fitness",
  "auto_service",
  "medical",
  "repair",
  "restaurant",
  "generic",
]);
export const offerSchema = z.enum([
  "website",
  "landing",
  "seo",
  "chatbot",
  "booking",
  "crm",
  "smm",
  "reputation",
  "automation",
  "custom",
]);
export const langSchema = z.enum(["uk", "ru", "en"]);
export const filtersSchema = z.object({
  hasPhone: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  noWebsite: z.boolean().optional(),
  ratingAbove: z.number().min(0).max(5).optional(),
  ratingBelow: z.number().min(0).max(5).optional(),
  minReviews: z.number().int().min(0).max(10000000).optional(),
  hotOnly: z.boolean().optional(),
  needsManualReview: z.boolean().optional(),
  openNow: z.boolean().optional(),
  category: z.union([nicheSchema, z.literal("all")]).optional(),
});
export const searchSchema = z
  .object({
    query: z.string().trim().max(1500).default(""),
    niche: nicheSchema.default("generic"),
    offerType: offerSchema.default("website"),
    locationMode: z.enum(["city", "address", "near_me"]).default("city"),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
    city: z.string().trim().max(200).optional(),
    address: z.string().trim().max(400).optional(),
    // 0 = whole city (city mode); otherwise an explicit radius in km.
    radiusKm: z.number().finite().min(0).max(50).default(0),
    limit: z.number().int().min(1).max(200).default(30),
    lang: langSchema.default("uk"),
    filters: filtersSchema.optional(),
    demo: z.boolean().default(false),
    excludeKeys: z.array(z.string().max(800)).max(1000).default([]),
    widen: z.number().int().min(0).max(1).default(0),
  })
  .superRefine((r, ctx) => {
    if (r.locationMode === "near_me" && (r.lat == null || r.lng == null))
      ctx.addIssue({
        code: "custom",
        message: "Надайте геолокацію або оберіть місто.",
        path: ["lat"],
      });
    if (r.locationMode === "address" && !r.address)
      ctx.addIssue({
        code: "custom",
        message: "Вкажіть район або адресу.",
        path: ["address"],
      });
  });
export type ValidSearch = z.infer<typeof searchSchema>;
export const outreachSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().max(200).default(""),
  offerType: offerSchema,
  lang: langSchema,
  tone: z.enum(["soft", "direct", "professional"]),
  channel: z.enum(["telegram", "instagram", "email", "call"]),
  evidence: z.array(z.string().max(500)).max(12).default([]),
  draft: z.string().max(6000),
});
