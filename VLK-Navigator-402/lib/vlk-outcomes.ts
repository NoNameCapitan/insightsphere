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

const TONE_STYLES: Record<OutcomeTone, { box: string; badge: string; dot: string }> = {
  critical: {
    box: "border-[#ba4a4a]/22 bg-[#fff1ef]",
    badge: "bg-[#f3ceca] text-[#7d2929]",
    dot: "bg-[#b23f3f]",
  },
  warning: {
    box: "border-[#c58b28]/25 bg-[#fff8e7]",
    badge: "bg-[#f2ddaa] text-[#6d4d12]",
    dot: "bg-[#c58b28]",
  },
  positive: {
    box: "border-[#2f806f]/20 bg-[#edf7f2]",
    badge: "bg-[#cfe8dd] text-[#205f51]",
    dot: "bg-[#2f806f]",
  },
  neutral: {
    box: "border-[#173f40]/15 bg-[#f2f5f3]",
    badge: "bg-[#e0e7e3] text-[#41585a]",
    dot: "bg-[#6b807e]",
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
