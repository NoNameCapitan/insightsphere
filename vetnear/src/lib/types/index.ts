// ───────────────────────────────────────────────────────────────────────────
// VetNear canonical data model (Module 13).
// One barrel file so every consumer can `import { ... } from "@/lib/types"`.
// All types are DB-compatible (plain serializable shapes) so they can move to
// Supabase/Postgres/PostGIS later without reshaping the app.
// ───────────────────────────────────────────────────────────────────────────

// ── Geo ──────────────────────────────────────────────────────────────────────
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type KyivDistrict =
  | "pozniaky"
  | "osokorky"
  | "obolon"
  | "podil"
  | "troieshchyna"
  | "holosiiv"
  | "solomianka"
  | "pechersk"
  | "nyvky"
  | "sviatoshyn";

// ── Animals ──────────────────────────────────────────────────────────────────
export type AnimalType =
  | "cat"
  | "dog"
  | "bird"
  | "rodent"
  | "reptile"
  | "exotic"
  | "other";

export type Sex = "male" | "female" | "unknown";

// ── Roles & permissions (Module 12) ───────────────────────────────────────────
export type UserRole = "guest" | "user" | "partner" | "moderator" | "admin";

export type Permission =
  | "search"
  | "create_pet"
  | "submit_place"
  | "manage_own_place"
  | "moderate"
  | "manage_all";

// ── Pet profiles (Module 1) ────────────────────────────────────────────────────
export interface PetProfile {
  id: string;
  ownerId?: string; // reserved for future auth
  name: string;
  animalType: AnimalType;
  breed?: string;
  ageYears?: number;
  ageMonths?: number;
  sex?: Sex;
  weightKg?: number;
  photoUrl?: string;
  allergies?: string;
  importantNotes?: string;
  favoriteClinicId?: string;
  preferredDistrict?: KyivDistrict;
  emergencyNote?: string; // quick note for urgent visits (e.g. reacts badly to anesthesia)
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ── Places (Modules 2, 3, 4, 13, 14) ───────────────────────────────────────────
export type PlaceCategory =
  | "veterinary_clinic"
  | "emergency_vet"
  | "pet_store"
  | "vet_pharmacy"
  | "grooming"
  | "shelter"
  | "animal_volunteer_help"
  | "pet_boarding"
  | "dog_walking"
  | "dog_training"
  | "pet_friendly_place"
  | "other_pet_service";

export type PlaceStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "suspended";

// ── Data provenance & verification (P0 — data honesty) ───────────────────────
export type DataSource =
  | "demo"
  | "manual_verified"
  | "manual_unverified"
  | "partner_submitted"
  | "google_places_external"
  | "osm_external";

export type VerificationStatus =
  | "demo"
  | "unverified"
  | "verified"
  | "needs_review"
  | "needs_geocoding"
  | "rejected";

/**
 * An external candidate imported from Google Places (or similar) that has NOT
 * yet been human-reviewed. Kept separate from Place: these are review inputs,
 * never published as-is.
 */
export interface GooglePlaceCandidate {
  id: string;
  googlePlaceId?: string | null;
  name: string;
  category: PlaceCategory;
  address: string;
  district?: KyivDistrict | null;
  phone?: string | null;
  website?: string | null;
  googleMapsUri?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  animalTypes: AnimalType[];
  emergencyAvailable?: boolean;
  isOpen24_7?: boolean;
  businessStatus?: string | null;
  types?: string[];
  // Review-queue flags (never auto-published).
  emergencyCandidate?: boolean;
  open24_7Candidate?: boolean;
  duplicateCandidate?: boolean;
  matchedExistingPlaceId?: string | null;
  qualityScore?: number;
  // Always external + review-only on import.
  dataSource: "google_places_external";
  verificationStatus: "needs_review" | "needs_phone_confirmation";
  verified: false;
  status?: "needs_review";
  lastVerifiedAt?: string | null;
  sourceLabel?: string;
  sourceUrl?: string;
}

/** Provenance fields mixed into Place / PartnerSubmission. */
export interface Provenance {
  dataSource?: DataSource;
  verificationStatus?: VerificationStatus;
  lastVerifiedAt?: string | null;
  verifiedBy?: string | null;
  sourceLabel?: string;
  sourceUrl?: string;
  dataWarning?: string;
  // Future-ready emergency confirmation (only set after a real phone call).
  phoneConfirmedAt?: string | null;
  phoneConfirmedBy?: string | null;
  emergencyNotes?: string;
  supportedEmergencyAnimals?: AnimalType[];
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  telegram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
}

/** A single day's working hours. day: 0 = Sunday ... 6 = Saturday. */
export interface WorkingHours {
  day: number;
  open: string; // "08:00"
  close: string; // "20:00"
  closed?: boolean;
}

export interface Service {
  id: string;
  name: string;
  category?: string;
}

export interface Place {
  id: string;
  ownerId?: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  description: string;
  address: string;
  district: KyivDistrict;
  latitude: number;
  longitude: number;
  phone: string;
  email?: string;
  website?: string;
  socialLinks?: SocialLinks;
  workingHours: WorkingHours[];
  isOpen24_7: boolean;
  services: string[];
  animalTypes: AnimalType[];
  tags: string[];
  // Capability flags (kept from the MVP; useful as service filters)
  hasSurgery: boolean;
  hasUltrasound: boolean;
  hasXray: boolean;
  hasPharmacy: boolean;
  emergencyAvailable: boolean;
  appointmentRequired: boolean;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  verified: boolean;
  claimed: boolean;
  status: PlaceStatus;
  rating: number; // 0..5
  createdAt: string;
  updatedAt: string;
  // Provenance / verification (see Provenance). Optional: missing => treated as demo.
  dataSource?: DataSource;
  verificationStatus?: VerificationStatus;
  lastVerifiedAt?: string | null;
  verifiedBy?: string | null;
  sourceLabel?: string;
  sourceUrl?: string;
  dataWarning?: string;
  // Future-ready emergency confirmation (only set after a real phone call).
  phoneConfirmedAt?: string | null;
  phoneConfirmedBy?: string | null;
  emergencyNotes?: string;
  supportedEmergencyAnimals?: AnimalType[];
}

/** A place augmented with a computed distance (meters) from the user. */
export interface PlaceWithDistance extends Place {
  distanceMeters: number | null;
}

export type TrustBadge =
  | "free"
  | "verified"
  | "claimed"
  | "updated_recently"
  | "data_outdated"
  | "emergency"
  | "open_now"
  | "partner";

// ── Discovery / filtering (Module 2) ───────────────────────────────────────────
export type RadiusMeters = 1000 | 2000 | 3000 | 5000 | 10000;

export type SortKey =
  | "distance"
  | "pet_match"
  | "category"
  | "open_now"
  | "emergency"
  | "verified"
  | "recent"
  | "rating";

export interface FilterState {
  category: PlaceCategory | "all";
  animal: AnimalType | "all";
  radius: RadiusMeters;
  district: KyivDistrict | "all";
  openNow: boolean;
  emergency: boolean;
  verified: boolean;
  sort: SortKey;
}

// ── Partner onboarding & moderation (Module 5) ─────────────────────────────────
export type SubmissionStatus = PlaceStatus;

export interface PartnerSubmission {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string;
  address: string;
  district: KyivDistrict;
  latitude?: number;
  longitude?: number;
  phone: string;
  email?: string;
  website?: string;
  socialLinks?: SocialLinks;
  workingHours?: WorkingHours[];
  services: string[];
  animalTypes: AnimalType[];
  emergencyAvailable: boolean;
  appointmentRequired: boolean;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  tags: string[];
  notes?: string;
  contactPerson?: string;
  representativeConfirmed?: boolean;
  consentModeration?: boolean;
  mapLink?: string; // pasted Google Maps link (geocoded later / by moderator)
  phoneConfirmedAt?: string | null;
  phoneConfirmedBy?: string | null;
  status: SubmissionStatus;
  // Provenance: partner submissions are partner_submitted and unverified until reviewed.
  dataSource?: DataSource;
  verificationStatus?: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationEvent {
  id: string;
  submissionId: string;
  action: "approved" | "rejected" | "suspended" | "requested_changes";
  reason?: string;
  actorRole: UserRole;
  createdAt: string;
}

export interface AuditLogEvent {
  id: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface ReportIssue {
  id: string;
  placeId: string;
  reason:
    | "wrong_phone"
    | "wrong_address"
    | "wrong_hours"
    | "closed_permanently"
    | "duplicate"
    | "other";
  message?: string;
  createdAt: string;
}

// ── Products & inventory (Module 6) ────────────────────────────────────────────
export type ProductCategory =
  | "cat_food"
  | "dog_food"
  | "bird_food"
  | "litter"
  | "carriers"
  | "collars"
  | "grooming_products"
  | "vet_diet"
  | "pharmacy_otc"
  | "accessories"
  | "other_product";

export type Availability =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "unknown";

export type InventoryDataSource =
  | "manual"
  | "csv"
  | "api"
  | "google_sheet"
  | "mock";

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  title: string;
  brand?: string;
  category: ProductCategory;
  animalType: AnimalType;
  description?: string;
  imageUrl?: string;
  productUrl?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  placeId: string;
  price: number;
  currency: string; // "UAH"
  stockQty?: number;
  availability: Availability;
  updatedAt: string;
  dataSource: InventoryDataSource;
}

export interface Supplier {
  id: string;
  name: string;
  website?: string;
}

export interface SupplierFeed {
  id: string;
  supplierId: string;
  url?: string;
  format: "csv" | "xlsx" | "json" | "api" | "google_sheet";
  lastSyncedAt?: string;
}

export interface InventoryImport {
  id: string;
  placeId: string;
  source: InventoryDataSource;
  fileName?: string;
  rows: number;
  accepted: number;
  rejected: number;
  status: "pending" | "validated" | "imported" | "failed";
  createdAt: string;
}

export interface StoreBranch {
  id: string;
  placeId: string;
  name: string;
  address: string;
  district: KyivDistrict;
}

// ── Requests & bookings (Module 7) ─────────────────────────────────────────────
export type RequestStatus =
  | "new"
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export interface ServiceRequest {
  id: string;
  petId?: string;
  placeId: string;
  serviceType: string;
  message?: string;
  preferredDate?: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export type BookingRequest = ServiceRequest;

// ── Pet QR / MQR (Module 8) ────────────────────────────────────────────────────
export interface PetQrProfile {
  petId: string;
  publicSlug: string;
  ownerContact?: string;
  emergencyNotes?: string;
  allergies?: string;
  favoriteClinicId?: string;
  lostPetMode: boolean;
  publicVisibilitySettings: {
    showContact: boolean;
    showAllergies: boolean;
    showNotes: boolean;
  };
}

// ── Monetization (Module 11) ───────────────────────────────────────────────────
export type PartnerPlan = "free" | "verified" | "pro" | "multi_location";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled";

// ── Analytics (Module 10) ──────────────────────────────────────────────────────
export type AnalyticsEventName =
  | "pet_profile_created"
  | "pet_profile_selected"
  | "location_allowed"
  | "location_denied"
  | "nearby_search_started"
  | "place_preview_opened"
  | "place_profile_opened"
  | "call_clicked"
  | "route_clicked"
  | "website_clicked"
  | "social_link_clicked"
  | "add_place_started"
  | "add_place_submitted"
  | "product_search_started"
  | "product_result_clicked"
  | "service_request_created"
  | "pet_assistant_question_asked"
  | "emergency_recommendation_shown"
  | "report_issue_submitted"
  | "partner_dashboard_opened"
  | "pet_scan_started"
  | "pet_scan_completed"
  | "lost_found_created"
  | "share_clicked";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props?: Record<string, unknown>;
  ts: number;
}
