import "server-only";
import type { PartnerPlan } from "@/lib/types";
import type { BillingSubscription } from "./entitlements";

/** Adapter contract. No provider credentials, SDK or checkout is connected. */
export interface BillingProvider {
  readonly id: "disabled" | "configured";
  createCheckout(input: { partnerId: string; plan: PartnerPlan; approvedPriceId: string }): Promise<{ available: false; reason: "not_connected" } | { available: true; checkoutUrl: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<{ verified: false } | { verified: true; eventId: string; subscription: BillingSubscription }>;
}

const disabledProvider: BillingProvider = {
  id: "disabled",
  async createCheckout() { return { available: false, reason: "not_connected" }; },
  async verifyWebhook() { return { verified: false }; },
};

export function getBillingProvider(): BillingProvider {
  return disabledProvider;
}
