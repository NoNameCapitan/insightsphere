#!/usr/bin/env node
/*
  VetNear Google Places importer — SAFE BY DEFAULT.

  Pulls regular pet-care places from Google Places API (New) into a REVIEW QUEUE.
  Output is never published to the public dataset and never marked verified.

  Writes:
    - src/lib/data/google-places.ts        (external candidates, review-only)
    - data/imports/google-places-review.csv
    - data/imports/google-places-raw.json

  Safety rules:
    - Default categories exclude emergency_vet (see DEFAULT_SAFE_CATEGORIES).
    - --exclude-emergency=true (default) skips emergency_vet queries and flags any
      emergency / 24-7 looking result as:
          emergencyCandidate: true
          verificationStatus: "needs_phone_confirmation"
          verified: false
          status: "needs_review"
    - Every candidate stays external:
          dataSource: "google_places_external"
          verificationStatus: "needs_review" | "needs_phone_confirmation"
          verified: false
      Human approval in /admin/imports/google-places is required before any use.
    - The public dataset (src/lib/data/places.ts) is never modified by this script.
*/

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_OUTPUT_TS = "src/lib/data/google-places.ts";
const DEFAULT_RAW_JSON = "data/imports/google-places-raw.json";
const DEFAULT_REVIEW_CSV = "data/imports/google-places-review.csv";
const PLACES_TS = "src/lib/data/places.ts";

// Minimal field mask keeps request cost low.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.types",
  "places.primaryType",
  "nextPageToken",
].join(",");

const DISTRICTS = {
  podil: { label: "Поділ", latitude: 50.4662, longitude: 30.5152 },
  pechersk: { label: "Печерськ", latitude: 50.4253, longitude: 30.5403 },
  obolon: { label: "Оболонь", latitude: 50.5151, longitude: 30.4983 },
  pozniaky: { label: "Позняки", latitude: 50.4022, longitude: 30.6294 },
  osokorky: { label: "Осокорки", latitude: 50.3972, longitude: 30.6103 },
  troieshchyna: { label: "Троєщина", latitude: 50.5122, longitude: 30.6013 },
  holosiiv: { label: "Голосіїв", latitude: 50.3782, longitude: 30.5103 },
  solomianka: { label: "Соломʼянка", latitude: 50.4302, longitude: 30.4603 },
  nyvky: { label: "Нивки", latitude: 50.4582, longitude: 30.4183 },
  sviatoshyn: { label: "Святошин", latitude: 50.4582, longitude: 30.3553 },
};

const CATEGORY_CONFIG = {
  veterinary_clinic: {
    queries: ["ветеринарна клініка", "ветклиника", "ветеринар"],
    includedType: "veterinary_care",
    animals: ["dog", "cat", "other"],
  },
  pet_store: {
    queries: ["зоомагазин", "товари для тварин", "pet store"],
    includedType: "pet_store",
    animals: ["dog", "cat", "bird", "rodent", "reptile", "other"],
  },
  vet_pharmacy: {
    queries: ["ветаптека", "ветеринарна аптека", "зооветаптека"],
    includedType: null,
    animals: ["dog", "cat", "bird", "rodent", "reptile", "other"],
  },
  grooming: {
    queries: ["грумінг", "стрижка собак", "грумінг салон"],
    includedType: null,
    animals: ["dog", "cat"],
  },
  pet_boarding: {
    queries: ["передержка тварин", "готель для тварин", "зоо готель"],
    includedType: null,
    animals: ["dog", "cat"],
  },
  shelter: {
    queries: ["притулок для тварин", "приют животных", "animal shelter"],
    includedType: null,
    animals: ["dog", "cat", "other"],
  },
  animal_volunteer_help: {
    queries: ["зоозахист", "волонтери тварини", "допомога тваринам"],
    includedType: null,
    animals: ["dog", "cat", "other"],
  },
  pet_friendly_place: {
    queries: ["pet friendly кафе", "з тваринами дозволено", "pet friendly"],
    includedType: null,
    animals: ["dog", "cat"],
  },
  // Not in the safe default set. Only runs with --exclude-emergency=false.
  emergency_vet: {
    queries: ["цілодобова ветеринарна клініка", "ветеринар 24/7", "невідкладна ветеринарна допомога"],
    includedType: "veterinary_care",
    animals: ["dog", "cat", "other"],
  },
};

// Safe-by-default categories: everything except emergency_vet.
const DEFAULT_SAFE_CATEGORIES = Object.keys(CATEGORY_CONFIG).filter((c) => c !== "emergency_vet");

// Wording that implies emergency / round-the-clock service.
const EMERGENCY_PATTERNS = [
  /цілодоб/i, /24\s*[\/:]?\s*7/, /24\s*год/i, /невідклад/i, /ургент/i, /швидка допомога/i,
  /emergency/i, /urgent/i, /round[-\s]?the[-\s]?clock/i, /круглосуточ/i, /неотлож/i,
];

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function boolArg(name, fallback) {
  const v = argValue(name, null);
  if (v == null) return fallback;
  return !/^(false|0|no|off)$/i.test(v.trim());
}

async function loadEnvFile(filename) {
  const file = path.join(ROOT, filename);
  try {
    const raw = await fs.readFile(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (process.env[key] == null) process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toNumber = (v, f) => (Number.isFinite(Number(v)) ? Number(v) : f);

function shortHash(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

function distanceMeters(a, b) {
  if (!a || !b || a.latitude == null || b.latitude == null) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const normName = (s) => (s || "").toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "");
const normPhone = (s) => {
  const d = (s || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};
function domainOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function nearestDistrict(location, address = "") {
  const addressLower = address.toLowerCase();
  const aliases = [
    ["podil", ["поділ", "подоль", "podil"]],
    ["pechersk", ["печер", "pechersk"]],
    ["obolon", ["оболон", "obolon"]],
    ["pozniaky", ["позня", "pozniaky"]],
    ["osokorky", ["осокорк", "osokorky"]],
    ["troieshchyna", ["троєщ", "троещ", "troiesh"]],
    ["holosiiv", ["голосі", "голосе", "holosi"]],
    ["solomianka", ["солом", "solom"]],
    ["nyvky", ["нивк", "nyvky"]],
    ["sviatoshyn", ["святош", "sviatosh"]],
  ];
  for (const [district, needles] of aliases) {
    if (needles.some((needle) => addressLower.includes(needle))) return district;
  }
  if (!location?.latitude || !location?.longitude) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const [district, center] of Object.entries(DISTRICTS)) {
    const d = distanceMeters(location, center);
    if (d < bestDistance) {
      bestDistance = d;
      best = district;
    }
  }
  return best;
}

function isOpen247(place) {
  const periods = place.regularOpeningHours?.periods ?? place.currentOpeningHours?.periods ?? [];
  if (!Array.isArray(periods) || periods.length < 7) return false;
  const openDays = new Set();
  for (const period of periods) {
    const open = period.open;
    const close = period.close;
    if (!open || typeof open.day !== "number") continue;
    const openHour = Number(open.hour ?? 0);
    const openMinute = Number(open.minute ?? 0);
    const closeHour = Number(close?.hour ?? 24);
    const looksFullDay = openHour === 0 && openMinute === 0 && (closeHour >= 23 || closeHour === 0);
    if (looksFullDay) openDays.add(open.day);
  }
  return openDays.size >= 7;
}

function looksEmergency({ name, address, query, types, open247, category }) {
  if (category === "emergency_vet") return true;
  if (open247) return true;
  const haystack = [name, address, query, ...(types || [])].join(" ");
  return EMERGENCY_PATTERNS.some((re) => re.test(haystack));
}

function qualityScore(c) {
  let score = 0;
  score += c.phone ? 2 : -2;
  score += c.website ? 1 : 0;
  score += c.rating != null ? 1 : 0;
  score += (c.userRatingCount ?? 0) > 10 ? 1 : 0;
  score += c.address && c.address !== "Київ, Україна" ? 1 : 0;
  score += c.latitude != null && c.longitude != null ? 1 : -1;
  if (c.emergencyCandidate || c.isOpen24_7) score -= 2;
  if (c.duplicateCandidate) score -= 3;
  return score;
}

function normalizeCandidate(place, cfg, categoryName, queryMeta, excludeEmergency) {
  const displayName = place.displayName?.text || "Без назви";
  const googleId = place.id || `${displayName}-${place.formattedAddress ?? ""}`;
  const location = place.location
    ? { latitude: Number(place.location.latitude), longitude: Number(place.location.longitude) }
    : null;
  const open247 = isOpen247(place);
  const types = Array.isArray(place.types) ? place.types : [];
  const address = place.formattedAddress || "Київ, Україна";
  const businessStatus = place.businessStatus ?? null;

  const emergencyCandidate = looksEmergency({
    name: displayName,
    address,
    query: queryMeta.query,
    types,
    open247,
    category: categoryName,
  });

  return {
    id: `gp-${shortHash(googleId)}`,
    googlePlaceId: place.id || null,
    name: displayName,
    category: categoryName,
    address,
    district: nearestDistrict(location, address),
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    googleMapsUri: place.googleMapsUri || null,
    rating: typeof place.rating === "number" ? Math.max(0, Math.min(5, place.rating)) : null,
    userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    animalTypes: cfg.animals,
    emergencyAvailable: emergencyCandidate,
    isOpen24_7: open247,
    businessStatus,
    types,
    emergencyCandidate,
    open24_7Candidate: open247,
    duplicateCandidate: false,
    matchedExistingPlaceId: null,
    qualityScore: 0,
    dataSource: "google_places_external",
    // Emergency candidates need a phone call before any use; everything else needs review.
    verificationStatus: emergencyCandidate ? "needs_phone_confirmation" : "needs_review",
    verified: false,
    status: "needs_review",
    lastVerifiedAt: null,
    sourceLabel:
      businessStatus && businessStatus !== "OPERATIONAL"
        ? `Google Places (${businessStatus}, external, unreviewed)`
        : "Google Places (external, unreviewed)",
    sourceUrl: place.googleMapsUri || null,
    importMeta: { query: queryMeta.query, district: queryMeta.district, googleId, excludeEmergency },
  };
}

// Parse the public PLACES array out of the generated TS module (no TS runtime needed).
async function loadExistingPlaces() {
  try {
    const src = await fs.readFile(path.join(ROOT, PLACES_TS), "utf8");
    const marker = src.indexOf("export const PLACES");
    if (marker < 0) return [];
    const eq = src.indexOf("=", marker);
    const start = src.indexOf("[", eq);
    const end = src.lastIndexOf("]");
    if (start < 0 || end < 0) return [];
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    return [];
  }
}

function markDuplicatesAgainstPlaces(candidates, places) {
  const byPhone = new Map();
  const byDomain = new Map();
  const byName = new Map();
  for (const p of places) {
    if (p.phone) byPhone.set(normPhone(p.phone), p.id);
    const dom = domainOf(p.website);
    if (dom) byDomain.set(dom, p.id);
    if (p.name) byName.set(normName(p.name), p.id);
  }
  for (const c of candidates) {
    let matched = null;
    const ph = normPhone(c.phone);
    const dom = domainOf(c.website);
    if (ph && byPhone.has(ph)) matched = byPhone.get(ph);
    else if (dom && byDomain.has(dom)) matched = byDomain.get(dom);
    else if (byName.has(normName(c.name))) {
      const pid = byName.get(normName(c.name));
      const pl = places.find((p) => p.id === pid);
      if (pl && distanceMeters(c, pl) < 500) matched = pid;
    }
    if (!matched) {
      // Fall back to pure coordinate proximity (<80m) against any existing place.
      for (const p of places) {
        if (distanceMeters(c, p) < 80) {
          matched = p.id;
          break;
        }
      }
    }
    if (matched) {
      c.duplicateCandidate = true;
      c.matchedExistingPlaceId = matched;
    }
  }
}

// Collapse candidate-vs-candidate duplicates (keep the most complete one).
function dedupeCandidates(candidates) {
  const kept = [];
  const seen = new Map(); // signature -> index in kept
  const sig = (c) => normPhone(c.phone) || domainOf(c.website) || `${normName(c.name)}|${normName(c.address)}`;
  const completeness = (c) => (c.phone ? 2 : 0) + (c.website ? 1 : 0) + (c.rating != null ? 1 : 0);
  for (const c of candidates) {
    const key = sig(c);
    if (key && seen.has(key)) {
      const idx = seen.get(key);
      if (completeness(c) > completeness(kept[idx])) kept[idx] = c;
      continue;
    }
    if (key) seen.set(key, kept.length);
    kept.push(c);
  }
  return kept;
}

async function googleTextSearch({ apiKey, query, center, radius, includedType, pageToken }) {
  const body = pageToken
    ? { pageToken }
    : {
        textQuery: query,
        languageCode: "uk",
        regionCode: "UA",
        maxResultCount: 20,
        locationBias: { circle: { center: { latitude: center.latitude, longitude: center.longitude }, radius } },
      };
  if (!pageToken && includedType) {
    body.includedType = includedType;
    body.strictTypeFiltering = false;
  }
  const response = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google Places request failed (${response.status}): ${json.error?.message || response.statusText}`);
  }
  return json;
}

const CSV_COLUMNS = [
  "id", "google_place_id", "name", "category", "district", "address", "lat", "lng",
  "phone", "website", "google_maps_url", "rating", "user_rating_count", "business_status",
  "types", "emergency_candidate", "open_24_7_candidate", "duplicate_candidate",
  "matched_existing_place_id", "quality_score", "verification_status", "manual_check_result", "notes",
];

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toReviewCsv(candidates) {
  // Non-emergency first (quality desc), then emergency candidates (quality desc) — separated + marked.
  const sorted = [...candidates].sort((a, b) => {
    const ea = a.emergencyCandidate ? 1 : 0;
    const eb = b.emergencyCandidate ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
  });
  const rows = sorted.map((c) =>
    [
      c.id, c.googlePlaceId || "", c.name, c.category, c.district || "", c.address,
      c.latitude ?? "", c.longitude ?? "", c.phone || "", c.website || "", c.googleMapsUri || "",
      c.rating ?? "", c.userRatingCount ?? "", c.businessStatus || "", (c.types || []).join("|"),
      c.emergencyCandidate ? "true" : "", c.open24_7Candidate ? "true" : "",
      c.duplicateCandidate ? "true" : "", c.matchedExistingPlaceId || "", c.qualityScore ?? "",
      c.verificationStatus, "", "",
    ].map(csvEscape).join(","),
  );
  return `${[CSV_COLUMNS.join(","), ...rows].join("\n")}\n`;
}

function toTypeScript(candidates) {
  const clean = candidates.map(({ importMeta, ...c }) => c);
  return (
    `// AUTO-GENERATED by \`npm run import:google-places\` — do not edit by hand.\n` +
    `// External Google Places candidates pending human review. Never published as-is,\n` +
    `// never verified, never emergency until phone-confirmed in /admin/imports/google-places.\n` +
    `import type { GooglePlaceCandidate } from "@/lib/types";\n\n` +
    `export const GOOGLE_PLACES: GooglePlaceCandidate[] = ${JSON.stringify(clean, null, 2)};\n`
  );
}

function toEmptyTypeScript() {
  return (
    `// AUTO-GENERATED by \`npm run import:google-places\`.\n` +
    `// Empty by default so the app builds without Google credentials.\n` +
    `// External Google Places candidates are review inputs, not public launch data.\n` +
    `import type { GooglePlaceCandidate } from "@/lib/types";\n\n` +
    `export const GOOGLE_PLACES: GooglePlaceCandidate[] = [];\n`
  );
}

function buildSampleCandidates() {
  const base = {
    id: "gp-sample-vet-1",
    googlePlaceId: null,
    name: "SAMPLE Vet Clinic — replace with real Google import",
    category: "veterinary_clinic",
    address: "Київ, Україна",
    district: "pechersk",
    phone: null,
    website: null,
    googleMapsUri: null,
    rating: null,
    userRatingCount: null,
    latitude: 50.4501,
    longitude: 30.5234,
    animalTypes: ["dog", "cat", "other"],
    emergencyAvailable: false,
    isOpen24_7: false,
    businessStatus: "OPERATIONAL",
    types: ["veterinary_care"],
    emergencyCandidate: false,
    open24_7Candidate: false,
    duplicateCandidate: false,
    matchedExistingPlaceId: null,
    qualityScore: 0,
    dataSource: "google_places_external",
    verificationStatus: "needs_review",
    verified: false,
    status: "needs_review",
    lastVerifiedAt: null,
    sourceLabel: "Sample only — not a real place",
    sourceUrl: null,
    importMeta: {},
  };
  base.qualityScore = qualityScore(base);
  return [base];
}

function printUsage() {
  console.log(`
VetNear Google Places importer (safe by default)

Usage:
  GOOGLE_PLACES_API_KEY=... npm run import:google-places -- [options]

Options:
  --categories=veterinary_clinic,pet_store,vet_pharmacy,grooming,pet_boarding,shelter,animal_volunteer_help,pet_friendly_place
                (default: all safe categories — emergency_vet is excluded)
  --districts=pechersk,obolon,pozniaky,holosiiv,solomianka   (default: all)
  --exclude-emergency=true    (default true — skip emergency_vet, flag 24/7 as needs_phone_confirmation)
  --radius=3500
  --limit=100
  --delay-ms=600
  --output=src/lib/data/google-places.ts
  --raw=data/imports/google-places-raw.json
  --review-csv=data/imports/google-places-review.csv
  --dry-run
  --empty       write an empty src/lib/data/google-places.ts (+ empty csv/json)
  --sample      write one sample candidate for UI testing only

Examples:
  npm run import:google-places -- --categories=veterinary_clinic,pet_store,vet_pharmacy,grooming,pet_boarding,shelter --districts=pechersk,obolon,pozniaky,holosiiv,solomianka --limit=100 --exclude-emergency=true
  npm run import:google-places -- --categories=pet_store,vet_pharmacy,grooming --districts=podil,nyvky,sviatoshyn --limit=80 --exclude-emergency=true
`);
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printUsage();
    return;
  }

  await loadEnvFile(".env.local");
  await loadEnvFile(".env");

  const outputTs = argValue("output", DEFAULT_OUTPUT_TS);
  const rawJson = argValue("raw", DEFAULT_RAW_JSON);
  const reviewCsv = argValue("review-csv", DEFAULT_REVIEW_CSV);
  const excludeEmergency = boolArg("exclude-emergency", true);

  const mkdirs = async () => {
    for (const f of [outputTs, reviewCsv, rawJson]) {
      await fs.mkdir(path.dirname(path.join(ROOT, f)), { recursive: true });
    }
  };

  if (hasFlag("empty")) {
    await mkdirs();
    await fs.writeFile(path.join(ROOT, outputTs), toEmptyTypeScript(), "utf8");
    await fs.writeFile(path.join(ROOT, reviewCsv), toReviewCsv([]), "utf8");
    await fs.writeFile(path.join(ROOT, rawJson), "[]\n", "utf8");
    console.log(`Written empty ${outputTs}, ${reviewCsv}, ${rawJson}`);
    return;
  }

  if (hasFlag("sample")) {
    await mkdirs();
    const sample = buildSampleCandidates();
    await fs.writeFile(path.join(ROOT, outputTs), toTypeScript(sample), "utf8");
    await fs.writeFile(path.join(ROOT, reviewCsv), toReviewCsv(sample), "utf8");
    console.log(`Written sample candidate to ${outputTs} and ${reviewCsv}`);
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY. Add it to .env.local (server-side, NOT NEXT_PUBLIC_), or run with --sample / --empty.");
  }

  let categoryNames = argValue("categories", DEFAULT_SAFE_CATEGORIES.join(","))
    .split(",").map((s) => s.trim()).filter(Boolean);
  const districtNames = argValue("districts", Object.keys(DISTRICTS).join(","))
    .split(",").map((s) => s.trim()).filter(Boolean);

  for (const name of categoryNames) {
    if (!CATEGORY_CONFIG[name]) throw new Error(`Unknown category: ${name}`);
  }
  for (const name of districtNames) {
    if (!DISTRICTS[name]) throw new Error(`Unknown district: ${name}`);
  }

  // Safety: never query emergency_vet while exclude-emergency is on (the default).
  if (excludeEmergency && categoryNames.includes("emergency_vet")) {
    console.warn("⚠ --exclude-emergency=true: skipping emergency_vet category (use --exclude-emergency=false to include, still review-only).");
    categoryNames = categoryNames.filter((c) => c !== "emergency_vet");
  }
  if (categoryNames.length === 0) throw new Error("No categories to import after applying safety filters.");

  const radius = toNumber(argValue("radius", "3500"), 3500);
  const totalLimit = toNumber(argValue("limit", "180"), 180);
  const delayMs = toNumber(argValue("delay-ms", "600"), 600);
  const dryRun = hasFlag("dry-run");

  const rawResults = [];
  const byGoogleId = new Map();
  const normalizedById = new Map();

  outer:
  for (const categoryName of categoryNames) {
    const cfg = CATEGORY_CONFIG[categoryName];
    for (const districtName of districtNames) {
      const district = DISTRICTS[districtName];
      for (const query of cfg.queries) {
        const textQuery = `${query} ${district.label}, Київ, Україна`;
        console.log(`→ ${categoryName} / ${districtName}: ${textQuery}`);
        let pageToken = null;
        for (let page = 0; page < 3; page += 1) {
          if (pageToken) await sleep(2200);
          const json = await googleTextSearch({ apiKey, query: textQuery, center: district, radius, includedType: cfg.includedType, pageToken });
          const places = Array.isArray(json.places) ? json.places : [];
          rawResults.push({ categoryName, districtName, query: textQuery, page, count: places.length, response: json });
          for (const place of places) {
            const googleId = place.id;
            if (!googleId || byGoogleId.has(googleId)) continue;
            byGoogleId.set(googleId, place);
            const normalized = normalizeCandidate(place, cfg, categoryName, { query, district: districtName }, excludeEmergency);
            normalizedById.set(normalized.id, normalized);
            if (normalizedById.size >= totalLimit) break outer;
          }
          pageToken = json.nextPageToken || null;
          if (!pageToken) break;
        }
        await sleep(delayMs);
      }
    }
  }

  let candidates = dedupeCandidates([...normalizedById.values()]);

  const existingPlaces = await loadExistingPlaces();
  markDuplicatesAgainstPlaces(candidates, existingPlaces);

  for (const c of candidates) c.qualityScore = qualityScore(c);

  candidates.sort((a, b) => {
    const ea = a.emergencyCandidate ? 1 : 0;
    const eb = b.emergencyCandidate ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
  });

  const emergencyCount = candidates.filter((c) => c.emergencyCandidate).length;
  const duplicateCount = candidates.filter((c) => c.duplicateCandidate).length;
  console.log(`\nUnique Google places: ${byGoogleId.size}; candidates: ${candidates.length} (emergency: ${emergencyCount}, duplicates vs PLACES: ${duplicateCount}).`);
  console.table(candidates.reduce((acc, p) => ((acc[p.category] = (acc[p.category] || 0) + 1), acc), {}));

  if (dryRun) {
    console.log("Dry run: files were not written.");
    return;
  }

  await mkdirs();
  await fs.writeFile(path.join(ROOT, outputTs), toTypeScript(candidates), "utf8");
  await fs.writeFile(path.join(ROOT, rawJson), JSON.stringify(rawResults, null, 2), "utf8");
  await fs.writeFile(path.join(ROOT, reviewCsv), toReviewCsv(candidates), "utf8");

  console.log(`\nWritten:\n  ${outputTs}\n  ${rawJson}\n  ${reviewCsv}`);
  console.log("Public dataset (src/lib/data/places.ts) was NOT modified.");
  console.log("Next: review at /admin/imports/google-places. Emergency candidates need a phone call before any use.");
}

main().catch((error) => {
  console.error(`\nImport failed: ${error.message}\n`);
  process.exit(1);
});
