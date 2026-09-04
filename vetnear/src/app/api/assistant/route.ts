import { NextResponse } from "next/server";
import {
  ASSISTANT_SYSTEM_PROMPT,
  mockProvider,
  routeSuggestion,
  type AssistantReply,
} from "@/lib/assistant";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/labels";
import type { PetProfile } from "@/lib/types";
import {
  clientKeyFromRequest,
  createServerRateLimiter,
} from "@/lib/security/serverRateLimit";

// Server-only route. Reads ANTHROPIC_API_KEY from the server environment.
// The key must NEVER be exposed to the client (no NEXT_PUBLIC_).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real server-side rate limit — this route spends Anthropic API credits.
// 10 requests / minute / IP; module-level so the window survives requests.
const checkAssistantRateLimit = createServerRateLimiter({
  limit: 10,
  windowMs: 60_000,
});

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Categories the assistant may route to (emergency handled separately, safety-first).
const CATEGORY_HINT = ALL_CATEGORIES.filter((c) => c !== "emergency_vet")
  .map((c) => CATEGORY_LABELS[c])
  .join(", ");

// Only trust a small, sanitized slice of the pet profile.
function sanitizePet(raw: unknown): PetProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== "string" || typeof p.animalType !== "string") return null;
  return {
    id: typeof p.id === "string" ? p.id : "tmp",
    name: p.name.slice(0, 60),
    animalType: p.animalType as PetProfile["animalType"],
    breed: typeof p.breed === "string" ? p.breed.slice(0, 60) : undefined,
    preferredDistrict: typeof p.preferredDistrict === "string" ? (p.preferredDistrict as PetProfile["preferredDistrict"]) : undefined,
    createdAt: "",
    updatedAt: "",
  };
}

function buildSystem(pet: PetProfile | null): string {
  return [
    ASSISTANT_SYSTEM_PROMPT,
    "",
    "Answer in Ukrainian by default. Keep it short and practical (max ~4 sentences).",
    "Cover, briefly: (1) the likely VetNear service category to search; (2) what to prepare before calling or visiting; (3) if symptoms are urgent or worrying, tell them to contact a veterinarian immediately.",
    "Do NOT give a diagnosis, medication names, dosages, or a treatment plan. Do NOT guarantee emergency availability.",
    "End with a short reminder that VetNear does not replace a veterinarian.",
    "",
    "VetNear context:",
    `- Available service categories: ${CATEGORY_HINT}.`,
    pet
      ? `- Active pet: ${pet.name}, type: ${pet.animalType}${pet.breed ? `, breed: ${pet.breed}` : ""}${pet.preferredDistrict ? `, preferred district: ${pet.preferredDistrict}` : ""}.`
      : "- No pet profile selected.",
    "- Safety rule: emergency / 24-7 providers are shown only after phone confirmation; otherwise route to the nearest vet clinics.",
  ].join("\n");
}

async function askClaude(apiKey: string, question: string, pet: PetProfile | null): Promise<string | null> {
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
        system: buildSystem(pet),
        messages: [{ role: "user", content: question }],
      }),
    });
    if (!res.ok) {
      console.error(`Anthropic request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text || "").join("\n").trim()
      : "";
    return text || null;
  } catch (error) {
    console.error("Anthropic call error:", error);
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  // Rate limit BEFORE any parsing or model calls.
  const rl = checkAssistantRateLimit(clientKeyFromRequest(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато запитів. Спробуйте за хвилину." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { question: rawQuestion, pet: rawPet } = (body ?? {}) as { question?: unknown; pet?: unknown };
  const question = typeof rawQuestion === "string" ? rawQuestion.trim().slice(0, 1000) : "";
  if (!question) return NextResponse.json({ error: "Empty question" }, { status: 400 });

  const pet = sanitizePet(rawPet);

  // Deterministic base: urgent classification + routing are ALWAYS rule-based.
  const base = mockProvider.answer(question, pet);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Urgent → never call the model; return the safe deterministic message.
  // No key → demo fallback.
  if (base.urgent || !apiKey) {
    const reply: AssistantReply = { ...base, demoMode: !apiKey };
    return NextResponse.json(reply);
  }

  // Non-urgent with a key: let Claude write the text, keep the rule-based suggestion.
  const text = await askClaude(apiKey, question, pet);
  const reply: AssistantReply = text
    ? { text, urgent: false, suggestion: routeSuggestion(question), demoMode: false }
    : { ...base, demoMode: false }; // key present but call failed → safe rule-based text

  return NextResponse.json(reply);
}
