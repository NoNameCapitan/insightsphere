import type { KyivAlertStatus } from "@/lib/safety/types";
import type { Place } from "@/lib/types";

export type AlertAvailability = "normal" | "call_first" | "closed";

/**
 * Official Kyiv rule published on 2026-09-17 for the three municipal clinics:
 * yellow threat — service continues, red threat — clinic closes.
 * An unknown active level is deliberately treated as call-first, never as closed.
 */
export function availabilityDuringAlert(
  place: Pick<Place, "alertPolicy">,
  alert: KyivAlertStatus | null,
): AlertAvailability {
  if (place.alertPolicy !== "municipal_severity_based" || alert?.state !== "active") {
    return "normal";
  }
  if (alert.level === "red") return "closed";
  return "call_first";
}
