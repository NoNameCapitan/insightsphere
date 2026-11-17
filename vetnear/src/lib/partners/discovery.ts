import type { Place } from "@/lib/types";

export type PartnerPlaceSummary = Pick<Place, "id" | "slug" | "name" | "address" | "phone" | "locality" | "category">;
const normalize = (value: string) => value.toLocaleLowerCase("uk-UA").normalize("NFKC").replace(/[ʼ’'`]/g, "").replace(/\s+/g, " ").trim();
const digits = (value: string) => value.replace(/\D/g, "").slice(-9);

/** Phone or meaningful name/address tokens; category alone is not a match. */
export function findPartnerPlaces(places: PartnerPlaceSummary[], query: string): PartnerPlaceSummary[] {
  const q = normalize(query);
  if (q.length < 3) return [];
  const phone = digits(query);
  const tokens = q.split(" ").filter(Boolean);
  return places.filter(place => {
    if (phone.length >= 7 && digits(place.phone).endsWith(phone)) return true;
    const content = normalize(`${place.name} ${place.address} ${place.locality ?? ""}`);
    return tokens.every(token => content.includes(token));
  }).slice(0, 5);
}
