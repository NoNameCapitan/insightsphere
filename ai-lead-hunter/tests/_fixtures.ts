import { buildLead } from "../lib/leads";
import type { Lead, NicheKey, OfferType, RawBusiness } from "../lib/types";

export function makeBusiness(over: Partial<RawBusiness> = {}): RawBusiness {
  return {
    source: "demo",
    name: "Тест Бізнес",
    niche: "beauty" as NicheKey,
    category: "Салон краси",
    address: "вул. Тестова, 1, Позняки, Київ",
    lat: 50.396,
    lng: 30.631,
    phone: "+380 67 000 00 00",
    website: undefined,
    rating: 3.8,
    reviewCount: 120,
    openingHours: ["Пн: 09:00–20:00"],
    isOpenNow: true,
    businessStatus: "OPERATIONAL",
    ...over,
  };
}

export function makeLead(
  over: Partial<RawBusiness> = {},
  offer: OfferType = "booking",
): Lead {
  return buildLead(makeBusiness(over), offer, "uk", {
    lat: 50.4501,
    lng: 30.5234,
  });
}
