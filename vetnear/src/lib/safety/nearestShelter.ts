import { calculateDistance } from "@/lib/distance";
import { fetchCurrentKyivAlert, hasFreshActiveAlert, unavailableAlert } from "@/lib/safety/client";
import type { Coordinates } from "@/lib/types";
import type { KyivAlertStatus, KyivShelter } from "@/lib/safety/types";

export type ShelterRoutePhase = "checking" | "locating" | "searching";
export class ShelterRouteError extends Error {}

export function isKyivCoordinate(value: Coordinates): boolean {
  return Number.isFinite(value.latitude) && Number.isFinite(value.longitude) &&
    value.latitude >= 50.1 && value.latitude <= 50.65 &&
    value.longitude >= 30.2 && value.longitude <= 30.9;
}

/** Re-rank by distance from the fresh GPS fix, not API ordering or old storage. */
export function nearestEligibleShelter(values: unknown, origin: Coordinates): KyivShelter | null {
  if (!Array.isArray(values) || !isKyivCoordinate(origin)) return null;
  let nearest: KyivShelter | null = null;
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const item = value as KyivShelter;
    if (item.declaredOpen24h !== true || typeof item.id !== "string" ||
      typeof item.address !== "string" || !item.address.trim() || !isKyivCoordinate(item)) continue;
    const distanceMeters = calculateDistance(origin, item);
    if (distanceMeters > 10_000) continue;
    if (!nearest || distanceMeters < nearest.distanceMeters) nearest = { ...item, distanceMeters };
  }
  return nearest;
}

export function shelterWalkingRoute(shelter: Coordinates, origin?: Coordinates | null): string {
  const params = new URLSearchParams({
    api: "1", destination: `${shelter.latitude},${shelter.longitude}`, travelmode: "walking",
  });
  if (origin) params.set("origin", `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Fresh browser position only: no stored/district-centre fallback in an emergency. */
export function currentShelterLocation(signal: AbortSignal): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new ShelterRouteError("Геолокація недоступна. Скористайтеся офіційною картою укриттів."));
      return;
    }
    const abort = () => { cleanup(); reject(new DOMException("Скасовано", "AbortError")); };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new ShelterRouteError("Не вдалося визначити поточне місце. Увімкніть геолокацію та спробуйте ще раз."));
    }, 11_000);
    function cleanup() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
    signal.addEventListener("abort", abort, { once: true });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        cleanup();
        if (!signal.aborted) resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        cleanup();
        reject(new ShelterRouteError(error.code === 1
          ? "Дозвольте геолокацію в налаштуваннях браузера, щоб знайти найближче укриття."
          : "Не вдалося визначити поточне місце. Спробуйте ще раз або відкрийте офіційну карту."));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

export async function resolveNearestShelterRoute({
  signal, onPhase = () => {}, onAlertStatus = () => {}, fetcher = fetch, locate = currentShelterLocation,
}: {
  signal: AbortSignal;
  onPhase?: (phase: ShelterRoutePhase) => void;
  onAlertStatus?: (value: KyivAlertStatus) => void;
  fetcher?: typeof fetch;
  locate?: (signal: AbortSignal) => Promise<Coordinates>;
}): Promise<{ shelter: KyivShelter; origin: Coordinates; url: string }> {
  const requireAlert = async () => {
    signal.throwIfAborted();
    let alert: KyivAlertStatus;
    try { alert = await fetchCurrentKyivAlert(signal, fetcher); }
    catch (error) {
      if (!signal.aborted) onAlertStatus(unavailableAlert("Не вдалося перевірити тривогу."));
      throw error;
    }
    signal.throwIfAborted();
    onAlertStatus(alert);
    if (!hasFreshActiveAlert(alert)) throw new ShelterRouteError(alert.state === "inactive"
      ? "Тривогу вже завершено. Кнопка знову стане активною під час наступної тривоги."
      : "Актуальну тривогу не підтверджено. Перевірте офіційні сповіщення.");
  };
  onPhase("checking");
  await requireAlert();
  onPhase("locating");
  const origin = await locate(signal);
  signal.throwIfAborted();
  if (!isKyivCoordinate(origin)) throw new ShelterRouteError("Пошук укриттів наразі доступний лише в межах Києва.");
  onPhase("searching");
  const params = new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) });
  const response = await fetcher(`/api/safety/shelters?${params}`, { cache: "no-store", signal });
  if (!response.ok) throw new ShelterRouteError("Не вдалося завантажити укриття. Спробуйте ще раз або відкрийте офіційну карту.");
  const data: unknown = await response.json();
  const shelter = nearestEligibleShelter(data && typeof data === "object" && "shelters" in data ? data.shelters : null, origin);
  if (!shelter) throw new ShelterRouteError("У радіусі 10 км немає придатних записів укриттів. Перевірте офіційну карту.");
  // The alert might end while GPS permission or the shelter dataset is loading.
  onPhase("checking");
  await requireAlert();
  return { shelter, origin, url: shelterWalkingRoute(shelter, origin) };
}
