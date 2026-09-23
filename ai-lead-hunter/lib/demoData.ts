// Deterministic, fully fictional Kyiv businesses for demo mode.
// 100+ generated entries with varied digital weaknesses so every signal,
// filter, and the website analyzer are exercisable WITHOUT any network calls.
// All names are invented; all websites use example.com; phones are placeholders.

import type { NicheKey, RawBusiness, WebsiteAnalysis } from "./types";

const HOURS = [
  "Пн: 09:00–20:00",
  "Вт: 09:00–20:00",
  "Ср: 09:00–20:00",
  "Чт: 09:00–20:00",
  "Пт: 09:00–20:00",
  "Сб: 10:00–18:00",
  "Нд: Зачинено",
];

// Deterministic PRNG so demo output is stable across requests.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type District = { name: string; lat: number; lng: number };
const DISTRICTS: District[] = [
  { name: "Позняки", lat: 50.396, lng: 30.631 },
  { name: "Осокорки", lat: 50.392, lng: 30.616 },
  { name: "Оболонь", lat: 50.512, lng: 30.498 },
  { name: "Поділ", lat: 50.466, lng: 30.516 },
  { name: "Печерськ", lat: 50.425, lng: 30.538 },
  { name: "Виноградар", lat: 50.488, lng: 30.412 },
  { name: "Святошино", lat: 50.458, lng: 30.366 },
  { name: "Дарниця", lat: 50.447, lng: 30.622 },
  { name: "Голосіїв", lat: 50.38, lng: 30.512 },
  { name: "Троєщина", lat: 50.512, lng: 30.602 },
  { name: "Центр", lat: 50.447, lng: 30.522 },
];

const STREETS = [
  "вул. Квіткова",
  "вул. Тиха",
  "просп. Сонячний",
  "вул. Лугова",
  "вул. Зоряна",
  "вул. Каштанова",
  "просп. Озерний",
  "вул. Лісова",
  "вул. Вишнева",
  "просп. Миру",
];

type NichePlan = {
  niche: NicheKey;
  count: number;
  category: string;
  prefixes: string[];
  suffixes: string[];
};

// Invented suffixes only — no real brand names.
const PLANS: NichePlan[] = [
  {
    niche: "beauty",
    count: 20,
    category: "Салон краси",
    prefixes: [
      "Студія краси",
      "Салон краси",
      "Манікюрна студія",
      "Барбершоп",
      "Beauty",
    ],
    suffixes: [
      "Lumera",
      "Verba",
      "Mirra",
      "Estia",
      "Velvet",
      "Bloom",
      "Onyx",
      "Kvit",
      "Aura",
      "Shik",
      "Nova",
      "Perla",
    ],
  },
  {
    niche: "dental",
    count: 20,
    category: "Стоматологія",
    prefixes: ["Стоматологія", "Дентал-центр", "Стоматклініка"],
    suffixes: [
      "DentaLine",
      "BiluZub",
      "Perlyna",
      "Akadem",
      "Status",
      "Avanti",
      "Medera",
      "Krona",
      "Aprel",
      "Ortos",
      "Zubr",
      "Sirius",
    ],
  },
  {
    niche: "vet",
    count: 20,
    category: "Ветеринарна клініка",
    prefixes: ["Ветклініка", "Ветцентр", "Зооклініка"],
    suffixes: [
      "Лапа+",
      "Друг",
      "Хвостик",
      "Котофей",
      "ВетЛайф",
      "Гав",
      "Мурчик",
      "Зоосвіт",
      "Панда",
      "Барсик",
      "Рекс",
      "Кеша",
    ],
  },
  {
    niche: "carwash",
    count: 8,
    category: "Автомийка",
    prefixes: ["Автомийка", "Мийка", "Detailing"],
    suffixes: [
      "AquaShine",
      "CleanCar",
      "BlueWave",
      "Splash",
      "Syaivo",
      "DriveClean",
      "EcoWash",
      "Krapla",
    ],
  },
  {
    niche: "auto_service",
    count: 7,
    category: "Автосервіс",
    prefixes: ["СТО", "Автосервіс", "Шиномонтаж"],
    suffixes: [
      "ТурбоФікс",
      "МоторПлюс",
      "AutoPro",
      "Кардан",
      "Garage24",
      "FixUp",
      "Vira",
    ],
  },
  {
    niche: "cafe",
    count: 6,
    category: "Кав'ярня",
    prefixes: ["Кав'ярня", "Coffee", "Кафе"],
    suffixes: ["Ранкове", "Zерно", "Crema", "Veranda", "Pause", "Затишок"],
  },
  {
    niche: "restaurant",
    count: 4,
    category: "Ресторан",
    prefixes: ["Ресторан", "Bistro", "Траторія"],
    suffixes: ["Vesna", "Supra", "Olива", "Хутір"],
  },
  {
    niche: "medical",
    count: 10,
    category: "Медичний центр",
    prefixes: ["Медичний центр", "Клініка", "Медцентр"],
    suffixes: [
      "Vita",
      "Renova",
      "Astra",
      "Medion",
      "Panaceia",
      "Lumed",
      "Salus",
      "Kardia",
      "Verum",
      "Nadia",
    ],
  },
  {
    niche: "fitness",
    count: 10,
    category: "Фітнес / SPA",
    prefixes: [
      "Фітнес-студія",
      "Спортзал",
      "SPA-студія",
      "Масаж-студія",
      "Wellness",
    ],
    suffixes: [
      "PulseUp",
      "Energy",
      "FitZone",
      "Forma",
      "Tonus",
      "Reset",
      "Flow",
      "Atlas",
      "Vector",
      "Relax",
    ],
  },
];

function phoneFor(rnd: () => number): string {
  const codes = ["67", "93", "50", "97", "63", "66", "99", "68", "73", "95"];
  const code = codes[Math.floor(rnd() * codes.length)];
  const d3 = String(100 + Math.floor(rnd() * 900));
  const d2a = String(10 + Math.floor(rnd() * 90));
  const d2b = String(10 + Math.floor(rnd() * 90));
  return `+380 ${code} ${d3} ${d2a} ${d2b}`;
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+|-+$/g, "") || "site"
  );
}

// Synthesize a website analysis for demo sites so website signals show up
// without any real network request. Variety is driven by the index.
function demoAnalysis(url: string, variant: number): WebsiteAnalysis {
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  const slug = host.split(".")[0].replace(/[^a-z0-9_]/gi, "_");
  const contacts = {
    emails: [`info@${host}`],
    instagram: `https://instagram.com/${slug}`,
    ...(variant % 4 === 0 ? { telegram: `https://t.me/${slug}_bot` } : {}),
  };
  switch (variant % 4) {
    case 0: // healthy site with booking
      return {
        checked: true,
        url,
        reachable: true,
        https: true,
        hasTitle: true,
        hasViewport: true,
        hasContactKeyword: true,
        hasBookingKeyword: true,
        hasSocialLinks: true,
        hasFormKeyword: true,
        contacts,
      };
    case 1: // reachable but no booking, no form
      return {
        checked: true,
        url,
        reachable: true,
        https: true,
        hasTitle: true,
        hasViewport: true,
        hasContactKeyword: true,
        hasBookingKeyword: false,
        hasSocialLinks: true,
        hasFormKeyword: false,
        contacts,
      };
    case 2: // reachable but no HTTPS
      return {
        checked: true,
        url,
        reachable: true,
        https: false,
        hasTitle: true,
        hasViewport: false,
        hasContactKeyword: false,
        hasBookingKeyword: false,
        hasSocialLinks: false,
        hasFormKeyword: false,
      };
    default: // unreachable / broken
      return {
        checked: true,
        url,
        reachable: false,
        https: url.startsWith("https://"),
        hasTitle: false,
        hasViewport: false,
        hasContactKeyword: false,
        hasBookingKeyword: false,
        hasSocialLinks: false,
        hasFormKeyword: false,
        note: "Сайт недоступний.",
      };
  }
}

function buildRaw(): RawBusiness[] {
  const out: RawBusiness[] = [];
  let gi = 0;
  for (const plan of PLANS) {
    for (let i = 0; i < plan.count; i++) {
      const rnd = mulberry32(1000 + gi * 97);
      const prefix = plan.prefixes[i % plan.prefixes.length];
      const suffix = plan.suffixes[i % plan.suffixes.length];
      const name = `${prefix} ${suffix}`;
      const d = DISTRICTS[gi % DISTRICTS.length];
      const street = STREETS[(gi * 3) % STREETS.length];
      const houseNo = 1 + Math.floor(rnd() * 80);
      // jitter coords a little so distances vary
      const lat = d.lat + (rnd() - 0.5) * 0.02;
      const lng = d.lng + (rnd() - 0.5) * 0.02;

      const hasPhone = rnd() > 0.12; // ~88% have a phone
      const hasWebsite = rnd() > 0.55; // ~45% have a website
      const rating = Math.round((3.4 + rnd() * 1.5) * 10) / 10; // 3.4–4.9
      const reviewCount = Math.floor(2 + Math.pow(rnd(), 1.6) * 360); // skew low
      const isOpenNow = rnd() > 0.4;
      const operational = rnd() > 0.08;

      const website = hasWebsite
        ? `https://${slug(suffix)}-${plan.niche}.example.com`
        : undefined;
      const websiteAnalysis = website ? demoAnalysis(website, gi) : undefined;

      out.push({
        source: "demo",
        name,
        niche: plan.niche,
        category: plan.category,
        address: `${street}, ${houseNo}, ${d.name}, Київ`,
        lat,
        lng,
        phone: hasPhone ? phoneFor(rnd) : undefined,
        website,
        websiteAnalysis,
        rating,
        reviewCount,
        openingHours: HOURS,
        isOpenNow,
        businessStatus: operational ? "OPERATIONAL" : "CLOSED_TEMPORARILY",
      });
      gi++;
    }
  }
  return out;
}

const RAW: RawBusiness[] = buildRaw();

// Center of Kyiv, used as a default origin for demo distance calc.
export const KYIV_CENTER = { lat: 50.4501, lng: 30.5234 };

export function getDemoBusinesses(niche?: NicheKey): RawBusiness[] {
  if (!niche || niche === "generic") return [...RAW];
  const filtered = RAW.filter((b) => b.niche === niche);
  // Fall back to the whole set so the demo never returns an empty screen.
  return filtered.length > 0 ? filtered : [...RAW];
}

export const DEMO_COUNT = RAW.length;
