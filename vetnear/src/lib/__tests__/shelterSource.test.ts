import { describe, expect, it, vi } from "vitest";
import { loadShelterFeatures, normalizeShelterFeatures } from "@/lib/safety/shelters";
import { parseKyivAlertPayload } from "@/lib/safety/alert";

const source = "https://example.test/MapServer/0/query";
const origin = { latitude: 50.45, longitude: 30.52 };
const feature = (objectid: number, lat = 50.4501) => ({ attributes: {
  objectid, actual: 1, address: "Тестове укриття", lat, long: 30.52, working_time: "Цілодобово",
} });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe("complete official shelter queries", () => {
  it("includes a closer shelter from a later page before ranking", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ features: [feature(1, 50.46)], exceededTransferLimit: true }))
      .mockResolvedValueOnce(json({ features: [feature(2)] }));
    const result = await loadShelterFeatures(source, new URLSearchParams({ where: "actual=1" }), new AbortController().signal, fetcher);
    expect(normalizeShelterFeatures(result, origin)[0].id).toBe("2");
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("resultOffset")).toBe("1");
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("orderByFields")).toBe("objectid ASC");
    expect(fetcher.mock.calls[0][1]?.cache).toBe("no-store");
  });
  it("refuses partial results if the server ignores pagination", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({ features: [feature(1)], exceededTransferLimit: true }));
    await expect(loadShelterFeatures(source, new URLSearchParams(), new AbortController().signal, fetcher)).rejects.toThrow("pagination");
  });
  it("refuses empty truncated pages", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ features: [], exceededTransferLimit: true }));
    await expect(loadShelterFeatures(source, new URLSearchParams(), new AbortController().signal, fetcher)).rejects.toThrow("Incomplete");
  });
  it.each([null, {}, { error: { code: 500 } }, { features: "bad" }])("rejects invalid upstream %j", async (value) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(value));
    await expect(loadShelterFeatures(source, new URLSearchParams(), new AbortController().signal, fetcher)).rejects.toThrow();
  });
  it("permits a genuinely empty complete query", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ features: [], exceededTransferLimit: false }));
    expect(await loadShelterFeatures(source, new URLSearchParams(), new AbortController().signal, fetcher)).toEqual([]);
  });
  it("rejects HTTP errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 503));
    await expect(loadShelterFeatures(source, new URLSearchParams(), new AbortController().signal, fetcher)).rejects.toThrow();
  });
  it("does not silently cap an oversized query", async () => {
    let id = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({ features: [feature(++id)], exceededTransferLimit: true }));
    await expect(loadShelterFeatures(source, new URLSearchParams(), new AbortController().signal, fetcher)).rejects.toThrow("too many pages");
    expect(fetcher).toHaveBeenCalledTimes(10);
  });
  it("honours abort before requesting a page", async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(loadShelterFeatures(source, new URLSearchParams(), controller.signal, fetcher)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("invalid safety data", () => {
  it("uses WGS84 geometry when lat/long attributes are null, never zero coordinates", () => {
    const result = normalizeShelterFeatures([{ ...feature(1),
      attributes: { ...feature(1).attributes, lat: null, long: null },
      geometry: { x: 30.52, y: 50.45 },
    }], origin);
    expect(result[0].latitude).toBe(50.45);
  });
  it("excludes malformed, out-of-city and more than 10 km away records", () => {
    expect(normalizeShelterFeatures([null, "bad", {}, feature(1, 0), feature(2, 50.64)], origin)).toEqual([]);
  });
  it("does not fail the entire dataset on invalid edit timestamps", () => {
    const result = normalizeShelterFeatures([{ attributes: { ...feature(1).attributes, last_edited_date: 1e30 } }], origin);
    expect(result[0].sourceUpdatedAt).toBeNull();
  });
  it.each([undefined, null, "bad", [null]].map((activeAlerts) => ({ activeAlerts })))("does not report all-clear for a malformed activeAlerts field", ({ activeAlerts }) => {
    expect(parseKyivAlertPayload([{ regionName: "м. Київ", activeAlerts }]).state).toBe("unavailable");
  });
  it("reports all-clear only for a valid empty activeAlerts list", () => {
    expect(parseKyivAlertPayload([{ regionName: "м. Київ", activeAlerts: [] }]).state).toBe("inactive");
  });
});
