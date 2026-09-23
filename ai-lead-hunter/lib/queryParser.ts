// Lightweight, deterministic NL parser. Maps a free-text request to form values.
// Falls back to sane defaults (Kyiv, 5km, 30 leads) when something can't be detected.

import type { LocationMode, NicheKey, OfferType, SearchFilters } from "./types";
import { findCityInText } from "./cities";
import { clamp } from "./utils";

export type ParsedQuery = {
  niche: NicheKey;
  offer: OfferType;
  locationMode: LocationMode;
  city?: string;
  address?: string;
  radiusKm: number;
  limit: number;
  limitFromQuery: boolean;
  nearMe: boolean;
  filters: SearchFilters;
};

const NICHE_KEYWORDS: Array<[NicheKey, string[]]> = [
  [
    "beauty",
    [
      "салон краси",
      "салон красоты",
      "краси",
      "красо",
      "beauty",
      "манікюр",
      "маникюр",
      "барбер",
      "barber",
      "перукар",
      "nail",
    ],
  ],
  ["dental", ["стоматолог", "dental", "dentist", "зуб"]],
  ["vet", ["ветклін", "ветклин", "вет клін", "вет клин", "ветеринар", "vet", "veterinary"]],
  ["carwash", ["автомий", "автомой", "мийка", "мойка", "car wash", "carwash", "детейл", "detailing"]],
  ["cafe", ["кафе", "кав'ярн", "кофе", "coffee", "cafe", "кофейн"]],
  ["fitness", ["фітнес", "фитнес", "спортзал", "gym", "fitness", "зал"]],
  [
    "auto_service",
    [
      "сто",
      "автосервіс",
      "автосервис",
      "car repair",
      "auto service",
      "шиномонтаж",
    ],
  ],
  [
    "medical",
    [
      "медцентр",
      "медичн",
      "клінік",
      "клиник",
      "clinic",
      "medical",
      "лікар",
      "врач",
    ],
  ],
  ["restaurant", ["ресторан", "restaurant"]],
  ["repair", ["ремонт", "сервісний центр", "repair"]],
];

const OFFER_KEYWORDS: Array<[OfferType, string[]]> = [
  [
    "booking",
    [
      "онлайн-запис",
      "онлайн запис",
      "онлайн-запись",
      "запис",
      "запись",
      "booking",
      "бронюв",
    ],
  ],
  [
    "chatbot",
    [
      "ai",
      "штучний інтелект",
      "бот",
      "асистент",
      "ассистент",
      "chatbot",
      "чат-бот",
      "chat bot",
    ],
  ],
  ["landing", ["лендинг", "landing"]],
  ["seo", ["seo", "сео", "google business", "видимість", "видимость"]],
  [
    "smm",
    ["smm", "смм", "соцмереж", "соцсет", "instagram", "контент", "content"],
  ],
  ["reputation", ["репутац", "відгук", "отзыв", "review", "reputation"]],
  ["crm", ["crm", "црм"]],
  ["automation", ["автоматиз", "automation"]],
  ["website", ["сайт", "website", "веб-сайт", "web"]],
];



// District stem -> display name. Stems are matched as substrings (lowercased).
const DISTRICTS: Array<[string, string]> = [
  ["позняк", "Позняки"],
  ["оболон", "Оболонь"],
  ["поділ", "Поділ"],
  ["подол", "Поділ"],
  ["троєщин", "Троєщина"],
  ["троещин", "Троєщина"],
  ["печерськ", "Печерськ"],
  ["печерск", "Печерськ"],
  ["осокорк", "Осокорки"],
  ["виноградар", "Виноградар"],
  ["лук'янів", "Лук'янівка"],
  ["лукянів", "Лук'янівка"],
  ["святошин", "Святошино"],
  ["дарниц", "Дарниця"],
  ["голосіїв", "Голосіїв"],
  ["нивки", "Нивки"],
  ["березняк", "Березняки"],
  ["теремк", "Теремки"],
  ["солом'янк", "Солом'янка"],
  ["соломянк", "Солом'янка"],
];

const NEAR_ME = [
  "поруч",
  "рядом",
  "near me",
  "коло мене",
  "біля мене",
  "near",
  "навколо",
];

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) =>
    ["сто", "зал", "ai", "near", "vet"].includes(w)
      ? new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, "u").test(text)
      : text.includes(w),
  );
}

export function parseQuery(input: string): ParsedQuery {
  const text = (input || "").toLowerCase();

  // Niche
  let niche: NicheKey = "generic";
  for (const [key, words] of NICHE_KEYWORDS) {
    if (includesAny(text, words)) {
      niche = key;
      break;
    }
  }

  // Offer
  let offer: OfferType = "website";
  for (const [key, words] of OFFER_KEYWORDS) {
    if (includesAny(text, words)) {
      offer = key;
      break;
    }
  }
  // Sensible default: appointment niches default to booking if no offer cue.
  if (!OFFER_KEYWORDS.some(([, w]) => includesAny(text, w))) {
    if (["beauty", "dental", "vet", "medical", "fitness"].includes(niche)) {
      offer = "booking";
    }
  }

  // Location
  let locationMode: LocationMode = "city";
  let city: string | undefined;
  let address: string | undefined;
  const nearMe = includesAny(text, NEAR_ME);
  if (nearMe) locationMode = "near_me";

  const cityHit = findCityInText(text);
  const districtHit =
    !cityHit || cityHit.name === "Київ"
      ? DISTRICTS.find(([stem]) => text.includes(stem))
      : undefined;
  const cityName = cityHit?.name;

  if (districtHit) {
    address = cityName
      ? `${districtHit[1]}, ${cityName}`
      : `${districtHit[1]}, Київ`;
    if (!nearMe) locationMode = "address";
  }
  if (cityName) {
    city = cityName;
    if (!nearMe && !districtHit) locationMode = "city";
  }
  if (!city) city = "Київ";

  // Radius (snap to the closest preset). 0 = whole city for a city search.
  let radiusKm = locationMode === "city" ? 0 : 5;
  const radiusMatch = text.match(/(\d+)\s*(км|km)/);
  if (radiusMatch) {
    const r = parseInt(radiusMatch[1], 10);
    radiusKm = [1, 3, 5, 10, 25].reduce((p, c) =>
      Math.abs(c - r) < Math.abs(p - r) ? c : p,
    );
  }

  // Limit: any count-like number in the query (excluding the radius token).
  let limit = 30;
  let limitFromQuery = false;
  const textNoRadius = text
    .replace(/(\d+)\s*(км|km)/g, " ")
    .replace(
      /[$€₴]\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:грн|долар\p{L}*|доллар\p{L}*|usd|eur|uah|євро)/gu,
      " ",
    );
  const ints = Array.from(textNoRadius.matchAll(/\b(\d{1,3})\b/g))
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n >= 1 && n <= 300);
  if (ints.length > 0) {
    const count = ints.find((n) => n >= 5) ?? ints[0];
    limit = clamp(count, 1, 200);
    limitFromQuery = true;
  }

  // Filters
  const filters: SearchFilters = {};
  if (
    text.includes("без сайту") ||
    text.includes("без сайта") ||
    text.includes("no website")
  ) {
    filters.noWebsite = true;
  }
  if (text.includes("з сайтом") || text.includes("с сайтом"))
    filters.hasWebsite = true;
  if (
    ["є телефон", "есть телефон", "з телефоном", "с телефоном", "with phone"].some(
      (w) => text.includes(w),
    )
  )
    filters.hasPhone = true;
  if (text.includes("низький рейтинг") || text.includes("низкий рейтинг"))
    filters.ratingBelow = 4.2;
  if (text.includes("багато відгук") || text.includes("много отзыв"))
    filters.minReviews = 50;
  if (text.includes("відкрит") && text.includes("зараз")) filters.openNow = true;
  if (
    text.includes("гарячі") ||
    text.includes("горячие") ||
    text.includes("hot")
  )
    filters.hotOnly = true;

  return {
    niche,
    offer,
    locationMode,
    city,
    address,
    radiusKm,
    limit,
    limitFromQuery,
    nearMe,
    filters,
  };
}
