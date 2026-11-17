import { describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ redirect: vi.fn((url: string) => { throw new Error(url); }) }));
vi.mock("next/navigation", () => ({ redirect: navigation.redirect }));
vi.mock("@/components/NeedRouter", () => ({ NeedRouter: () => null }));
import HelpPage from "@/app/help/page";

describe("direct urgent navigation", () => {
  it("takes the owner straight to clinics and preserves their territory and animal", async () => {
    await expect(HelpPage({ searchParams: Promise.resolve({ urgent: "1", animal: "cat", region: "kyiv_oblast", locality: "Буча", next: "https://invalid.test" }) })).rejects.toThrow("/nearby?");
    const destination = navigation.redirect.mock.calls.at(-1)![0];
    const params = new URLSearchParams(destination.split("?")[1]);
    expect(params.get("category")).toBe("veterinary_clinic"); expect(params.get("urgent")).toBe("1");
    expect(params.get("animal")).toBe("cat"); expect(params.get("locality")).toBe("Буча");
    expect(params.has("next")).toBe(false);
  });
});
