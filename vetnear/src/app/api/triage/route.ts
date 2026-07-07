import { NextResponse } from "next/server";
import {
  FALLBACK_ADVICE,
  LEVEL_META,
  resolveTriage,
  type TriageLevel,
} from "@/lib/triage/engine";
import type { QuestionnaireAnswers } from "@/lib/questionnaire";
import {
  clientKeyFromRequest,
  createServerRateLimiter,
} from "@/lib/security/serverRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const limit = createServerRateLimiter({ limit: 10, windowMs: 60_000 });

interface TriageRequestBody {
  answers?: QuestionnaireAnswers;
  freeText?: string;
  animalType?: string;
}

// ── Claude: пояснення + поради. НЕ рішення. ─────────────────────────────────
function buildSystem(level: TriageLevel): string {
  return [
    "Ти — асистент сервісу VetNear (Київ). Рівень терміновості ВЖЕ ВИЗНАЧЕНО",
    `детермінованими правилами: "${LEVEL_META[level].title}". Ти НЕ можеш його змінити.`,
    "Твоє завдання: 2–3 речення пояснення українською, чому такий рівень розумний,",
    "і 3 короткі поради догляду ДО візиту до лікаря.",
    "СУВОРО ЗАБОРОНЕНО: ставити діагнози, називати хвороби як факт, радити ліки",
    "чи дозування, применшувати терміновість, радити «почекати» при невідкладному рівні.",
    'Відповідай ТІЛЬКИ JSON без markdown: {"explanation": string, "advice": [string, string, string]}',
  ].join(" ");
}

async function askClaudeForExplanation(
  apiKey: string,
  level: TriageLevel,
  answers: QuestionnaireAnswers,
  freeText: string,
  animalType: string,
): Promise<{ explanation: string; advice: string[] } | null> {
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 400,
        system: buildSystem(level),
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              animalType: animalType.slice(0, 30),
              answers,
              description: freeText.slice(0, 600),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(text) as { explanation?: unknown; advice?: unknown };
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation.slice(0, 800) : "";
    const advice = Array.isArray(parsed.advice)
      ? parsed.advice.filter((x): x is string => typeof x === "string").slice(0, 3).map((s) => s.slice(0, 200))
      : [];
    if (!explanation || advice.length === 0) return null;
    return { explanation, advice };
  } catch {
    return null; // будь-який збій LLM → детермінований fallback
  }
}

export async function POST(req: Request): Promise<Response> {
  const rl = limit(clientKeyFromRequest(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато запитів. Спробуйте за хвилину." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: TriageRequestBody;
  try {
    body = (await req.json()) as TriageRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answers: QuestionnaireAnswers = {
    intent: body.answers?.intent ?? "general",
    urgency: body.answers?.urgency ?? null,
    duration: body.answers?.duration ?? null,
    eating: body.answers?.eating ?? null,
    symptoms: Array.isArray(body.answers?.symptoms) ? body.answers.symptoms.slice(0, 10) : [],
  };
  const freeText = typeof body.freeText === "string" ? body.freeText.slice(0, 1000) : "";
  const animalType = typeof body.animalType === "string" ? body.animalType : "";

  // 1) Детерміноване рішення — ЄДИНЕ джерело рівня.
  const triage = resolveTriage(answers, freeText);

  // 2) Опційне AI-пояснення. Рівень з відповіді LLM ІГНОРУЄТЬСЯ за побудовою:
  //    ми беремо лише explanation/advice, level завжди triage.level.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ai = apiKey
    ? await askClaudeForExplanation(apiKey, triage.level, answers, freeText, animalType)
    : null;

  return NextResponse.json({
    level: triage.level,
    title: LEVEL_META[triage.level].title,
    subtitle: LEVEL_META[triage.level].subtitle,
    reasons: triage.reasons,
    ctaHref: triage.ctaHref,
    ctaLabel: triage.ctaLabel,
    explanation: ai?.explanation ?? null,
    advice: ai?.advice ?? FALLBACK_ADVICE[triage.level],
    aiUsed: Boolean(ai),
    disclaimer:
      "Це не діагноз і не заміна огляду лікаря. За сумнівів — телефонуйте до клініки.",
  });
}
