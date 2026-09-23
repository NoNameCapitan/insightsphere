// Display option lists for selects. UI labels in Ukrainian.

import { NICHES } from "./places";
import type { NicheKey, OfferType, SortKey } from "./types";

export const OFFER_OPTIONS: Array<{ value: OfferType; label: string }> = [
  { value: "website", label: "Сайт" },
  { value: "landing", label: "Лендинг" },
  { value: "seo", label: "SEO / Google Business" },
  { value: "chatbot", label: "AI-чатбот" },
  { value: "booking", label: "Онлайн-запис" },
  { value: "crm", label: "CRM" },
  { value: "smm", label: "SMM / контент" },
  { value: "reputation", label: "Репутація" },
  { value: "automation", label: "Автоматизація" },
  { value: "custom", label: "Своя пропозиція" },
];

export const NICHE_OPTIONS: Array<{ value: NicheKey; label: string }> = (
  Object.keys(NICHES) as NicheKey[]
).map((k) => ({ value: k, label: NICHES[k].labelUk }));

export const RADIUS_OPTIONS = [1, 3, 5, 10, 25];
export const LIMIT_OPTIONS = [20, 50, 100];

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "score", label: "Lead Score" },
  { value: "distance", label: "Відстань" },
  { value: "rating", label: "Рейтинг" },
  { value: "reviews", label: "Відгуки" },
  { value: "missing_website", label: "Спершу без сайту" },
];

import type { LeadVerification, OutreachChannel, OutreachTone } from "./types";

export const TONE_OPTIONS: Array<{ value: OutreachTone; label: string }> = [
  { value: "soft", label: "М'який" },
  { value: "direct", label: "Прямий" },
  { value: "professional", label: "Професійний" },
];

export const CHANNEL_OPTIONS: Array<{ value: OutreachChannel; label: string }> =
  [
    { value: "telegram", label: "Telegram/Viber/SMS" },
    { value: "instagram", label: "Instagram DM" },
    { value: "email", label: "Email" },
    { value: "call", label: "Скрипт дзвінка" },
  ];

export const VERIFICATION_FIELDS: Array<{
  key: keyof LeadVerification;
  label: string;
  danger?: boolean;
}> = [
  { key: "phoneChecked", label: "Телефон перевірено" },
  { key: "websiteChecked", label: "Сайт перевірено" },
  { key: "businessActive", label: "Бізнес активний" },
  { key: "offerFitConfirmed", label: "Пропозиція підходить" },
  { key: "contacted", label: "Зв'язались" },
  { key: "badData", label: "Погані дані", danger: true },
  { key: "doNotContact", label: "Не контактувати", danger: true },
];
