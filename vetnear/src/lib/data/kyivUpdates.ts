import type { PlaceRegion } from "@/lib/types";

export const KYIV_UPDATES_AS_OF = "2026-11-17";
export const KYIV_EVENTS_TIMEZONE = "Europe/Kyiv";
export const EVENT_CATEGORIES = ["vaccination", "adoption", "event", "opportunity"] as const;
export type KyivEventCategory = (typeof EVENT_CATEGORIES)[number];
export type KyivEventStatus = "upcoming" | "ongoing" | "expired" | "needs_confirmation";
export type KyivEventScope = "current" | "archive" | "saved" | "following";
export const EVENT_CATEGORY_LABELS: Record<KyivEventCategory, string> = {
  vaccination: "Вакцинація", adoption: "Адопція", event: "Події", opportunity: "Можливості",
};
export const EVENT_STATUS_LABELS: Record<KyivEventStatus, string> = {
  upcoming: "Заплановано", ongoing: "Постійна можливість", expired: "Дата минула", needs_confirmation: "Уточніть умови",
};
export interface KyivEventSource { label: string; url: string; publishedAt?: string; }
export interface KyivEvent {
  id: string;
  category: KyivEventCategory;
  title: string;
  summary: string;
  region: PlaceRegion;
  locality: string;
  venue: string;
  schedule: { kind: "ongoing"; label: string } | { kind: "date"; startDate: string; endDate: string; label: string; datesConfirmed: boolean } | { kind: "unannounced"; label: string };
  confirmation: "source_confirmed" | "needs_confirmation";
  cost: "free" | "check";
  eligibility: string;
  action: string;
  sources: KyivEventSource[];
  lastCheckedAt: string;
  reviewAfter: string;
}

/** Editorial snapshot, not a live event feed. Source checks are not phone confirmations. */
export const KYIV_EVENTS: KyivEvent[] = [
  {
    id: "kyiv-rabies-vaccination", category: "vaccination", title: "Щеплення від сказу без оплати за вакцину",
    summary: "Державні ветлікарні Києва проводять безоплатну вакцинацію проти сказу. Знайдіть свій заклад в офіційному переліку та погодьте прийом.",
    region: "kyiv_city", locality: "Київ", venue: "Державні ветеринарні лікарні міста",
    schedule: { kind: "ongoing", label: "За попереднім записом" }, confirmation: "source_confirmed", cost: "free",
    eligibility: "Домашні тварини. Вид тварини, допуск до щеплення, наявність вакцини й супутні послуги уточніть у лікарні.",
    action: "Адреси та телефони лікарень",
    sources: [
      { label: "ОВМ · державні лікарні Києва", url: "https://ovm.gov.ua/index.php/derzhavni-veterynarni-kliniky-v-m-kyiv" },
      { label: "ОВМ · про безоплатну вакцинацію", url: "https://ovm.gov.ua/index.php/1304-skaz-nebezpeka-pro-yaku-varto-pam-yatati", publishedAt: "2026-05-19" },
    ], lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-12-17",
  },
  {
    id: "oblast-rabies-vaccination", category: "vaccination", title: "Безоплатна вакцина проти сказу на Київщині",
    summary: "Обласна ветслужба публікує контакти державних лікарень. Зателефонуйте до найближчої установи: виїзний пункт або прийом сьогодні без підтвердження не обіцяємо.",
    region: "kyiv_oblast", locality: "Київська область", venue: "Державні лікарні та дільниці за переліком області",
    schedule: { kind: "ongoing", label: "Дату прийому погодьте з лікарнею" }, confirmation: "source_confirmed", cost: "free",
    eligibility: "Для власників домашніх тварин. Наявність вакцини, вид тварини та умови прийому підтверджує конкретна установа.",
    action: "Знайти державну лікарню",
    sources: [
      { label: "Держпродспоживслужба Київщини · установи", url: "https://dpssko.gov.ua/структура/підпорядковані-установи-лабораторі/" },
      { label: "Держпродспоживслужба · безоплатна вакцина", url: "https://dpss.gov.ua/news/28-veresnia-vsesvitnii-den-borotby-zi-skazom-shcho-potribno-znaty-shchob-zakhystyty-sebe-i-tvaryn", publishedAt: "2026-09-28" },
    ], lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-12-17",
  },
  {
    id: "gostomel-adoption", category: "adoption", title: "Друг чекає у Гостомелі",
    summary: "Перегляньте тварин Gostomel Shelter та домовтеся про знайомство з командою. Анкета на сайті — перший крок до адопції.",
    region: "kyiv_oblast", locality: "Гостомель", venue: "Gostomel Shelter · місце зустрічі погодьте з командою",
    schedule: { kind: "ongoing", label: "Знайомство за домовленістю" }, confirmation: "source_confirmed", cost: "check",
    eligibility: "Майбутні власники тварин. Наявність конкретної тварини та умови адопції підтверджує притулок.",
    action: "Познайомитися з тваринами",
    sources: [
      { label: "Gostomel Shelter · хочу друга", url: "https://www.gostomelshelter.com/hochu-druga" },
      { label: "Контакти притулку", url: "https://www.gostomelshelter.com/ua-contacts" },
    ], lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-12-17",
  },
  {
    id: "sirius-visits", category: "adoption", title: "Знайомство та прогулянка у «Сіріусі»",
    summary: "Притулок у Федорівці публікує години відвідування у вихідні: 11:00–16:00. Перед дорогою зв’яжіться з командою та прочитайте правила.",
    region: "kyiv_oblast", locality: "Федорівка, Вишгородський район", venue: "Притулок «Сіріус»",
    schedule: { kind: "ongoing", label: "Сб–Нд, 11:00–16:00 · погодьте візит" }, confirmation: "source_confirmed", cost: "check",
    eligibility: "Відвідування, знайомство з тваринами й адопція — за правилами притулку. Перед поїздкою перевірте можливість прийому.",
    action: "Правила відвідування",
    sources: [
      { label: "«Сіріус» · правила візиту", url: "https://dogcat.com.ua/visiting-rules" },
      { label: "«Сіріус» · контакти й години", url: "https://dogcat.com.ua/contacts" },
    ], lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-12-17",
  },
  {
    id: "ukc-pinscher-november", category: "event", title: "Племінний огляд цвергпінчерів",
    summary: "Кінологічний клуб України вказує цю дату в календарі 2026 року. Час, точну адресу, реєстрацію та проведення потрібно підтвердити в організатора.",
    region: "kyiv_city", locality: "Київ", venue: "Адресу організатор має уточнити",
    schedule: { kind: "date", startDate: "2026-11-28", endDate: "2026-11-28", label: "28 листопада 2026 · час не підтверджено", datesConfirmed: true },
    confirmation: "needs_confirmation", cost: "check", eligibility: "Для власників цвергпінчерів. Допуск, документи та вартість участі уточнюйте в ККУ.",
    action: "Календар і контакти організатора", sources: [{ label: "Кінологічний клуб України · календар 2026", url: "https://ukc.org.ua/vistavki/" }],
    lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-11-24",
  },
  {
    id: "ukc-labrador-november", category: "event", title: "Племінний огляд лабрадорів",
    summary: "Дата заявлена в календарі ККУ. У доступному анонсі немає точної локації й часу — перевірте деталі до реєстрації та поїздки.",
    region: "kyiv_city", locality: "Київ", venue: "Адресу організатор має уточнити",
    schedule: { kind: "date", startDate: "2026-11-29", endDate: "2026-11-29", label: "29 листопада 2026 · час не підтверджено", datesConfirmed: true },
    confirmation: "needs_confirmation", cost: "check", eligibility: "Для власників лабрадорів. Правила участі й оплату уточнюйте в ККУ.",
    action: "Календар і контакти організатора", sources: [{ label: "Кінологічний клуб України · календар 2026", url: "https://ukc.org.ua/vistavki/" }],
    lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-11-24",
  },
  {
    id: "adoptme-next-date", category: "event", title: "Наступний AdoptMe Days: чекаємо на дату",
    summary: "Організатор описує фестиваль адопції, але нову дату в перевіреному джерелі не оголошено. Попередні фотозвіти не є анонсом наступного заходу.",
    region: "kyiv_city", locality: "Київ · наступна локація не оголошена", venue: "AdoptMe Days",
    schedule: { kind: "unannounced", label: "Наступну дату не підтверджено" }, confirmation: "needs_confirmation", cost: "check",
    eligibility: "Для майбутніх власників та друзів притулків. Деталі нового заходу очікуються від організатора.",
    action: "Перевірити сторінку організатора", sources: [{ label: "Gostomel Shelter · AdoptMe Days", url: "https://www.gostomelshelter.com/adopt-me-days" }],
    lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-11-24",
  },
  {
    id: "city-lost-found-register", category: "opportunity", title: "Пошук тварини через міський реєстр",
    summary: "Перевірте офіційні оголошення про загублених і знайдених тварин або подайте своє повідомлення на модерацію. Особисті контакти залишаються в першоджерелі.",
    region: "kyiv_city", locality: "Київ", venue: "Онлайн · Реєстр домашніх тварин",
    schedule: { kind: "ongoing", label: "Онлайн-сервіс" }, confirmation: "source_confirmed", cost: "check",
    eligibility: "Власники та люди, які знайшли тварину. Публікацію оголошення перевіряє модератор міського сервісу.",
    action: "Відкрити міський реєстр", sources: [
      { label: "Реєстр · загублені тварини", url: "https://pets.kyivcity.gov.ua/lost-animals" },
      { label: "Реєстр · знайдені тварини", url: "https://pets.kyivcity.gov.ua/lost-animals/found" },
    ], lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-12-17",
  },
  {
    id: "obukhiv-vaccination-november", category: "vaccination", title: "Виїзні щеплення в Обухівській громаді",
    summary: "Міська рада оголошувала безоплатні щеплення собак і котів від сказу 9–13 листопада в Обухові; окремий виїзд до Григорівки — 10 листопада. Ці дати вже минули.",
    region: "kyiv_oblast", locality: "Обухів та Григорівка", venue: "Обухів, вул. Васильківська, 13; Григорівка, біля сільради",
    schedule: { kind: "date", startDate: "2026-11-09", endDate: "2026-11-13", label: "9–13 листопада 2026", datesConfirmed: true },
    confirmation: "source_confirmed", cost: "free", eligibility: "Архів оголошення. Новий прийом або наступну виїзну акцію уточнюйте окремо.",
    action: "Прочитати початкове оголошення", sources: [{ label: "Обухівська міська рада", url: "https://obcity.gov.ua/2026/11/04/uvaga-bezkoshtovne-shheplennya-domashnikh-tvarin-proti-skazu-v-obukhivskiy-gromadi/", publishedAt: "2026-11-04" }],
    lastCheckedAt: KYIV_UPDATES_AS_OF, reviewAfter: "2026-11-17",
  },
];

export function kyivCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: KYIV_EVENTS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function eventStatus(event: KyivEvent, now = new Date()): KyivEventStatus {
  if (!validDate(event.reviewAfter) || !validDate(event.lastCheckedAt)) return "needs_confirmation";
  if (event.schedule.kind === "date" && (!validDate(event.schedule.startDate) || !validDate(event.schedule.endDate) || event.schedule.endDate < event.schedule.startDate)) return "needs_confirmation";
  const today = kyivCalendarDate(now);
  if (event.schedule.kind === "date" && today > event.schedule.endDate) return "expired";
  if (event.confirmation === "needs_confirmation" || event.schedule.kind === "unannounced" || today > event.reviewAfter) return "needs_confirmation";
  if (event.schedule.kind === "date" && !event.schedule.datesConfirmed) return "needs_confirmation";
  return event.schedule.kind === "date" && today < event.schedule.startDate ? "upcoming" : "ongoing";
}

export function eventStatusLabel(event: KyivEvent, now = new Date()): string {
  const status = eventStatus(event, now);
  return status === "ongoing" && event.schedule.kind === "date" ? "Триває" : EVENT_STATUS_LABELS[status];
}

export function filterKyivEvents(events: KyivEvent[], filters: {
  category?: KyivEventCategory | "all"; region?: PlaceRegion | "all"; scope?: KyivEventScope;
  savedIds?: string[]; followedCategories?: KyivEventCategory[];
}, now = new Date()): KyivEvent[] {
  const scope = filters.scope ?? "current";
  return events.filter((event) => {
    if (filters.category && filters.category !== "all" && event.category !== filters.category) return false;
    if (filters.region && filters.region !== "all" && event.region !== filters.region) return false;
    const expired = eventStatus(event, now) === "expired";
    if (scope === "archive") return expired;
    if (scope === "saved") return filters.savedIds?.includes(event.id) ?? false;
    if (expired) return false;
    if (scope === "following") return filters.followedCategories?.includes(event.category) ?? false;
    return true;
  });
}

export function isCalendarEligible(event: KyivEvent, now = new Date()): boolean {
  const state = eventStatus(event, now);
  return event.schedule.kind === "date" && event.schedule.datesConfirmed && (state === "upcoming" || state === "ongoing");
}

/** Only explicit, confirmed all-day dates; unknown times are never invented. */
export function buildEventCalendar(event: KyivEvent, now = new Date()): string | null {
  if (!isCalendarEligible(event, now) || event.schedule.kind !== "date") return null;
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const end = new Date(`${event.schedule.endDate}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VetNear//Kyiv events//UK", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${event.id}@vetnear`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${event.schedule.startDate.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
    `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(`${event.locality}, ${event.venue}`)}`,
    `DESCRIPTION:${escape(`${event.summary}\nПеред поїздкою перевірте умови в організатора.\n${event.sources[0].url}`)}`, "END:VEVENT", "END:VCALENDAR"];
  // RFC 5545 lines fold at 75 UTF-8 octets, not 75 JavaScript characters.
  const fold = (line: string) => {
    const chunks: string[] = []; let chunk = ""; let bytes = 0;
    for (const character of line) {
      const size = new TextEncoder().encode(character).length;
      if (bytes + size > 75) { chunks.push(chunk); chunk = " "; bytes = 1; }
      chunk += character; bytes += size;
    }
    chunks.push(chunk); return chunks.join("\r\n");
  };
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
