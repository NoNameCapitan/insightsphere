// AI-тріаж симптомів — ДЕТЕРМІНОВАНЕ ядро (Phase 2 / hackathon step 2).
//
// Правило безпеки №1: рівень терміновості визначають ТІЛЬКИ правила нижче.
// LLM (Claude) лише пояснює рішення і дає поради догляду; він не може ані
// поставити діагноз, ані ЗНИЗИТИ рівень. Ескалація можлива (isUrgent по
// вільному тексту), деескалація — ніколи. Чисті функції, без I/O — під тестами.
import { isUrgent } from "@/lib/assistant";
import { SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";
import type { QuestionnaireAnswers, Symptom } from "@/lib/questionnaire";

export type TriageLevel = "emergency_now" | "vet_today" | "planned_visit";

export interface TriageResult {
  level: TriageLevel;
  /** Людські причини рішення (укр), для показу користувачу. */
  reasons: string[];
  /** Куди вести користувача. */
  ctaHref: string;
  ctaLabel: string;
}

const LEVEL_ORDER: Record<TriageLevel, number> = {
  planned_visit: 0,
  vet_today: 1,
  emergency_now: 2,
};

/** Монотонне обʼєднання: результат ніколи не мʼякший за будь-який із рівнів. */
export function maxLevel(a: TriageLevel, b: TriageLevel): TriageLevel {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}

export const LEVEL_META: Record<
  TriageLevel,
  { title: string; subtitle: string; tone: "red" | "amber" | "green" }
> = {
  emergency_now: {
    title: "До лікаря — просто зараз",
    subtitle:
      "Ознаки можуть загрожувати життю. Зателефонуйте до найближчої клініки та попередьте, що їдете.",
    tone: "red",
  },
  vet_today: {
    title: "Огляд ветеринара сьогодні",
    subtitle:
      "Стан не виглядає критичним, але відкладати не варто. Запишіться на прийом сьогодні.",
    tone: "amber",
  },
  planned_visit: {
    title: "Плановий візит",
    subtitle:
      "За описом невідкладності не видно. Сплануйте візит найближчими днями та спостерігайте за станом.",
    tone: "green",
  },
};

const RED_SYMPTOMS: Symptom[] = ["breathing", "bleeding", "trauma"];

/** Детермінований тріаж за відповідями опитника. */
export function triageFromAnswers(a: QuestionnaireAnswers): TriageResult {
  const reasons: string[] = [];
  let level: TriageLevel = "planned_visit";

  // ── Червоні прапорці → невідкладно ────────────────────────────────────────
  for (const s of a.symptoms) {
    if (RED_SYMPTOMS.includes(s)) {
      level = "emergency_now";
      reasons.push(
        s === "breathing"
          ? "Проблеми з диханням — завжди невідкладний стан."
          : s === "bleeding"
            ? "Кровотеча потребує негайного огляду."
            : "Травма може мати приховані ушкодження.",
      );
    }
  }
  if (a.intent === "emergency" || a.urgency === "critical") {
    level = "emergency_now";
    reasons.push("Ви оцінили ситуацію як критичну.");
  }
  if (a.eating === "no" && a.symptoms.includes("weakness")) {
    level = "emergency_now";
    reasons.push("Повна відмова від їжі разом зі слабкістю — небезпечне поєднання.");
  }

  // ── Жовта зона → сьогодні ─────────────────────────────────────────────────
  if (level !== "emergency_now") {
    if (a.symptoms.includes("vomiting")) {
      level = maxLevel(level, "vet_today");
      reasons.push("Блювання варто показати лікарю, не чекаючи ускладнень.");
    }
    if (a.symptoms.includes("weakness")) {
      level = maxLevel(level, "vet_today");
      reasons.push("Незвична слабкість — привід для огляду сьогодні.");
    }
    if (a.eating === "no") {
      level = maxLevel(level, "vet_today");
      reasons.push("Повна відмова від їжі понад добу небезпечна, особливо для котів.");
    }
    if (a.urgency === "high") {
      level = maxLevel(level, "vet_today");
      reasons.push("Ви оцінюєте стан як серйозний.");
    }
    if (a.eating === "reduced" && (a.duration === "days" || a.duration === "week")) {
      level = maxLevel(level, "vet_today");
      reasons.push("Знижений апетит кілька днів поспіль — не норма.");
    }
  }

  if (level === "planned_visit") {
    reasons.push("Червоних прапорців за відповідями не виявлено.");
  }

  return withCta(level, reasons);
}

/**
 * Повний тріаж: відповіді + вільний текст. Текст може лише ПІДВИЩИТИ рівень
 * (через той самий детермінований urgent-гейт, що й у асистента).
 */
export function resolveTriage(
  a: QuestionnaireAnswers,
  freeText?: string,
): TriageResult {
  const base = triageFromAnswers(a);
  if (freeText && isUrgent(freeText) && base.level !== "emergency_now") {
    return withCta("emergency_now", [
      "В описі є ознаки невідкладного стану.",
      ...base.reasons,
    ]);
  }
  return base;
}

function withCta(level: TriageLevel, reasons: string[]): TriageResult {
  if (level === "emergency_now") {
    return {
      level,
      reasons,
      // Чесний CTA: найближчі клініки (НЕ обіцянка «24/7» без підтвердження).
      ctaHref: SAFE_EMERGENCY_CTA_HREF,
      ctaLabel: "Найближчі клініки — зараз",
    };
  }
  return {
    level,
    reasons,
    ctaHref: "/nearby?category=veterinary_clinic",
    ctaLabel: level === "vet_today" ? "Знайти клініку на сьогодні" : "Обрати клініку поруч",
  };
}

/** Дефолтні поради, коли AI-пояснення недоступне (offline / без ключа). */
export const FALLBACK_ADVICE: Record<TriageLevel, string[]> = {
  emergency_now: [
    "Зателефонуйте до клініки перед виїздом — попередьте про стан тварини.",
    "Не давайте ліки «про всяк випадок» без призначення лікаря.",
    "Транспортуйте обережно: переноска або тверда поверхня при травмі.",
  ],
  vet_today: [
    "Забезпечте доступ до води; не змушуйте їсти.",
    "Занотуйте, коли зʼявилися симптоми і як змінювалися.",
    "Не давайте людські ліки — багато з них токсичні для тварин.",
  ],
  planned_visit: [
    "Поспостерігайте за апетитом, активністю та туалетом 1–2 дні.",
    "Якщо зʼявляться нові симптоми — поверніться до оцінки терміновості.",
    "Запишіть питання до лікаря заздалегідь.",
  ],
};
