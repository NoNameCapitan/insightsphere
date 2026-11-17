// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceActions } from "@/components/PlaceActions";
import { PLACES } from "@/lib/data/places";

const probes = vi.hoisted(() => ({ report: vi.fn(), observe: undefined as undefined | ((entries: { isIntersecting: boolean }[]) => void) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/leads/report", () => ({ reportLead: probes.report }));
vi.mock("@/components/SocialRow", () => ({ SocialRow: () => null }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof probes.observe) { probes.observe = callback; } observe() {} disconnect() {} });
  probes.report.mockClear(); localStorage.clear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("provider contact truth and mobile dock", () => {
  it("provides actual contacts without a simulated send or local booking", async () => {
    await act(async () => root.render(createElement(PlaceActions, { place: PLACES[0] })));
    expect(container.querySelector('a[href^="tel:"]')).not.toBeNull();
    expect(container.textContent).toContain("напряму із закладом");
    expect(container.textContent).not.toMatch(/Надіслати запит|бронювання — скоро/);
    expect(container.querySelector("textarea")).toBeNull();
    expect(probes.report).not.toHaveBeenCalled();
    expect(localStorage.getItem("vetnear:requests")).toBeNull();
  });
  it("shows a second contact dock only after inline controls leave view", async () => {
    await act(async () => root.render(createElement(PlaceActions, { place: PLACES[0] })));
    expect(container.querySelector('[data-contact-dock]')).toBeNull();
    await act(async () => probes.observe?.([{ isIntersecting: false }]));
    expect(container.querySelector('[data-contact-dock] a[href^="tel:"]')).not.toBeNull();
    await act(async () => probes.observe?.([{ isIntersecting: true }]));
    expect(container.querySelector('[data-contact-dock]')).toBeNull();
  });
});
