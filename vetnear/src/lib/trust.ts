// Trust badge derivation (Module 4).
import { getOpenNowStatus } from "@/lib/distance";
import type { Place, TrustBadge } from "@/lib/types";

const RECENT_DAYS = 45;
const STALE_DAYS = 180;

export function computeBadges(place: Place, now: Date = new Date()): TrustBadge[] {
  const badges: TrustBadge[] = [];
  if (place.verified) badges.push("verified");
  if (place.claimed) badges.push("partner");
  const updated = new Date(place.updatedAt).getTime();
  const ageDays = (now.getTime() - updated) / 86_400_000;
  if (ageDays <= RECENT_DAYS) badges.push("updated_recently");
  if (ageDays >= STALE_DAYS) badges.push("data_outdated");
  if (place.emergencyAvailable || place.isOpen24_7) badges.push("emergency");
  if (getOpenNowStatus(place, now)) badges.push("open_now");
  if (!place.claimed) badges.push("free");
  return badges;
}
