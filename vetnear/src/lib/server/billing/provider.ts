// Payment-provider seam (v1.32).
//
// Today only "manual" exists: an admin records a bank transfer or a paid
// invoice. To connect LiqPay / Fondy / Stripe, implement this interface in a
// new file, return it from getBillingProvider(), and set BILLING_PROVIDER.
// The webhook route, idempotency and plan activation need no change.
import "server-only";
import type { BillingPlan, BillingProviderId } from "@/lib/billing/plans";

export interface CheckoutRequest {
  placeId: string;
  plan: BillingPlan;
  amountUah: number;
  /** Where the provider should send the customer back to. */
  returnUrl: string;
}

export type CheckoutResult =
  | { kind: "redirect"; url: string; orderId: string }
  /** No online payment: the partner is invoiced by a person. */
  | { kind: "manual"; instructions: string };

/** A verified "payment succeeded" notification from a provider. */
export interface PaidEvent {
  /** The provider's unique payment id — the idempotency key. */
  providerPaymentId: string;
  placeId: string;
  planCode: string;
  amountUah: number;
}

export interface BillingProvider {
  id: BillingProviderId;
  /** Starts a prepaid checkout for one plan. */
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  /**
   * Verifies the signature of a webhook and extracts the payment. Must return
   * null for anything that is not a correctly signed, successful payment.
   */
  verifyWebhook(req: Request, rawBody: string): Promise<PaidEvent | null>;
}

const manualProvider: BillingProvider = {
  id: "manual",
  async createCheckout() {
    return {
      kind: "manual",
      instructions: "Оплата передоплатою за рахунком. Після надходження коштів адміністратор активує тариф.",
    };
  },
  // The manual path has no webhook: payments are recorded by an admin.
  async verifyWebhook() {
    return null;
  },
};

/** The active provider. Unknown or missing configuration falls back to manual. */
export function getBillingProvider(): BillingProvider {
  // const id = (process.env.BILLING_PROVIDER || "manual").toLowerCase();
  // if (id === "liqpay") return liqpayProvider;   ← add the adapter here
  return manualProvider;
}

/** Order ids we hand to a provider: `vn.<placeId>.<planCode>.<nonce>`. */
export function buildOrderId(placeId: string, planCode: string, nonce: string): string {
  return `vn.${placeId}.${planCode}.${nonce}`;
}

export function parseOrderId(orderId: string): { placeId: string; planCode: string } | null {
  const match = /^vn\.(.{1,120})\.([a-z0-9_]{3,40})\.[A-Za-z0-9]{6,40}$/.exec(orderId);
  return match ? { placeId: match[1], planCode: match[2] } : null;
}
