/**
 * Класифікація дослівного результату пункту Розкладу хвороб.
 *
 * Модуль нічого не додає до нормативного тексту: він лише розпізнає, до якої
 * категорії належить дослівне формулювання четвертої графи, щоб інтерфейс не
 * показував сильніший або слабший висновок, ніж написано в Наказі №402.
 *
 * Незнайоме формулювання ніколи не класифікується як «Придатний»: воно
 * позначається нейтрально й лишається дослівним.
 */

export type OutcomeKind =
  | "unfit"
  | "unfit-review"
  | "temporary"
  | "limited"
  | "fit"
  | "none"
  | "unknown";

export type OutcomeTone = "critical" | "warning" | "positive" | "neutral";

export type OutcomeClass = {
  kind: OutcomeKind;
  /** Коротка позначка для бейджа. Не замінює дослівний текст. */
  label: string;
  /** Порядок суворості для вибору найсуворішого орієнтира у зведенні. */
  severity: number;
  tone: OutcomeTone;
  /** true, якщо дослівний результат не дає готової категорії придатності. */
  requiresLiteralReading: boolean;
};

/**
 * Тони результату описані токенами, тому світла і нічна теми беруть свої
 * перевірені пари «фон / текст» без дублювання класів у розмітці.
 */
const TONE_STYLES: Record<
  OutcomeTone,
  { box: string; badge: string; dot: string; bar: string }
> = {
  critical: {
    box: "border-[var(--danger-line)] bg-[var(--box-critical-bg)]",
    badge: "bg-[var(--badge-critical-bg)] text-[var(--badge-critical-ink)]",
    dot: "bg-[var(--danger-ink)]",
    bar: "border-[var(--danger-ink)]",
  },
  warning: {
    box: "border-[var(--warn-line)] bg-[var(--box-warning-bg)]",
    badge: "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-ink)]",
    dot: "bg-[var(--gold)]",
    bar: "border-[var(--gold)]",
  },
  positive: {
    box: "border-[var(--accent-line)] bg-[var(--box-positive-bg)]",
    badge: "bg-[var(--badge-positive-bg)] text-[var(--badge-positive-ink)]",
    dot: "bg-[var(--accent-ink)]",
    bar: "border-[var(--accent-ink)]",
  },
  neutral: {
    box: "border-[var(--hairline-strong)] bg-[var(--box-neutral-bg)]",
    badge: "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-ink)]",
    dot: "bg-[var(--ink-muted)]",
    bar: "border-[var(--ink-muted)]",
  },
};

const EMPTY_RESULT = new Set(["", "-", "–", "—", "‒", "―"]);

/**
 * Розпізнає дослівний результат. Порядок перевірок важливий: обмежувальний
 * результат «Придатні до служби у військових частинах забезпечення…»
 * перевіряється раніше за загальне «Придатні».
 */
export function classifyOutcome(outcome: string | undefined | null): OutcomeClass {
  const text = (outcome ?? "").trim();

  if (EMPTY_RESULT.has(text)) {
    return {
      kind: "none",
      label: "Результат не наведено",
      severity: 0,
      tone: "neutral",
      requiresLiteralReading: true,
    };
  }

  if (/^непридатн/iu.test(text)) {
    if (/переогляд/iu.test(text)) {
      return {
        kind: "unfit-review",
        label: "Непридатний · переогляд",
        severity: 4,
        tone: "critical",
        requiresLiteralReading: false,
      };
    }
    return {
      kind: "unfit",
      label: "Непридатний",
      severity: 5,
      tone: "critical",
      requiresLiteralReading: false,
    };
  }

  if (/^тимчасово непридатн/iu.test(text)) {
    return {
      kind: "temporary",
      label: "Тимчасово непридатний",
      severity: 3,
      tone: "warning",
      requiresLiteralReading: false,
    };
  }

  if (/^потребують лікуванн/iu.test(text)) {
    return {
      kind: "temporary",
      label: "Потребує лікування",
      severity: 3,
      tone: "warning",
      requiresLiteralReading: false,
    };
  }

  if (/частинах забезпеченн/iu.test(text)) {
    return {
      kind: "limited",
      label: "Визначені види служби",
      severity: 2,
      tone: "warning",
      requiresLiteralReading: false,
    };
  }

  if (/^придатн/iu.test(text)) {
    return {
      kind: "fit",
      label: "Придатний",
      severity: 1,
      tone: "positive",
      requiresLiteralReading: false,
    };
  }

  return {
    kind: "unknown",
    label: "Читати дослівно",
    severity: 0,
    tone: "neutral",
    requiresLiteralReading: true,
  };
}

export function outcomeStyles(outcome: string | undefined | null) {
  const classified = classifyOutcome(outcome);
  return { ...classified, ...TONE_STYLES[classified.tone] };
}

export function outcomeSeverity(outcome: string | undefined | null) {
  return classifyOutcome(outcome).severity;
}

/**
 * Найсуворіший орієнтир серед вибраних пунктів. За рівної суворості
 * зберігається порядок додавання, тому вибір передбачуваний для лікаря.
 */
export function strictestOutcome<T extends { outcome: string }>(items: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestSeverity = -1;
  for (const item of items) {
    const severity = outcomeSeverity(item.outcome);
    if (severity > bestSeverity) {
      best = item;
      bestSeverity = severity;
    }
  }
  return best;
}

/**
 * Фільтр списку статей за категорією результату.
 *
 * Фільтр показує статті, у яких є хоча б один пункт із таким дослівним
 * результатом. Він не приписує статті єдину категорію придатності — у більшості
 * статей пункти мають різні результати.
 */
export const OUTCOME_FILTERS = [
  { id: "all", label: "Усі результати", kinds: [] as OutcomeKind[] },
  { id: "unfit", label: "Непридатний", kinds: ["unfit", "unfit-review"] as OutcomeKind[] },
  { id: "temporary", label: "Тимчасово непридатний", kinds: ["temporary"] as OutcomeKind[] },
  { id: "limited", label: "Визначені види служби", kinds: ["limited"] as OutcomeKind[] },
  { id: "fit", label: "Придатний", kinds: ["fit"] as OutcomeKind[] },
  { id: "literal", label: "Без готової категорії", kinds: ["none", "unknown"] as OutcomeKind[] },
] as const;

export type OutcomeFilterId = (typeof OUTCOME_FILTERS)[number]["id"];

export function matchesOutcomeFilter(outcomes: readonly string[], filter: OutcomeFilterId) {
  const entry = OUTCOME_FILTERS.find((item) => item.id === filter);
  if (!entry || !entry.kinds.length) return true;
  return outcomes.some((outcome) => entry.kinds.includes(classifyOutcome(outcome).kind));
}
