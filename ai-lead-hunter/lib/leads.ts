// Assembles a complete Lead from a normalized business.
// Kept separate from scoring/places to avoid circular imports.

import { computeConfidence } from "./confidence";
import { generateOutreach } from "./outreach";
import { scoreBusiness } from "./scoring";
import type { LangCode, Lead, OfferType, RawBusiness } from "./types";
import { distanceKm, makeId } from "./utils";

const RECOMMENDED_UK: Record<OfferType, string> = {
  website:
    "Простий швидкий сайт, що перетворює перегляди в Google Maps на заявки.",
  landing: "Лендинг під одну послугу, який конвертує відвідувачів у звернення.",
  seo: "Покращення локальної видимості та оптимізація Google Business Profile.",
  chatbot: "AI-асистент, що відповідає на типові питання й збирає заявки 24/7.",
  booking: "Онлайн-запис, щоб не втрачати клієнтів через пропущені дзвінки.",
  crm: "Проста CRM, щоб не губити звернення з різних каналів.",
  smm: "Контент-пак і ведення локальних соцмереж.",
  reputation: "Система роботи з відгуками та план покращення репутації.",
  automation: "Автоматизація рутинних задач і обробки заявок.",
  custom: "Рішення під вашу конкретну задачу.",
};

export function buildLead(
  b: RawBusiness,
  offer: OfferType,
  lang: LangCode,
  origin?: { lat: number; lng: number },
): Lead {
  const { score, signals } = scoreBusiness(b, offer);

  if (b.source === "demo") {
    signals.push({
      type: "demo_data",
      label: "Демо-дані",
      severity: "low",
      evidence: "Згенерований приклад для демо-режиму, не реальний бізнес.",
    });
  }

  const outreach = generateOutreach(b.name, offer, signals, lang);

  let distance: number | undefined;
  if (origin && b.lat != null && b.lng != null) {
    distance = distanceKm(origin, { lat: b.lat, lng: b.lng });
  }

  const confidence = computeConfidence(b, { hasDistance: distance != null });

  return {
    id: makeId(),
    source: b.source,
    sourcePlaceId: b.sourcePlaceId,
    attributions: b.attributions,
    name: b.name,
    category: b.category,
    niche: b.niche,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    distanceKm: distance,
    phone: b.phone,
    website: b.website,
    googleMapsUrl:
      b.googleMapsUrl ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${b.name} ${b.address}`,
      )}`,
    rating: b.rating,
    reviewCount: b.reviewCount,
    openingHours: b.openingHours,
    isOpenNow: b.isOpenNow,
    businessStatus: b.businessStatus,
    hasWebsite: !!b.website,
    hasPhone: !!b.phone,
    websiteAnalysis: b.websiteAnalysis,
    score,
    confidence,
    signals,
    recommendedOffer: RECOMMENDED_UK[offer],
    offerType: offer,
    outreach,
    status: "new",
    verification: {},
    createdAt: new Date().toISOString(),
  };
}
