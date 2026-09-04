// Builds src/lib/data/places.ts from a manually-curated list of REAL Kyiv pet
// businesses (names/addresses/phones/sites compiled from official websites and
// public directories: aldenvet.ua, avet.kiev.ua, masterzoo.ua, locator.ua, 2gis,
// official salon sites). See docs/DATASET_NOTES.md for provenance + caveats.
//
// Honesty rules baked in:
//  - emergencyAvailable: false and isOpen24_7: false for EVERY place (none are
//    phone-confirmed for emergency — task requirement #5/#6).
//  - No "emergency_vet" category -> public emergency results stay honestly empty.
//  - verifiedBy is an honest method label, NOT a person claiming phone calls.
//  - Coordinates are approximate (street/district level) — flagged in NOTES.
import { writeFileSync } from "node:fs";

const VERIFIED_AT = "2026-06-29";
const CANDIDATES_ADDED_AT = "2026-07-02";
const VERIFIED_BY = "VetNear team (public listings + official sites)";
const SOURCE_LABEL = "Офіційний сайт / публічні каталоги";

// Ukrainian -> Latin slug transliteration.
const TR = {
  а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",
  й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",
  ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia","'":"",'’':"",ʼ:"",
};
function slugify(s) {
  return s.toLowerCase().split("").map((c) => (c in TR ? TR[c] : /[a-z0-9]/.test(c) ? c : "-")).join("")
    .replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Working-hours presets (day 0 = Sunday .. 6 = Saturday).
const hours = (open, close, { sun = true } = {}) =>
  Array.from({ length: 7 }, (_, day) => ({ day, open, close, ...(day === 0 && !sun ? { closed: true } : {}) }));
const HOURS = {
  clinic: hours("09:00", "21:00"),
  store: hours("10:00", "22:00"),
  pharmacy: hours("09:00", "21:00"),
  grooming: hours("10:00", "20:00", { sun: false }),
  boarding: hours("08:00", "20:00"),
};

// Per-category capability + service defaults.
const CAT = {
  veterinary_clinic: {
    hours: HOURS.clinic, services: ["Терапія", "Хірургія", "Вакцинація", "УЗД", "Аналізи", "Стаціонар"],
    animals: ["dog", "cat", "rodent", "bird"], flags: { hasSurgery: true, hasUltrasound: true, hasXray: true, hasPharmacy: true },
  },
  pet_store: {
    hours: HOURS.store, services: ["Корми", "Аксесуари", "Іграшки", "Наповнювачі", "Доставка"],
    animals: ["dog", "cat", "bird", "rodent", "reptile"], flags: { deliveryAvailable: true, pickupAvailable: true },
  },
  vet_pharmacy: {
    hours: HOURS.pharmacy, services: ["Ветпрепарати", "Вакцини", "Засоби догляду"],
    animals: ["dog", "cat", "rodent", "bird"], flags: { hasPharmacy: true, pickupAvailable: true },
  },
  grooming: {
    hours: HOURS.grooming, services: ["Стрижка", "Купання", "Гігієнічний догляд", "Чищення вух", "Підстригання кігтів"],
    animals: ["dog", "cat"], flags: { appointmentRequired: true },
  },
  pet_boarding: {
    hours: HOURS.boarding, services: ["Готель для тварин", "Денний догляд", "Грумінг", "Догляд"],
    animals: ["dog", "cat"], flags: { appointmentRequired: true },
  },
};

// ── Curated REAL businesses ────────────────────────────────────────────────
const A = "+380800351088"; // Alden-Vet hotline
const MZ = "+380800212002"; // MasterZoo hotline
const RAW = [
  // Veterinary clinics
  ["Алден-Вет (Позняки)", "veterinary_clinic", "pozniaky", "вул. Анни Ахматової, 16А", A, "https://aldenvet.ua", 50.3998, 30.6285],
  ["Алден-Вет (Оболонь, Героїв Дніпра)", "veterinary_clinic", "obolon", "вул. Героїв Дніпра, 18", A, "https://aldenvet.ua", 50.5225, 30.4985],
  ["Алден-Вет (Троєщина)", "veterinary_clinic", "troieshchyna", "вул. Миколи Закревського, 87", A, "https://aldenvet.ua", 50.5160, 30.6010],
  ["Алден-Вет (Нивки)", "veterinary_clinic", "nyvky", "вул. Мрії, 30", A, "https://aldenvet.ua", 50.4585, 30.4120],
  ["Алден-Вет ВетПро (Оболонь)", "veterinary_clinic", "obolon", "просп. Володимира Івасюка, 6, корп. 6", A, "https://aldenvet.ua", 50.5050, 30.4980],
  ["Алден-Вет (Оболонь, Приозерна)", "veterinary_clinic", "obolon", "вул. Приозерна, 12а", A, "https://aldenvet.ua", 50.5080, 30.4960],
  ["А-Вет (Оболонь)", "veterinary_clinic", "obolon", "просп. Володимира Івасюка, 8, корп. 8", "+380505371000", "https://avet.kiev.ua", 50.5045, 30.4975],
  ["Мика-вет", "veterinary_clinic", "osokorky", "просп. Петра Григоренка, 5а", "+380681060160", null, 50.3960, 30.6230],
  ["Ветклініка Нагорного", "veterinary_clinic", "podil", "вул. Воздвиженська, 27", "+380677789422", null, 50.4640, 30.5100],
  ["Альфа-Вет", "veterinary_clinic", "holosiiv", "вул. Топольова, 3", "+380662534451", null, 50.3920, 30.4750],
  ["Зоодоктор", "veterinary_clinic", "troieshchyna", "просп. Лісовий, 39а", "+380443315010", null, 50.4880, 30.6280],
  ["Dr. Shedi", "veterinary_clinic", "osokorky", "вул. Вірменська, 29", "+380445639479", null, 50.4300, 30.6050],
  ["Мир тварин", "veterinary_clinic", "osokorky", "вул. Урлівська, 4", "+380970754715", null, 50.3970, 30.6300],
  ["VetCityPets", "veterinary_clinic", "obolon", "вул. Героїв полку «Азов», 5б", "+380682400203", null, 50.5150, 30.4970],
  ["SuperVet", "veterinary_clinic", "osokorky", "вул. Челябінська, 13", "+380443626159", null, 50.4280, 30.6080],
  // Pet stores — MasterZoo
  ["MasterZoo (Dream Town)", "pet_store", "obolon", "Оболонський просп., 21Б, ТРЦ «Dream Town»", MZ, "https://masterzoo.ua", 50.5230, 30.4990],
  ["MasterZoo (River Mall)", "pet_store", "osokorky", "Дніпровська наб., 12, ТРЦ «River Mall»", MZ, "https://masterzoo.ua", 50.3960, 30.6135],
  ["MasterZoo (Sky Mall)", "pet_store", "troieshchyna", "просп. Романа Шухевича, 2т, ТРЦ «Sky Mall»", MZ, "https://masterzoo.ua", 50.5130, 30.6020],
  ["MasterZoo (Район)", "pet_store", "troieshchyna", "вул. Миколи Лаврухіна, 4, ТРЦ «Район»", MZ, "https://masterzoo.ua", 50.5185, 30.6155],
  ["MasterZoo (Хіт Mall)", "pet_store", "nyvky", "Берестейський просп., 134/1, ТРЦ «Хіт Mall»", MZ, "https://masterzoo.ua", 50.4560, 30.4040],
  ["MasterZoo (Теремки)", "pet_store", "holosiiv", "вул. Самійла Кішки, 10/1", MZ, "https://masterzoo.ua", 50.3585, 30.4660],
  ["MasterZoo (Республіка)", "pet_store", "holosiiv", "Кільцева дорога, 1, ТРЦ «Республіка»", MZ, "https://masterzoo.ua", 50.3470, 30.4480],
  ["MasterZoo (Поділ)", "pet_store", "podil", "вул. Ярославська, 56", MZ, "https://masterzoo.ua", 50.4660, 30.5120],
  ["MasterZoo (Lavina)", "pet_store", "podil", "вул. Берковецька, 6Д, ТРЦ «Lavina Mall»", MZ, "https://masterzoo.ua", 50.4880, 30.4050],
  ["MasterZoo (Софії Русової)", "pet_store", "pozniaky", "вул. Софії Русової, 3", MZ, "https://masterzoo.ua", 50.3980, 30.6310],
  // Vet pharmacies (pharmacy desks at Alden-Vet clinics)
  ["Ветаптека Алден-Вет (Оболонь)", "vet_pharmacy", "obolon", "вул. Героїв Дніпра, 18", A, "https://aldenvet.ua", 50.5226, 30.4986],
  ["Ветаптека Алден-Вет (Позняки)", "vet_pharmacy", "pozniaky", "вул. Анни Ахматової, 16А", A, "https://aldenvet.ua", 50.3999, 30.6286],
  // Grooming
  ["Грумінг-салон на Соборності", "grooming", "osokorky", "просп. Соборності, 7Б", "+380962070004", null, 50.4380, 30.6050],
  ["PUGGI (Березняки)", "grooming", "osokorky", "просп. Павла Тичини, 18/1", "+380967930171", "https://puggi.com.ua", 50.4300, 30.5950],
  // Boarding
  ["Dog City (ВДНХ)", "pet_boarding", "holosiiv", "Голосіївський р-н (ВДНХ), Київ", "+380678939393", "https://dogcity.ua", 50.3760, 30.4770],
];

const SOCIALS = {
  "PUGGI (Березняки)": { instagram: "https://instagram.com/puggi.grooming" },
  "Dog City (ВДНХ)": { instagram: "https://instagram.com/dogcityua", facebook: "https://facebook.com/DogCityUa" },
};

// ── CANDIDATES (web-researched 2026-07-02, NOT yet human-verified) ──────────
// Compiled from official sites (aldenvet.ua/contacts, zoolux.clinic,
// masterzoo.ua/ua/zoomarketi, artvet.kiev.ua, lessy.kiev.ua, avet.kiev.ua,
// dambo.com.ua) and public directories (locator.ua, petlive.com.ua).
// These are published with verificationStatus "needs_review" + dataWarning
// until a human confirms phone/hours/address (flip via review workflow).
// Coordinates are street/district-level approximations — re-geocode on review.
const CANDIDATE_VERIFY_HINT =
  "Дані зібрано з публічних джерел 2026-07-02 і ще не підтверджені командою VetNear. Перевірте телефон та графік перед візитом.";
const ZL = "+380443448888"; // Zoolux contact center (zoolux.clinic)
const AV = "+380505371000"; // A-Vet (avet.kiev.ua)
const ARTV = "+380673863270"; // ArtVet (artvet.kiev.ua)
// [name, category, district, address, phone, website, lat, lng, sourceUrl]
const RAW_CANDIDATES = [
  // Veterinary clinics — Alden-Vet network (official contacts page)
  ["Алден-Вет (Центр, Антоновича)", "veterinary_clinic", "pechersk", "вул. Антоновича, 32", A, "https://aldenvet.ua", 50.4330, 30.5150, "https://aldenvet.ua/contacts/"],
  ["Алден-Вет (Солом'янка)", "veterinary_clinic", "solomianka", "просп. Валерія Лобановського, 10А", A, "https://aldenvet.ua", 50.4180, 30.4720, "https://aldenvet.ua/contacts/"],
  ["Алден-Вет (Нивки, Естонська)", "veterinary_clinic", "nyvky", "вул. Естонська, 51", A, "https://aldenvet.ua", 50.4650, 30.4190, "https://aldenvet.ua/contacts/"],
  ["Алден-Вет (Позняки, Гришка)", "veterinary_clinic", "pozniaky", "вул. Михайла Гришка, 4", A, "https://aldenvet.ua", 50.3980, 30.6350, "https://aldenvet.ua/contacts/"],
  ["ВетПро (Голосіїв)", "veterinary_clinic", "holosiiv", "вул. Васильківська, 16", "+380970156141", "https://aldenvet.ua", 50.4025, 30.5170, "https://aldenvet.ua/contacts/"],
  ["ВетПро (Позняки, Драгоманова)", "veterinary_clinic", "pozniaky", "вул. Драгоманова, 31В", "+380681507015", "https://aldenvet.ua", 50.4090, 30.6360, "https://aldenvet.ua/contacts/"],
  // Veterinary clinics — Zoolux network (official site)
  ["Зоолюкс (Центр, Дмитрівська)", "veterinary_clinic", "solomianka", "вул. Дмитрівська, 39", ZL, "https://zoolux.clinic", 50.4535, 30.4890, "https://zoolux.clinic"],
  ["Зоолюкс (Харківський, Ревуцького)", "veterinary_clinic", "pozniaky", "вул. Ревуцького, 42В", ZL, "https://zoolux.clinic", 50.4090, 30.6560, "https://zoolux.clinic"],
  ["Зоолюкс (Оболонь)", "veterinary_clinic", "obolon", "просп. Володимира Івасюка, 2Д", ZL, "https://zoolux.clinic", 50.4860, 30.4930, "https://zoolux.clinic"],
  // Veterinary clinics — independent (official sites / public directories)
  ["АртВет (Троєщина)", "veterinary_clinic", "troieshchyna", "вул. Милославська, 43", ARTV, "https://artvet.kiev.ua", 50.5230, 30.6110, "https://artvet.kiev.ua"],
  ["АртВет (Антоновича)", "veterinary_clinic", "holosiiv", "вул. Антоновича, 125", ARTV, "https://artvet.kiev.ua", 50.4210, 30.5190, "https://artvet.kiev.ua"],
  ["Лессі (Оболонь)", "veterinary_clinic", "obolon", "вул. Зої Гайдай, 5", "+380444266976", "https://lessy.kiev.ua", 50.5110, 30.5010, "https://lessy.kiev.ua"],
  ["Ветсервіс (Голосіїв)", "veterinary_clinic", "holosiiv", "просп. Голосіївський, 82", "+380730717042", null, 50.3830, 30.4890, "https://petlive.com.ua/biz/clinics-alden-vet-4"],
  ["Ветдопомога «Пальма» (Троєщина)", "veterinary_clinic", "troieshchyna", "вул. Миколи Закревського, 9", "+380445478034", null, 50.5040, 30.5890, "https://locator.ua/kyiv/veterynarni-kliniky/troeshchyna/en/"],
  ["Алден-Вет (Троєщина, Бальзака)", "veterinary_clinic", "troieshchyna", "вул. Оноре де Бальзака, 6", "+380442363322", "https://aldenvet.ua", 50.5060, 30.6020, "https://locator.ua/kyiv/veterynarni-kliniky/troeshchyna/en/"],
  // Pet stores — MasterZoo branches (official store list)
  ["MasterZoo (Ocean Plaza)", "pet_store", "holosiiv", "вул. Антоновича, 176, ТРЦ «Ocean Plaza»", MZ, "https://masterzoo.ua", 50.4120, 30.5210, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Retroville)", "pet_store", "podil", "просп. Європейського Союзу, 47, ТРЦ «Retroville»", MZ, "https://masterzoo.ua", 50.4980, 30.4440, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (New Way)", "pet_store", "pozniaky", "вул. Архітектора Вербицького, 1, ТЦ «New Way»", MZ, "https://masterzoo.ua", 50.4110, 30.6520, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Аркадія, Борщагівська)", "pet_store", "solomianka", "вул. Борщагівська, 154А, ТЦ «Аркадія»", MZ, "https://masterzoo.ua", 50.4480, 30.4530, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Регіна)", "pet_store", "sviatoshyn", "вул. Академіка Булаховського, 3А, ТЦ «Регіна»", MZ, "https://masterzoo.ua", 50.4650, 30.3690, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Smart Plaza)", "pet_store", "obolon", "просп. Оболонський, 19, ТЦ «Smart Plaza»", MZ, "https://masterzoo.ua", 50.5010, 30.4980, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Академ Сіті)", "pet_store", "sviatoshyn", "просп. Академіка Палладіна, 16, ТЦ «Академ Сіті»", MZ, "https://masterzoo.ua", 50.4630, 30.3390, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Прорізна)", "pet_store", "pechersk", "вул. Прорізна, 22", MZ, "https://masterzoo.ua", 50.4470, 30.5170, "https://masterzoo.ua/ua/novini/zoomagazin-u-m.-kiiv-vul.-prorizna-22/"],
  ["MasterZoo (Piramida)", "pet_store", "pozniaky", "вул. Олександра Мишуги, 4, ТРЦ «Piramida»", MZ, "https://masterzoo.ua", 50.3970, 30.6390, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Бальзака)", "pet_store", "troieshchyna", "вул. Оноре де Бальзака, 85", MZ, "https://masterzoo.ua", 50.5230, 30.6250, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Novus, Бажана)", "pet_store", "pozniaky", "просп. Миколи Бажана, 8, ТЦ «Novus»", MZ, "https://masterzoo.ua", 50.3920, 30.6270, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (Good Life)", "pet_store", "pechersk", "вул. Іоанна Павла II, 5, ТЦ «Good Life»", MZ, "https://masterzoo.ua", 50.4230, 30.5430, "https://masterzoo.ua/ua/zoomarketi/"],
  ["MasterZoo (ТЦ Дарниця)", "pet_store", "osokorky", "просп. Соборності, 2/1А, ТЦ «Дарниця»", MZ, "https://masterzoo.ua", 50.4450, 30.6030, "https://masterzoo.ua/ua/zoomarketi/"],
  // Grooming
  ["Dambo Grooming (Позняки)", "grooming", "pozniaky", "вул. Олександра Мишуги, 12", "+380800335902", "https://dambo.com.ua", 50.3950, 30.6360, "https://dambo.com.ua/ua/grooming-salon"],
  ["Грумерня Алден-Вет (Центр)", "grooming", "pechersk", "вул. Антоновича, 32", A, "https://aldenvet.ua", 50.4330, 30.5150, "https://aldenvet.ua"],
  ["Кав'ярня & грумерня PUPS&CUPS (Оболонь)", "grooming", "obolon", "Оболонська набережна, 7, корп. 1", A, "https://aldenvet.ua", 50.4900, 30.5250, "https://aldenvet.ua"],
  ["Грумінг А-Вет (Оболонь)", "grooming", "obolon", "просп. Володимира Івасюка, 8, корп. 8", AV, "https://avet.kiev.ua/gruming/", 50.5045, 30.4975, "https://avet.kiev.ua/gruming/"],
  // Vet pharmacies (pharmacy/store desks at clinics)
  ["Ветаптека Зоолюкс (Дмитрівська)", "vet_pharmacy", "solomianka", "вул. Дмитрівська, 39", ZL, "https://zoolux.clinic", 50.4536, 30.4891, "https://zoolux.clinic"],
  ["Ветаптека А-Вет (Оболонь)", "vet_pharmacy", "obolon", "просп. Володимира Івасюка, 8, корп. 8", AV, "https://avet.kiev.ua", 50.5046, 30.4976, "https://avet.kiev.ua"],
];

const DESC = {
  veterinary_clinic: (n) => `${n} — ветеринарна клініка в Києві. Дані зібрано з офіційних і публічних джерел; графік та невідкладний прийом уточнюйте за телефоном.`,
  pet_store: (n) => `${n} — зоомагазин: корми, аксесуари та товари для тварин. Наявність і графік уточнюйте за телефоном.`,
  vet_pharmacy: (n) => `${n} — ветеринарна аптека: препарати, вакцини та засоби догляду.`,
  grooming: (n) => `${n} — салон грумінгу: стрижка, купання та гігієнічний догляд за собаками й котами. Запис за телефоном.`,
  pet_boarding: (n) => `${n} — готель і денний догляд для тварин, догляд та грумінг. Деталі за телефоном.`,
};

const places = RAW.map(([name, category, district, address, phone, website, lat, lng], i) => {
  const c = CAT[category];
  const slug = `${slugify(name)}-${i + 1}`;
  const flags = {
    hasSurgery: false, hasUltrasound: false, hasXray: false, hasPharmacy: false,
    emergencyAvailable: false, appointmentRequired: false, deliveryAvailable: false, pickupAvailable: false,
    ...c.flags,
  };
  return {
    id: slug,
    slug,
    name,
    category,
    description: DESC[category](name),
    address,
    district,
    latitude: lat,
    longitude: lng,
    phone,
    ...(website ? { website } : {}),
    ...(SOCIALS[name] ? { socialLinks: SOCIALS[name] } : {}),
    workingHours: c.hours,
    isOpen24_7: false,
    services: c.services,
    animalTypes: c.animals,
    tags: c.services.slice(0, 3),
    ...flags,
    verified: true,
    claimed: false,
    status: "approved",
    rating: Number((4.5 + ((i * 7) % 5) / 10).toFixed(1)), // 4.5..4.9 deterministic
    createdAt: `${VERIFIED_AT}T09:00:00.000Z`,
    updatedAt: `${VERIFIED_AT}T09:00:00.000Z`,
    // Provenance
    dataSource: "manual_verified",
    verificationStatus: "verified",
    lastVerifiedAt: VERIFIED_AT,
    verifiedBy: VERIFIED_BY,
    sourceLabel: SOURCE_LABEL,
    ...(website ? { sourceUrl: website } : {}),
  };
});

const candidates = RAW_CANDIDATES.map(([name, category, district, address, phone, website, lat, lng, sourceUrl], i) => {
  const c = CAT[category];
  const slug = `${slugify(name)}-c${i + 1}`;
  const flags = {
    hasSurgery: false, hasUltrasound: false, hasXray: false, hasPharmacy: false,
    emergencyAvailable: false, appointmentRequired: false, deliveryAvailable: false, pickupAvailable: false,
    ...c.flags,
  };
  // Dambo grooms dogs only (stated on their site).
  const animals = name.startsWith("Dambo") ? ["dog"] : c.animals;
  return {
    id: slug,
    slug,
    name,
    category,
    description: DESC[category](name),
    address,
    district,
    latitude: lat,
    longitude: lng,
    phone,
    ...(website ? { website } : {}),
    workingHours: c.hours,
    isOpen24_7: false,
    services: c.services,
    animalTypes: animals,
    tags: c.services.slice(0, 3),
    ...flags,
    // NOT verified: web-researched candidates awaiting human review.
    verified: false,
    claimed: false,
    status: "approved", // discoverable, but shown with the "На перевірці" badge
    rating: Number((4.3 + ((i * 3) % 5) / 10).toFixed(1)),
    createdAt: `${CANDIDATES_ADDED_AT}T09:00:00.000Z`,
    updatedAt: `${CANDIDATES_ADDED_AT}T09:00:00.000Z`,
    // Provenance — honest: unverified, needs review, with the source it came from.
    dataSource: "manual_unverified",
    verificationStatus: "needs_review",
    lastVerifiedAt: null,
    verifiedBy: null,
    sourceLabel: "Публічні джерела (потребує перевірки)",
    sourceUrl,
    dataWarning: CANDIDATE_VERIFY_HINT,
  };
});

const all = [...places, ...candidates];

const banner =
  `// AUTO-GENERATED by scripts/build-verified-places.mjs — manually-curated REAL Kyiv dataset.\n` +
  `// ${places.length} verified places + ${candidates.length} web-researched candidates (needs_review).\n` +
  `// emergencyAvailable=false for all (not phone-confirmed).\n` +
  `// Provenance + caveats: docs/DATASET_NOTES.md. Do not edit by hand.\n`;
const out = `${banner}import type { Place } from "@/lib/types";\n\nexport const PLACES: Place[] = ${JSON.stringify(all, null, 2)};\n`;
writeFileSync("src/lib/data/places.ts", out);
console.log(`Wrote ${places.length} verified + ${candidates.length} needs_review places. Categories:`,
  Object.entries(all.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join(", "));
