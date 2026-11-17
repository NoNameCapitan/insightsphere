import type { PartnerPlan } from "@/lib/types";

export interface PartnerPlanProposal {
  id: PartnerPlan;
  name: string;
  proposedMonthlyUah: number | null;
  priceApproved: boolean;
  features: readonly string[];
}

/** Existing pilot prices are proposals, never amounts chargeable by this app. */
export const PARTNER_PLANS: readonly PartnerPlanProposal[] = [
  { id: "free", name: "Базовий", proposedMonthlyUah: 0, priceApproved: true, features: ["Профіль після модерації", "Телефон, сайт і маршрут", "Прозорі джерела даних"] },
  { id: "verified", name: "Партнер", proposedMonthlyUah: 449, priceApproved: false, features: ["Заплановано: розширений профіль", "Послуги, фото та ціни", "Аналітика дій у профілі"] },
  { id: "pro", name: "Партнер Pro", proposedMonthlyUah: 1349, priceApproved: false, features: ["Заплановано: інструменти партнерського плану", "Позначене промо у звичайному пошуку", "Звіт про переходи й звернення"] },
  { id: "multi_location", name: "Мережа", proposedMonthlyUah: 2699, priceApproved: false, features: ["Заплановано: керування кількома філіями", "Оновлення даних мережі", "Зведена аналітика"] },
];

export function isPartnerPlan(value: unknown): value is PartnerPlan {
  return typeof value === "string" && PARTNER_PLANS.some((plan) => plan.id === value);
}

export function planLabel(value: PartnerPlan): string {
  return PARTNER_PLANS.find((plan) => plan.id === value)!.name;
}
