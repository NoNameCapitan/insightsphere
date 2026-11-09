// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NearestShelterButton } from "@/components/NearestShelterButton";
import { SafetyControls, useSafetyOverlay } from "@/components/SafetyOverlay";
import { useKyivAlert } from "@/hooks/useKyivAlert";
import { resolveNearestShelterRoute, ShelterRouteError } from "@/lib/safety/nearestShelter";
import type { KyivAlertStatus } from "@/lib/safety/types";

vi.mock("@/lib/safety/nearestShelter", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/safety/nearestShelter")>(),
  resolveNearestShelterRoute: vi.fn(),
}));

const resolver = vi.mocked(resolveNearestShelterRoute);
const status = (state: KyivAlertStatus["state"] = "active", level: KyivAlertStatus["level"] = "unknown"): KyivAlertStatus => ({
  state, level, checkedAt: new Date().toISOString(), sourceUrl: "https://map.ukrainealarm.com/",
});
let root: Root;
let container: HTMLDivElement;
let online = true;
const button = () => container.querySelector<HTMLButtonElement>('button[aria-label="Укриття"]')!;
const render = async (alert: KyivAlertStatus | null) => {
  await act(async () => { root.render(createElement(NearestShelterButton, { alert, onAlertStatus: vi.fn() })); });
};
function pendingRoute() {
  resolver.mockImplementation(({ signal, onPhase }) => {
    onPhase?.("locating");
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true }));
  });
}
function LiveButton() {
  const { alert, acceptAlert } = useKyivAlert();
  return createElement(NearestShelterButton, { alert, onAlertStatus: acceptAlert });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T09:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  online = true;
  vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
  window.localStorage.clear();
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  resolver.mockReset();
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("shelter button DOM", () => {
  it.each([null, "inactive", "unavailable"] as const)("is visible but disabled for %s", async (state) => {
    await render(state ? status(state) : null);
    expect(button().textContent).toContain("Укриття");
    expect(button().disabled).toBe(true);
  });
  it.each(["red", "yellow", "unknown"] as const)("enables for a fresh active %s alert", async (level) => {
    await render(status("active", level));
    expect(button().disabled).toBe(false);
    expect(container.textContent).toContain("Google Maps");
  });
  it("disables a stale active status", async () => {
    await render({ ...status(), checkedAt: "2020-01-01T00:00:00Z" });
    expect(button().disabled).toBe(true);
    expect(container.textContent).toContain("Статус тривоги недоступний");
  });
  it("deduplicates rapid taps and exposes a busy status", async () => {
    pendingRoute(); await render(status());
    await act(async () => { button().click(); button().click(); });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(button().disabled).toBe(true);
    expect(button().getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).toContain("Визначаємо місце");
  });
  it("aborts the pending route and disables the button when all-clear arrives", async () => {
    pendingRoute(); await render(status());
    await act(async () => { button().click(); });
    const signal = resolver.mock.calls[0][0].signal;
    await render(status("inactive"));
    expect(signal.aborted).toBe(true);
    expect(button().disabled).toBe(true);
    expect(container.textContent).not.toContain("Скасувати");
  });
  it("allows one-tap cancellation and a fresh retry", async () => {
    pendingRoute(); await render(status());
    await act(async () => { button().click(); });
    const signal = resolver.mock.calls[0][0].signal;
    const cancel = Array.from(container.querySelectorAll("button")).find(node => node.textContent === "Скасувати")!;
    await act(async () => { cancel.click(); });
    expect(signal.aborted).toBe(true);
    expect(button().disabled).toBe(false);
    await act(async () => { button().click(); });
    expect(resolver).toHaveBeenCalledTimes(2);
  });
  it("announces a routing failure and offers the official map without fake coordinates", async () => {
    resolver.mockRejectedValue(new ShelterRouteError("Дозвольте геолокацію"));
    await render(status());
    await act(async () => { button().click(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Дозвольте геолокацію");
    expect(container.querySelector("a")?.href).toBe("https://gis.kyivcity.gov.ua/shelter/");
    expect(button().disabled).toBe(false);
  });
  it("ends a stuck lookup after the bounded timeout", async () => {
    pendingRoute(); await render(status());
    await act(async () => { button().click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(35_000); });
    expect(resolver.mock.calls[0][0].signal.aborted).toBe(true);
    expect(container.textContent).toContain("Пошук триває занадто довго");
    expect(button().disabled).toBe(false);
  });
});

describe("live alert lifecycle with the real button", () => {
  it("keeps the manual action enabled when automatic overlay hints are off", async () => {
    window.localStorage.setItem("vetnear:shelter-overlay-enabled", "false");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status()))));
    function Combined() {
      const safety = useSafetyOverlay(null);
      return createElement("div", null,
        createElement(NearestShelterButton, { alert: safety.alert, onAlertStatus: safety.acceptAlert }),
        createElement(SafetyControls, { safety, onOpenMap: vi.fn() }),
      );
    }
    await act(async () => { root.render(createElement(Combined)); });
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
    expect(button().disabled).toBe(false);
  });
  it("polls from inactive to active to inactive", async () => {
    let value: KyivAlertStatus["state"] = "inactive";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status(value)))));
    await act(async () => { root.render(createElement(LiveButton)); });
    expect(button().disabled).toBe(true);
    value = "active";
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(button().disabled).toBe(false);
    value = "inactive";
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(button().disabled).toBe(true);
  });
  it("disables offline and verifies a new status on reconnection", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(status())));
    vi.stubGlobal("fetch", fetcher);
    await act(async () => { root.render(createElement(LiveButton)); });
    expect(button().disabled).toBe(false);
    online = false;
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    expect(button().disabled).toBe(true);
    online = true;
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(button().disabled).toBe(false);
  });
  it("disables on a failed poll rather than keeping cached active status", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(status())))
      .mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    await act(async () => { root.render(createElement(LiveButton)); });
    expect(button().disabled).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(button().disabled).toBe(true);
  });
  it("ignores an older background active response after a newer manual all-clear", async () => {
    let finishPoll: (response: Response) => void = () => {};
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(status())))
      .mockImplementation(() => new Promise(resolve => { finishPoll = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    pendingRoute();
    await act(async () => { root.render(createElement(LiveButton)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const older = status();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); button().click(); });
    await act(async () => { resolver.mock.calls[0][0].onAlertStatus?.(status("inactive")); });
    expect(button().disabled).toBe(true);
    await act(async () => { finishPoll(new Response(JSON.stringify(older))); });
    expect(button().disabled).toBe(true);
  });
});
