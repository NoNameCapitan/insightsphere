import { EDITION, SOURCE_URL } from "./vlk-sample-data.ts";

export type ReviewStatus = "verified" | "pending";

export type ExpertReview = {
  role: "Лікар ВЛК" | "Військовий медичний юрист";
  status: ReviewStatus;
  reviewer: string | null;
  reviewedAt: string | null;
};

export const NORMATIVE_PASSPORT = {
  corpusId: "mou-402-schedule-2025-08-22",
  title: "Положення про військово-лікарську експертизу в Збройних Силах України",
  order: "Наказ Міністерства оборони України №402 від 14.08.2008",
  edition: EDITION,
  sourceUrl: SOURCE_URL,
  coverage: {
    articles: 87,
    officialRows: 87,
    exactIcdSets: 29,
    explanationSets: 86,
    tdvIncluded: true,
  },
  safeguards: [
    "Офіційний текст не скорочується і не перефразовується",
    "Збережені записи відновлюються тільки за статтею та пунктом",
    "Невідоме формулювання не класифікується як придатність",
    "Результат позначається лише як попередній нормативний орієнтир",
  ],
} as const;

export const EXPERT_REVIEWS: readonly ExpertReview[] = [
  {
    role: "Лікар ВЛК",
    status: "pending",
    reviewer: null,
    reviewedAt: null,
  },
  {
    role: "Військовий медичний юрист",
    status: "pending",
    reviewer: null,
    reviewedAt: null,
  },
];

export const REVISION_LOG = [
  {
    edition: EDITION,
    sourceUrl: SOURCE_URL,
    summary:
      "Нормативний корпус містить 87 статей, дослівні рядки Розкладу хвороб, пункти, пояснення та ТДВ.",
  },
] as const;

export const EDITION_MONITOR = {
  status: "configured",
  schedule: "щодня через CI",
  behavior:
    "Порівнює дату офіційної редакції з датою корпусу. Розбіжність зупиняє перевірку, але не змінює нормативні дані автоматично.",
} as const;

export function hasDoubleExpertVerification(reviews: readonly ExpertReview[] = EXPERT_REVIEWS) {
  const roles: ExpertReview["role"][] = ["Лікар ВЛК", "Військовий медичний юрист"];
  return roles.every((role) => reviews.some((review) =>
    review.role === role && review.status === "verified" &&
    Boolean(review.reviewer?.trim()) && Boolean(review.reviewedAt?.trim()),
  ));
}

export function normReferenceId(article: string, point?: string) {
  return point && point !== "—"
    ? `${NORMATIVE_PASSPORT.corpusId}:article-${article}:point-${point}`
    : `${NORMATIVE_PASSPORT.corpusId}:article-${article}`;
}
