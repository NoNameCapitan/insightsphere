// Built-in coordinates for Ukrainian cities (no paid Geocoding API needed).
// `radiusKm` is an approximate "whole city" radius used when the user searches
// a city without choosing an explicit radius. `forms` are lowercase word forms
// (incl. common declensions and Russian/Latin spellings) matched at word start.

import type { GeoPoint } from "./geo";

export type CityEntry = {
  name: string;
  point: GeoPoint;
  radiusKm: number;
  forms: string[];
};

export const UA_CITIES: CityEntry[] = [
  {
    name: "Київ",
    point: { lat: 50.4501, lng: 30.5234 },
    radiusKm: 20,
    forms: ["київ", "києві", "києва", "киев", "киеве", "kyiv", "kiev"],
  },
  {
    name: "Львів",
    point: { lat: 49.8397, lng: 24.0297 },
    radiusKm: 10,
    forms: ["львів", "львові", "львова", "львов", "львове", "lviv"],
  },
  {
    name: "Одеса",
    point: { lat: 46.4825, lng: 30.7233 },
    radiusKm: 14,
    forms: ["одеса", "одесі", "одеси", "одесса", "одессе", "odesa", "odessa"],
  },
  {
    name: "Харків",
    point: { lat: 49.9935, lng: 36.2304 },
    radiusKm: 15,
    forms: ["харків", "харкові", "харкова", "харьков", "харькове", "kharkiv"],
  },
  {
    name: "Дніпро",
    point: { lat: 48.4647, lng: 35.0462 },
    radiusKm: 15,
    forms: ["дніпро", "дніпрі", "дніпра", "днепр", "днепре", "dnipro"],
  },
  {
    name: "Запоріжжя",
    point: { lat: 47.8388, lng: 35.1396 },
    radiusKm: 13,
    forms: ["запоріжжя", "запоріжжі", "запоріжжю", "запорожье", "zaporizhzhia"],
  },
  {
    name: "Вінниця",
    point: { lat: 49.2331, lng: 28.4682 },
    radiusKm: 9,
    forms: ["вінниця", "вінниці", "винница", "виннице", "vinnytsia"],
  },
  {
    name: "Полтава",
    point: { lat: 49.5883, lng: 34.5514 },
    radiusKm: 8,
    forms: ["полтава", "полтаві", "полтави", "полтаве", "poltava"],
  },
  {
    name: "Чернігів",
    point: { lat: 51.4982, lng: 31.2893 },
    radiusKm: 8,
    forms: ["чернігів", "чернігові", "чернігова", "чернигов", "чернигове", "chernihiv"],
  },
  {
    name: "Черкаси",
    point: { lat: 49.4444, lng: 32.0598 },
    radiusKm: 9,
    forms: ["черкаси", "черкасах", "черкассы", "черкассах", "cherkasy"],
  },
  {
    name: "Житомир",
    point: { lat: 50.2547, lng: 28.6587 },
    radiusKm: 8,
    forms: ["житомир", "житомирі", "житомира", "житомире", "zhytomyr"],
  },
  {
    name: "Суми",
    point: { lat: 50.9077, lng: 34.7981 },
    radiusKm: 8,
    forms: ["суми", "сумах", "сумы", "sumy"],
  },
  {
    name: "Рівне",
    point: { lat: 50.6199, lng: 26.2516 },
    radiusKm: 7,
    forms: ["рівне", "рівному", "ровно", "ровном", "rivne"],
  },
  {
    name: "Івано-Франківськ",
    point: { lat: 48.9226, lng: 24.7111 },
    radiusKm: 7,
    forms: ["івано-франківськ", "івано-франківську", "ивано-франковск", "ivano-frankivsk", "франківськ", "франківську"],
  },
  {
    name: "Тернопіль",
    point: { lat: 49.5535, lng: 25.5948 },
    radiusKm: 7,
    forms: ["тернопіль", "тернополі", "тернополя", "тернополь", "ternopil"],
  },
  {
    name: "Луцьк",
    point: { lat: 50.7472, lng: 25.3254 },
    radiusKm: 7,
    forms: ["луцьк", "луцьку", "луцка", "луцк", "луцке", "lutsk"],
  },
  {
    name: "Ужгород",
    point: { lat: 48.6208, lng: 22.2879 },
    radiusKm: 6,
    forms: ["ужгород", "ужгороді", "ужгорода", "ужгороде", "uzhhorod"],
  },
  {
    name: "Хмельницький",
    point: { lat: 49.4229, lng: 26.9871 },
    radiusKm: 8,
    forms: ["хмельницький", "хмельницькому", "хмельницкий", "khmelnytskyi"],
  },
  {
    name: "Чернівці",
    point: { lat: 48.2915, lng: 25.9403 },
    radiusKm: 8,
    forms: ["чернівці", "чернівцях", "черновцы", "черновцах", "chernivtsi"],
  },
  {
    name: "Миколаїв",
    point: { lat: 46.975, lng: 31.9946 },
    radiusKm: 11,
    forms: ["миколаїв", "миколаєві", "миколаєва", "николаев", "николаеве", "mykolaiv"],
  },
  {
    name: "Кропивницький",
    point: { lat: 48.5079, lng: 32.2623 },
    radiusKm: 8,
    forms: ["кропивницький", "кропивницькому", "кропивницкий", "kropyvnytskyi"],
  },
  {
    name: "Біла Церква",
    point: { lat: 49.7968, lng: 30.1311 },
    radiusKm: 6,
    forms: ["біла церква", "білій церкві", "білої церкви", "белая церковь", "bila tserkva"],
  },
  {
    name: "Бровари",
    point: { lat: 50.5111, lng: 30.7909 },
    radiusKm: 5,
    forms: ["бровари", "броварах", "бровары", "brovary"],
  },
  {
    name: "Ірпінь",
    point: { lat: 50.5218, lng: 30.2506 },
    radiusKm: 5,
    forms: ["ірпінь", "ірпені", "ірпеня", "ирпень", "irpin"],
  },
];

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches a whole word/phrase so "суми" never matches "сумнів" and
// "львів" still matches inside "м. Львів, вул. ...".
function matchesForm(text: string, form: string): boolean {
  return new RegExp(`(^|[^\\p{L}'’-])${escape(form)}($|[^\\p{L}])`, "u").test(
    text,
  );
}

export function findCityInText(text: string | undefined): CityEntry | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const c of UA_CITIES)
    if (c.forms.some((f) => matchesForm(t, f))) return c;
  return null;
}

// Exact lookup for a value typed into the city field (case/declension tolerant).
export function findCity(name: string | undefined): CityEntry | null {
  return findCityInText(name?.trim());
}

export function isKyivName(name: string | undefined): boolean {
  return findCity(name)?.name === "Київ";
}
