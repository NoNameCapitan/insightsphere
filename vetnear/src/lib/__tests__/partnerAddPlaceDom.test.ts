// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddPlacePage from "@/app/add-place/page";
import { hydratePublishedPlaces } from "@/lib/store";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/partners/store", () => ({ createSubmission: vi.fn() }));
vi.mock("@/lib/store", () => ({
  getPlaces: vi.fn(() => [{ id: "seed-clinic", slug: "seed-clinic", name: "Genesis Clinic", address: "вул. Садова, 12", phone: "+380671234567", locality: "Київ", category: "veterinary_clinic" }]),
  // Hydration returns only the published DB layer, not the merged catalogue.
  hydratePublishedPlaces: vi.fn(async () => []),
}));
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("partner catalogue recovery", () => {
  it("keeps seed duplicate suggestions after an empty server hydration", async () => {
    await act(async () => root.render(createElement(AddPlacePage)));
    expect(hydratePublishedPlaces).toHaveBeenCalled();
    const input = container.querySelector<HTMLInputElement>("#name")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Genesis");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector('aside[aria-label="Можливі збіги в каталозі"]')?.textContent).toContain("Genesis Clinic");
    expect(container.querySelector('a[href="/partner-interest?claim=seed-clinic"]')).not.toBeNull();
  });
});
