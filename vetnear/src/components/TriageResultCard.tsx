"use client";
// Картка оцінки терміновості. Рівень показується МИТТЄВО з детермінованого
// движка (клієнтський engine.ts); пояснення від Claude довантажується
// асинхронно через /api/triage і ніколи не змінює рівень. Вільний текст може
// лише ескалувати (той самий urgent-гейт).
//
// freeText — контрольований проп (стан живе у Questionnaire, щоб нижня CTA
// сторінки використовувала той самий результат). Будь-яка зміна тексту скидає
// AI-пояснення: застарілі поради для іншого опису не показуються.

import { useRef, useState } from "react";
import { getActivePet } from "@/lib/pets/store";
import type { QuestionnaireAnswers } from "@/lib/questionnaire";
import {
  FALLBACK_ADVICE,
  LEVEL_META,
  resolveTriage,
} from "@/lib/triage/engine";

const TONE_CLASSES: Record<string, string> = {
  red: "border-red-300 bg-red-50",
  amber: "border-amber-300 bg-amber-50",
  green: "border-emerald-300 bg-emerald-50",
};
const TONE_TITLE: Record<string, string> = {
  red: "text-red-800",
  amber: "text-amber-800",
  green: "text-emerald-800",
};

interface AiState {
  status: "idle" | "loading" | "done" | "error";
  explanation?: string;
  advice?: string[];
}

export function TriageResultCard({
  answers,
  freeText,
  onFreeTextChange,
}: {
  answers: QuestionnaireAnswers;
  freeText: string;
  onFreeTextChange: (value: string) => void;
}) {
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  // Поточний текст — для відсіювання відповідей на застарілі запити.
  // Оновлюється ЛИШЕ в обробнику події (не під час рендеру).
  const currentTextRef = useRef(freeText);

  // Миттєвий детермінований результат; перераховується при зміні тексту.
  const triage = resolveTriage(answers, freeText);
  const meta = LEVEL_META[triage.level];
  const advice = ai.status === "done" && ai.advice ? ai.advice : FALLBACK_ADVICE[triage.level];

  const handleTextChange = (value: string) => {
    currentTextRef.current = value;
    onFreeTextChange(value);
    // Опис змінився — попереднє AI-пояснення більше не відповідає йому.
    if (ai.status !== "idle") setAi({ status: "idle" });
  };

  const askAi = async () => {
    const askedText = freeText;
    setAi({ status: "loading" });
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          freeText: askedText,
          animalType: getActivePet()?.animalType ?? "",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { explanation?: string | null; advice?: string[] };
      // Якщо текст встигли змінити — відповідь застаріла, ігноруємо.
      if (currentTextRef.current !== askedText) return;
      setAi({
        status: "done",
        explanation: data.explanation ?? undefined,
        advice: data.advice,
      });
    } catch {
      if (currentTextRef.current === askedText) setAi({ status: "error" });
    }
  };

  return (
    <div className={`rounded-3xl border p-5 ${TONE_CLASSES[meta.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
        Оцінка терміновості
      </p>
      <p className={`mt-1 text-lg font-extrabold ${TONE_TITLE[meta.tone]}`}>{meta.title}</p>
      <p className="mt-1 text-sm text-ink/70">{meta.subtitle}</p>

      <ul className="mt-3 space-y-1 text-sm text-ink/80">
        {triage.reasons.slice(0, 4).map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>

      <div className="mt-4">
        <label className="text-xs font-semibold text-ink/60">
          Опишіть, що сталося (необовʼязково) — це може підвищити терміновість
        </label>
        <textarea
          value={freeText}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Напр.: зʼїв щось на вулиці годину тому, тепер млявий…"
          className="mt-1 w-full rounded-xl border border-ink/15 bg-white p-2 text-sm"
        />
      </div>

      <div className="mt-3 rounded-2xl bg-white/70 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink/80">Поради до візиту</p>
          <button
            onClick={() => void askAi()}
            disabled={ai.status === "loading"}
            className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
          >
            {ai.status === "loading"
              ? "ШІ думає…"
              : ai.status === "done"
                ? "Оновити пояснення"
                : "Пояснення від ШІ"}
          </button>
        </div>
        {ai.status === "done" && ai.explanation && (
          <p className="mt-2 text-ink/80">{ai.explanation}</p>
        )}
        {ai.status === "error" && (
          <p className="mt-2 text-ink/50">ШІ недоступний — показуємо базові поради.</p>
        )}
        <ul className="mt-2 space-y-1 text-ink/70">
          {advice.map((a) => (
            <li key={a}>• {a}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-ink/50">
        Це не діагноз і не заміна огляду лікаря. За сумнівів — телефонуйте до клініки.
      </p>
    </div>
  );
}
