// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReport, getReports } from "@/lib/reports/store";
import { createSubmission } from "@/lib/partners/store";
import { setServerSubmissionStatus, syncReportToServer } from "@/lib/api/backendClient";
import { ReportIncorrectButton } from "@/components/ReportIncorrectButton";

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_BACKEND_ENABLED", "1");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("submission receipts", () => {
  it("never labels a disabled backend as delivered", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_ENABLED", "0");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const report = await createReport("clinic-1", "wrong_hours");
    expect(report.delivery.status).toBe("local");
    expect(report.localSaved).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps a local report but does not confirm an API failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    const report = await createReport("clinic-1", "wrong_hours", "Changed hours");
    expect(report.delivery.status).toBe("unconfirmed");
    expect(report.localSaved).toBe(true);
    expect(getReports()).toHaveLength(1);
  });
  it("requires an actual receipt ID, not just HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }))));
    expect((await syncReportToServer("clinic-1", "wrong_hours")).status).toBe("unconfirmed");
  });
  it("separates a confirmed server save from blocked local storage", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "server-1" }), { status: 201 })));
    const report = await createReport("clinic-1", "wrong_hours");
    expect(report.delivery).toEqual({ status: "sent", id: "server-1" });
    expect(report.localSaved).toBe(false);
  });
  it("partner submission waits for the same confirmed receipt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failed")));
    const result = await createSubmission({ name: "Clinic", category: "veterinary_clinic", description: "", address: "Kyiv", district: "pecherskyi", phone: "+380441234567", services: [], animalTypes: ["cat"], emergencyAvailable: false, appointmentRequired: false, deliveryAvailable: false, pickupAvailable: false, tags: [] });
    expect(result.delivery.status).toBe("unconfirmed");
    expect(result.localSaved).toBe(true);
  });
  it("does not hide a failed publication behind a successful status change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, published: { ok: false, reason: "publish_failed" } }))));
    await expect(setServerSubmissionStatus("submission-1", "approved")).rejects.toThrow("публікацію");
  });
  it("shows pending and then unconfirmed status without double posting", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let resolve: (response: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetcher);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(ReportIncorrectButton, { placeId: "clinic-1" })));
      await act(async () => container.querySelector("button")!.click());
      const submit = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Надіслати")!;
      await act(async () => { submit.click(); submit.click(); });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(submit.disabled).toBe(true);
      expect(submit.getAttribute("aria-busy")).toBe("true");
      await act(async () => resolve(new Response("Unavailable", { status: 503 })));
      expect(container.querySelector('[role="status"]')?.textContent).toContain("не підтвердив отримання");
      expect(container.textContent).not.toContain("передано на модерацію");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
