import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/data/places";
import { hasRecordedPhoneConfirmation } from "@/lib/data/phoneConfirmation";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { isPublicEmergencyVisible } from "@/lib/data/verification";

interface SourceRecord {
  id: string;
  sourceUrl: string;
  sourceCheckedAt: string;
  coordinateSourceUrl: string;
  coordinateMethod: string;
  latitude: number;
  longitude: number;
  region: string;
  locality: string;
  workingHours: unknown[];
  hoursSourceUrl?: string;
  hoursUnknownReason?: string;
  services: string[];
  serviceSourceUrls: string[];
}

const batch = JSON.parse(readFileSync("scripts/data/catalog-expansion-v1-32.json", "utf8")) as {
  checkedAt: string;
  records: SourceRecord[];
};
const additions = PLACES.filter((place) => batch.records.some((record) => record.id === place.id));

describe("v1.32 catalog evidence", () => {
  it("publishes the complete researched batch with source and coordinate provenance", () => {
    expect(additions).toHaveLength(batch.records.length);
    expect(additions.length).toBeGreaterThanOrEqual(15);
    for (const record of batch.records) {
      const place = additions.find((item) => item.id === record.id)!;
      expect(new URL(record.sourceUrl).protocol, record.id).toBe("https:");
      expect(new URL(record.coordinateSourceUrl).protocol, record.id).toBe("https:");
      expect(record.coordinateMethod, record.id).toMatch(/^(official_|address_)/);
      expect(record.sourceCheckedAt, record.id).toBe(batch.checkedAt);
      expect(place.latitude, record.id).toBe(record.latitude);
      expect(place.longitude, record.id).toBe(record.longitude);
      expect(place.sourceUrl, record.id).toBe(record.sourceUrl);
      expect(isSearchablePublicPlace(place), record.id).toBe(true);
    }
  });

  it("keeps online checks separate from emergency and phone confirmation", () => {
    for (const place of additions) {
      expect(place.verificationStatus, place.id).toBe("source_checked");
      expect(place.dataSource, place.id).toBe("manual_unverified");
      expect(place.verified, place.id).toBe(false);
      expect(place.emergencyAvailable, place.id).toBe(false);
      expect(hasRecordedPhoneConfirmation(place), place.id).toBe(false);
      expect(place.rating, place.id).toBe(0);
      expect(place.dataWarning, place.id).toContain("дзвінка не було");
      if (place.isOpen24_7) expect(isPublicEmergencyVisible(place), place.id).toBe(false);
    }
  });

  it("requires evidence for published hours and preserves unknown or conflicting hours", () => {
    for (const record of batch.records) {
      if (record.workingHours.length) expect(record.hoursSourceUrl, record.id).toBeTruthy();
      else expect(record.hoursUnknownReason, record.id).toBeTruthy();
      if (record.services.length) expect(record.serviceSourceUrls.length, record.id).toBeGreaterThan(0);
    }
    expect(additions.find((place) => place.id === "vetnova-humennoi")?.workingHours).toEqual([]);
    expect(additions.find((place) => place.id === "vet-plus-irpin")?.workingHours).toEqual([]);
    expect(additions.find((place) => place.id === "neurocare-hnata-yury")?.workingHours).toEqual([]);
    expect(additions.find((place) => place.id === "aybolit-stusa-bila-tserkva")?.hasSurgery).toBe(false);
  });

  it("keeps oblast localities distinct from Kyiv districts", () => {
    const oblast = additions.filter((place) => place.region === "kyiv_oblast");
    expect(new Set(oblast.map((place) => place.locality)).size).toBeGreaterThanOrEqual(7);
    for (const place of oblast) {
      expect(place.locality, place.id).toBeTruthy();
      expect(place.district, place.id).toBeUndefined();
      expect(place.countryCode, place.id).toBe("UA");
      expect(place.timeZone, place.id).toBe("Europe/Kyiv");
    }
    expect(oblast.some((place) => place.latitude < 50)).toBe(true);
    expect(oblast.some((place) => place.latitude > 50.8)).toBe(true);
  });

  it("does not duplicate an existing provider at the same address", () => {
    const normalize = (value: string) => value.toLocaleLowerCase("uk").replace(/[\s.,'’ʼ«»()\-]/g, "");
    for (const place of additions) {
      const peers = PLACES.filter((item) => item.id !== place.id &&
        (item.locality ?? "Київ") === place.locality &&
        normalize(item.address) === normalize(place.address));
      expect(peers.some((item) => item.phone === place.phone ||
        (item.website && new URL(item.website).hostname === new URL(place.website!).hostname)), place.id).toBe(false);
    }
  });

  it("does not synthesize ratings or infer legacy hours and capabilities from categories", () => {
    for (const place of PLACES) expect(place.rating, place.id).toBe(0);
    const legacy = PLACES.filter((place) => !batch.records.some((record) => record.id === place.id));
    const documentedMedical = (place: typeof legacy[number]) =>
      place.name === "MAVET Clinic & Groom" || place.name === "А-Вет (Оболонь)" ||
      place.alertPolicy === "municipal_severity_based";
    for (const place of legacy) {
      const pharmacy = place.name === "Ветаптека А-Вет (Оболонь)";
      if (!documentedMedical(place) && !pharmacy) {
        expect(place.workingHours, place.id).toEqual([]);
        expect(place.services, place.id).toEqual([]);
        expect(place.hasSurgery, place.id).toBe(false);
        expect(place.hasUltrasound, place.id).toBe(false);
        expect(place.hasXray, place.id).toBe(false);
        expect(place.hasPharmacy, place.id).toBe(false);
      }
      expect(place.deliveryAvailable, place.id).toBe(false);
      expect(place.pickupAvailable, place.id).toBe(false);
    }
    expect(legacy.find((place) => place.name === "MAVET Clinic & Groom")?.workingHours).toHaveLength(7);
    expect(legacy.find((place) => place.name === "А-Вет (Оболонь)")?.nightDoctorOnSite).toBe(true);
    expect(legacy.find((place) => place.name === "Ветаптека А-Вет (Оболонь)")?.isOpen24_7).toBe(true);
    expect(legacy.find((place) => place.name.startsWith("Dambo"))?.animalTypes).toEqual(["dog"]);
  });
});
