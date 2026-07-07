// Safe pet assistant (Module 9).
// NEVER diagnoses or prescribes. Routes to professionals; escalates urgent cases.
//
// Two runtime modes (chosen server-side in /api/assistant):
//   - Real Claude answer when ANTHROPIC_API_KEY is configured (server-only key).
//   - Rule-based `mockProvider` fallback (demo mode) when the key is missing.
// The URGENT gate and the routing suggestion are ALWAYS rule-based and
// deterministic — emergency safety is never delegated to the model.
import type { PetProfile } from "@/lib/types";
import { SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";

export interface AssistantReply {
  text: string;
  urgent: boolean;
  /** Suggested discovery deep-link, if any. */
  suggestion?: { label: string; href: string };
  /** True when the reply came from the rule-based fallback (no AI key). */
  demoMode?: boolean;
}

// Verbatim safety brief shared with the model (see route.ts).
export const ASSISTANT_SYSTEM_PROMPT =
  "You are VetNear Assistant. You help pet owners route their situation to the right " +
  "nearby pet-care service. You are not a veterinarian and you do not diagnose, prescribe, " +
  "or give dosage instructions. For urgent symptoms, advise contacting a veterinarian " +
  "immediately and show nearest vet clinics. Be calm, concise, practical, and safety-first.";

const SAFETY = "Я не ставлю діагнозів і не замінюю ветеринара.";

// Keywords that should always escalate to emergency routing (deterministic).
const URGENT = [
  "кров", "кровотеч", "задиха", "не дихає", "судом", "отру", "проковтн",
  "впав", "впала", "збила", "збив", "температур", "не їсть", "блюв", "блювот",
  "паралі", "набряк", "притомн",
];

export function isUrgent(question: string): boolean {
  const q = question.toLowerCase();
  return URGENT.some((k) => q.includes(k));
}

function petContext(pet: PetProfile | null): string {
  if (!pet) return "Додайте профіль улюбленця, щоб я враховував вид тварини.";
  return `Враховую профіль: ${pet.name} (${pet.animalType}).`;
}

// Rule-based category routing (also used to build the deterministic suggestion).
export function routeSuggestion(question: string): { label: string; href: string } {
  const q = question.toLowerCase();
  if (/(корм|їжа|годув|переноск|іграшк|нашийник|повідц|амуніц|лежак|кліт|акваріум)/.test(q))
    return { label: "Зоомагазини поруч", href: "/nearby?category=pet_store" };
  if (/(ліки|препарат|вітамін|апте)/.test(q)) return { label: "Ветаптеки поруч", href: "/nearby?category=vet_pharmacy" };
  if (/(груминг|грумінг|стриж|кігт|шерст)/.test(q)) return { label: "Грумінг поруч", href: "/nearby?category=grooming" };
  if (/(притул|загуб|знайшов|волонт)/.test(q)) return { label: "Притулки та зоозахист", href: "/nearby?category=shelter" };
  return { label: "Знайти ветклініки поруч", href: "/nearby?category=veterinary_clinic" };
}

export const mockProvider = {
  answer(question: string, pet: PetProfile | null): AssistantReply {
    if (isUrgent(question)) {
      return {
        text:
          `${SAFETY} Схоже, ситуація може бути терміновою. Будь ласка, негайно ` +
          `зателефонуйте у ветклініку напряму. Цілодобові/термінові заклади у VetNear ` +
          `додаються лише після підтвердження дзвінком, тому показуємо найближчі ` +
          `ветклініки. ${petContext(pet)}`,
        urgent: true,
        suggestion: { label: "Показати найближчі ветклініки", href: SAFE_EMERGENCY_CTA_HREF },
      };
    }
    return {
      text:
        `${SAFETY} ${petContext(pet)} За вашим запитом, ймовірно, варто звернутися ` +
        `до відповідного закладу. Ось релевантні варіанти поруч.`,
      urgent: false,
      suggestion: routeSuggestion(question),
    };
  },
};

/* ---------------------------------------------------------------------------
 * Guided local assistant (free MVP, no API / no key / no LLM).
 * Ukrainian keyword-based intent detection + safe response templates that
 * route into existing VetNear flows. Never diagnoses, never prescribes.
 * ------------------------------------------------------------------------ */

export type AssistantIntent =
  | "emergency"
  | "checklist"
  | "business"
  | "grooming"
  | "boarding"
  | "pharmacy"
  | "store"
  | "clinic"
  | "unknown";

export interface GuidedAction {
  label: string;
  href: string;
  tone: "brand" | "emergency" | "ghost";
}

export interface GuidedReply {
  intent: AssistantIntent;
  urgent: boolean;
  text: string;
  /** Extra safety note rendered in small print under the text. */
  note?: string;
  /** Visit-preparation checklist items (checklist intent). */
  checklist?: string[];
  actions: GuidedAction[];
  /** Unknown intent: the UI should re-offer the quick chips. */
  clarify?: boolean;
}

// Ordered by priority: safety first, then the most specific wording.
// Stems (without endings) so grammatical forms match: "стрижка/стригти" → "стриж".
const INTENT_RULES: [AssistantIntent, RegExp][] = [
  [
    "emergency",
    /(терміново|невідкладн|кров|отру|судом|не дихає|задиха|збила машина|збив автомобіль|збил[аи]|травм|сильний біль|притомн|свідом|паралі|конвульс)/,
  ],
  ["checklist", /(підготу|що сказати лікар|що взяти|перед візитом|перед прийомом)/],
  [
    "business",
    /(додати бізнес|додати заклад|моя клініка|я власник|власник заклад|партнерств|реклам|зообізнес|розмістити)/,
  ],
  ["grooming", /(грумінг|груминг|стриж|купанн|скупати|кігт|чищення вух|вичіс|шерст|тримінг|линя)/],
  [
    "boarding",
    /(перетримк|передержк|готел|залишити тварин|залишити кот|залишити соба|на час поїздки|відпустк|відрядженн|догляд на час|денний догляд)/,
  ],
  [
    "pharmacy",
    /(ветаптек|аптек|ліки|лікув засіб|препарат|крапл|таблет|пігулк|вітамін|від кліщів|від бліх|глист|мазь)/,
  ],
  [
    "store",
    /(зоомагазин|корм|іграшк|повідц|повідець|нашийник|наповнювач|миск|переноск|амуніц|лежак|кліт|акваріум|ласощ)/,
  ],
  [
    "clinic",
    /(клінік|ветеринар|лікар|огляд|консультац|вакцинац|щеплен|стерилізац|кастрац|операц|узд|аналіз|чіпуванн|прийом)/,
  ],
];

export function detectIntent(question: string): AssistantIntent {
  const q = question.toLowerCase();
  for (const [intent, rule] of INTENT_RULES) if (rule.test(q)) return intent;
  return "unknown";
}

const VISIT_CHECKLIST = [
  "вік і вага тварини",
  "коли почалися симптоми",
  "що тварина їла та пила останнім часом",
  "які ліки вже давали",
  "фото або відео симптомів",
  "документи та історія вакцинації",
  "попередні діагнози, якщо є",
];

const DISCLAIMER_NOTE = "VetNear не замінює консультацію ветеринара.";

function petLine(pet: PetProfile | null): string {
  return pet ? ` Враховую профіль: ${pet.name}.` : "";
}

/** Deterministic, template-based reply for the guided assistant UI. */
export function guidedAnswer(question: string, pet: PetProfile | null): GuidedReply {
  const intent = detectIntent(question);

  switch (intent) {
    case "emergency":
      return {
        intent,
        urgent: true,
        text:
          "Описані ознаки можуть вказувати на невідкладну ситуацію. Будь ласка, " +
          "негайно зателефонуйте до ветеринарної клініки — не чекайте на " +
          "онлайн-поради." + petLine(pet),
        note: DISCLAIMER_NOTE,
        actions: [
          { label: "Відкрити термінову допомогу", href: "/emergency-vet-near-me", tone: "emergency" },
          {
            label: "Показати найближчі ветклініки",
            href: "/nearby?category=veterinary_clinic&sort=distance",
            tone: "ghost",
          },
        ],
      };
    case "checklist":
      return {
        intent,
        urgent: false,
        text: "Ось що варто підготувати до візиту або дзвінка у клініку:",
        checklist: VISIT_CHECKLIST,
        note: DISCLAIMER_NOTE,
        actions: [
          { label: "Показати ветклініки поруч", href: "/nearby?category=veterinary_clinic", tone: "brand" },
        ],
      };
    case "business":
      return {
        intent,
        urgent: false,
        text:
          "Чудово! Додайте свій зообізнес до VetNear безкоштовно — це займає кілька " +
          "хвилин, і власники тварин поруч зможуть вас знаходити.",
        actions: [{ label: "Додати зообізнес безкоштовно", href: "/add-place", tone: "brand" }],
      };
    case "grooming":
      return {
        intent,
        urgent: false,
        text:
          "Стрижка, купання та гігієнічний догляд — це до салонів грумінгу. " +
          "Ось найближчі, запис зазвичай за телефоном." + petLine(pet),
        actions: [{ label: "Показати грумінг поруч", href: "/nearby?category=grooming", tone: "brand" }],
      };
    case "boarding":
      return {
        intent,
        urgent: false,
        text:
          "Якщо потрібно залишити тварину на час поїздки, перегляньте перетримку " +
          "та готелі для тварин поруч. Уточнюйте умови дзвінком." + petLine(pet),
        actions: [
          { label: "Показати перетримку та готелі", href: "/nearby?category=pet_boarding", tone: "brand" },
        ],
      };
    case "pharmacy":
      return {
        intent,
        urgent: false,
        text: "Ліки та ветеринарні засоби найкраще шукати у ветаптеках поруч." + petLine(pet),
        note: "Не давайте препарати без консультації ветеринара.",
        actions: [
          { label: "Показати ветаптеки поруч", href: "/nearby?category=vet_pharmacy", tone: "brand" },
        ],
      };
    case "store":
      return {
        intent,
        urgent: false,
        text: "Корм, амуніцію та аксесуари знайдете у зоомагазинах поруч." + petLine(pet),
        actions: [
          { label: "Показати зоомагазини поруч", href: "/nearby?category=pet_store", tone: "brand" },
        ],
      };
    case "clinic":
      return {
        intent,
        urgent: false,
        text:
          "Схоже, вам потрібна ветеринарна клініка: огляд, консультація, вакцинація " +
          "чи планова процедура. Покажу перевірені клініки поруч." + petLine(pet),
        note: DISCLAIMER_NOTE,
        actions: [
          { label: "Показати ветклініки поруч", href: "/nearby?category=veterinary_clinic", tone: "brand" },
          { label: "Оцінити терміновість", href: "/questionnaire", tone: "ghost" },
        ],
      };
    default:
      return {
        intent: "unknown",
        urgent: false,
        clarify: true,
        text:
          "Підкажіть, будь ласка, що саме ви шукаєте — і я одразу дам посилання на " +
          "потрібний розділ. Оберіть варіант нижче або опишіть запит інакше.",
        actions: [
          { label: "Показати всі послуги поруч", href: "/nearby", tone: "ghost" },
        ],
      };
  }
}
