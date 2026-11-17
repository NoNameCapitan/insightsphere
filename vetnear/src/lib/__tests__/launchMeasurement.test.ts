import { describe, expect, it } from "vitest";
import { campaignCodes, measurementRoute, parseMeasurement, sanitizeCampaign, sanitizeProps, summarizeMeasurement } from "@/lib/measurement/schema";
const id = "00000000-0000-4000-8000-000000000001";
describe("launch measurement privacy boundary", () => {
  it("retains only registered campaigns and coarse sources", () => {
    expect(sanitizeCampaign({ source: "google", medium: "cpc", campaign: "kyiv-vet", term: "cat diagnosis" }, ["kyiv-vet"])).toEqual({ source: "google", medium: "cpc", campaign: "kyiv-vet" });
    expect(sanitizeCampaign({ source: "email@example.com", campaign: "owner-name", medium: "+380991234567" }, ["kyiv-vet"])).toEqual({});
    expect(campaignCodes("kyiv-vet, bad@email.com, x=y, grooming_1")).toEqual(["kyiv-vet", "grooming_1"]);
  });
  it("groups medical and user paths and strips coordinates, queries, fragments", () => {
    expect(measurementRoute("/my-pets/pet-id/records/new?condition=secret")).toBe("/my-pets");
    expect(measurementRoute("/place/public-clinic?lat=50&lon=30")).toBe("/place/[slug]");
    expect(measurementRoute("/nearby?address=private#phone")).toBe("/nearby");
    expect(measurementRoute("/private/owner-id")).toBe("/other");
    expect(measurementRoute("//evil.example")).toBe("/other");
  });
  it("drops arbitrary text, IDs of pets, exact location and medical fields", () => {
    expect(sanitizeProps({ category: "grooming", region: "kyiv_oblast", resultCount: 0, hasLocation: true, urgent: false, lat: 50, petId: "private", query: "illness", message: "secret", animalType: "cat" })).toEqual({ category: "grooming", region: "kyiv_oblast", resultCount: 0, hasLocation: true, urgent: false });
    expect(sanitizeProps({ resultCount: -1, category: "<script>", placeId: "https://x?secret" })).toEqual({});
  });
  it("rejects unsupported events and malformed session identity", () => {
    expect(parseMeasurement({ id, sessionId: id, name: "diagnosis", route: "/" })).toBeNull();
    expect(parseMeasurement({ id, sessionId: "email@example.com", name: "page_viewed" })).toBeNull();
    expect(parseMeasurement({ id, sessionId: id, name: "page_viewed", route: "/?email=private" })).toMatchObject({ route: "/", props: {}, campaign: {} });
  });
  it("counts contact sessions rather than pretending clicks are customers", () => {
    const rows = [
      { event_name: "page_viewed", session_hash: "s1", campaign: { campaign: "test" } },
      { event_name: "call_clicked", session_hash: "s1", campaign: { campaign: "test" } },
      { event_name: "route_clicked", session_hash: "s1", campaign: { campaign: "test" } },
      { event_name: "search_results_viewed", session_hash: "s2", props: { resultCount: 0 } },
      { event_name: "invalid", session_hash: "s3" },
    ];
    expect(summarizeMeasurement(rows)).toMatchObject({ sessions: 2, contactSessions: 1, results: 1, emptyResults: 1, campaigns: [{ campaign: "test", sessions: 1, contactSessions: 1 }, { campaign: "без кампанії", sessions: 1, contactSessions: 0 }] });
  });
});
