// Central type definitions for AI Lead Hunter.

export type OfferType =
  | "website"
  | "landing"
  | "seo"
  | "chatbot"
  | "booking"
  | "crm"
  | "smm"
  | "reputation"
  | "automation"
  | "custom";

export type NicheKey =
  | "beauty"
  | "dental"
  | "vet"
  | "carwash"
  | "cafe"
  | "fitness"
  | "auto_service"
  | "medical"
  | "repair"
  | "restaurant"
  | "generic";

export type LocationMode = "near_me" | "city" | "address";

export type LangCode = "uk" | "ru" | "en";

// Campaign funnel: 5 stages (was 8 statuses; old values are migrated).
export type CampaignStage =
  "new" | "verified" | "contact" | "dialog" | "result";
export type LeadOutcome = "won" | "lost" | "postponed";
// `status` stores the funnel stage. Kept as LeadStatus for backward-compat naming.
export type LeadStatus = CampaignStage;

export type ScoreLabel = "hot" | "warm" | "cold" | "bad_fit";

export type LeadScore = {
  fit: number;
  pain: number;
  reachability: number;
  timing: number;
  total: number;
  label: ScoreLabel;
  explanation: string;
  opportunityReason: string;
};

// Result of the lightweight, safe server-side website check.
// "checked: false" means the site was not analyzed (e.g. demo without a URL,
// or analysis was skipped) — nothing should be asserted in that case.
// Public contact points the business publishes on its own website.
export type WebsiteContacts = {
  emails: string[];
  instagram?: string;
  facebook?: string;
  telegram?: string;
  whatsapp?: string;
  viber?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
};

export type WebsiteAnalysis = {
  checked: boolean;
  url?: string;
  reachable: boolean;
  https: boolean;
  hasTitle: boolean;
  hasViewport: boolean;
  hasContactKeyword: boolean;
  hasBookingKeyword: boolean;
  hasSocialLinks: boolean;
  hasFormKeyword: boolean;
  contacts?: WebsiteContacts;
  note?: string;
};

export type SignalType =
  | "missing_website"
  | "weak_website"
  | "has_phone"
  | "low_review_count"
  | "strong_rating"
  | "weak_rating"
  | "many_reviews"
  | "no_online_booking_detected"
  | "good_fit_for_chatbot"
  | "good_fit_for_website"
  | "good_fit_for_seo"
  | "good_fit_for_reputation_management"
  | "reputation_gap"
  | "active_business"
  | "needs_manual_review"
  | "website_unreachable"
  | "website_no_https"
  | "website_no_booking_detected"
  | "website_has_booking"
  | "website_has_social_links"
  | "website_needs_manual_review"
  | "demo_data";

export type LeadSignal = {
  type: SignalType;
  label: string;
  severity: "high" | "medium" | "low";
  evidence: string;
};

export type OutreachMessages = {
  shortMessage: string;
  instagramMessage: string;
  emailMessage: string;
  callScript: string;
};

export type OutreachTone = "soft" | "direct" | "professional";
export type OutreachChannel = "telegram" | "instagram" | "email" | "call";

// Lead Confidence = how reliable the available data is (NOT how attractive the
// lead is). Kept deliberately separate from LeadScore.
export type LeadConfidence = {
  score: number; // 0..100
  label: "high" | "medium" | "low";
  present: string[];
  missing: string[];
};

// Manual verification flags a user can toggle per lead (stored locally).
export type LeadVerification = {
  phoneChecked?: boolean;
  websiteChecked?: boolean;
  businessActive?: boolean;
  offerFitConfirmed?: boolean;
  contacted?: boolean;
  badData?: boolean;
  doNotContact?: boolean;
};

export type Lead = {
  id: string;
  source: "google_places" | "demo";
  sourcePlaceId?: string;
  attributions?: { provider: string; providerUri?: string }[];
  name: string;
  category: string;
  niche: NicheKey;
  address: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  businessStatus?: string;
  hasWebsite: boolean;
  hasPhone: boolean;
  websiteAnalysis?: WebsiteAnalysis;
  score: LeadScore;
  confidence: LeadConfidence;
  signals: LeadSignal[];
  recommendedOffer: string;
  offerType: OfferType;
  outreach: OutreachMessages;
  status?: LeadStatus;
  outcome?: LeadOutcome;
  verification?: LeadVerification;
  notes?: string;
  followUpAt?: string;
  createdAt: string;
};

// A normalized business before scoring/outreach are applied.
export type RawBusiness = {
  sourcePlaceId?: string;
  attributions?: { provider: string; providerUri?: string }[];
  source: "google_places" | "demo";
  name: string;
  niche: NicheKey;
  category: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  businessStatus?: string;
  websiteAnalysis?: WebsiteAnalysis;
};

export type SearchFilters = {
  hasPhone?: boolean;
  hasWebsite?: boolean;
  noWebsite?: boolean;
  ratingAbove?: number;
  ratingBelow?: number;
  minReviews?: number;
  hotOnly?: boolean;
  needsManualReview?: boolean;
  openNow?: boolean;
  category?: NicheKey | "all";
};

export type SortKey =
  "score" | "distance" | "rating" | "reviews" | "missing_website";

export type SearchRequest = {
  query: string;
  niche: NicheKey;
  offerType: OfferType;
  locationMode: LocationMode;
  lat?: number;
  lng?: number;
  city?: string;
  address?: string;
  radiusKm: number;
  limit: number;
  lang: LangCode;
  filters?: SearchFilters;
};

export type SearchResponse = {
  mode: "demo" | "google_places";
  warning?: string;
  leads: Lead[];
  totalCandidates: number;
  afterFilters: number;
  requestedLimit: number;
  geoNote?: string;
  approximate?: boolean;
  districtName?: string;
  radiusKm?: number;
  wholeCity?: boolean;
  center?: { lat: number; lng: number };
};

export type Campaign = {
  id: string;
  name: string;
  createdAt: string;
  leads: Lead[];
};
