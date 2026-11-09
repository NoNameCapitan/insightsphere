"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Disclaimer } from "@/components/JsonLd";
import { PawIcon } from "@/components/icons/ServiceIcons";
import { track } from "@/lib/analytics";
import { guidedAnswer, type GuidedAction, type GuidedReply } from "@/lib/assistant";
import { getActivePet } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

interface Turn {
  q: string;
  reply: GuidedReply;
}

/** Small "thinking" pause so replies feel conversational, not instant. */
const TYPING_MS = 450;

const CHIPS = [
  "Знайти ветклініку",
  "Терміново",
  "Ветаптека",
  "Зоомагазин",
  "Грумінг",
  "Перетримка",
  "Як додати бізнес?",
  "Що підготувати до візиту?",
];

const ACTION_TONE: Record<GuidedAction["tone"], string> = {
  brand: "bg-brand text-white hover:bg-brand-600",
  emergency: "bg-emergency text-white hover:bg-emergency-600",
  ghost: "border border-brand-200 bg-surface text-ink/80 hover:border-brand hover:text-brand",
};

export default function AssistantPage() {
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<number | undefined>(undefined);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setPet(getActivePet()), []);
  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    if (turns.length === 0 && !typing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [turns, typing]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || typing) return;
    track("pet_assistant_question_asked", { hasPet: !!pet });
    setInput("");
    setTyping(true);
    typingTimer.current = window.setTimeout(() => {
      const reply = guidedAnswer(q, pet);
      if (reply.urgent) track("emergency_recommendation_shown");
      setTurns((t) => [...t, { q, reply }]);
      setTyping(false);
    }, TYPING_MS);
  };

  return (
    <div className="container-px mx-auto max-w-2xl py-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand-100 bg-brand-50"
        >
          <PawIcon className="h-8 w-8" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">ШІ-асистент</h1>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            Безпечний навігаційний помічник
          </span>
        </div>
      </div>
      <p className="mt-2 text-ink/60">
        Допомагає знайти послугу поруч, але не ставить діагнози. Працює локально,
        без передавання ваших запитів стороннім сервісам.
      </p>

      <div className="mt-4">
        <Disclaimer text="Я не ставлю діагнозів і не замінюю ветеринара. У невідкладних випадках одразу телефонуйте до клініки." />
      </div>

      <Link
        href="/questionnaire"
        className="mt-3 flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-ink hover:border-brand"
      >
        <span><b>Тварині нездужається?</b> Пройдіть оцінку терміновості</span>
        <span aria-hidden className="text-brand">→</span>
      </Link>

      {pet ? (
        <p className="mt-3 text-sm text-brand">Активний улюбленець: {pet.name}</p>
      ) : (
        <p className="mt-3 text-sm text-ink/60">
          <Link href="/my-pets/new" className="text-brand hover:underline">Додайте улюбленця</Link>{" "}
          для точніших підказок.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {/* Greeting — always the first assistant bubble. */}
        <div className="w-fit max-w-[90%] rounded-2xl border border-brand-100 bg-surface px-4 py-3 text-sm text-ink/80">
          <p>
            Вітаю! Я ШІ-асистент VetNear 🐾 Підкажу, куди звернутися: ветклініка,
            ветаптека, зоомагазин, грумінг чи перетримка — і покажу заклади поруч.
            Опишіть, що потрібно, або оберіть підказку нижче.
          </p>
        </div>

        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-brand px-4 py-2 text-sm text-white">
              {t.q}
            </p>
            <div
              className={`w-fit max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                t.reply.urgent
                  ? "border border-emergency/20 bg-emergency-50 text-emergency-700"
                  : "border border-brand-100 bg-surface text-ink/80"
              }`}
            >
              <p>{t.reply.text}</p>
              {t.reply.checklist && (
                <ul className="mt-2 space-y-1">
                  {t.reply.checklist.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <span aria-hidden className="text-brand">✓</span> {item}
                    </li>
                  ))}
                </ul>
              )}
              {t.reply.actions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {t.reply.actions.map((a) => (
                    <Link
                      key={a.href + a.label}
                      href={a.href}
                      className={`inline-block rounded-full px-3.5 py-2 text-xs font-semibold transition ${ACTION_TONE[a.tone]}`}
                    >
                      {a.label} →
                    </Link>
                  ))}
                </div>
              )}
              {t.reply.note && (
                <p className={`mt-2 text-[11px] ${t.reply.urgent ? "text-emergency-700/80" : "text-ink/45"}`}>
                  {t.reply.note}
                </p>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="w-fit rounded-2xl border border-brand-100 bg-surface px-4 py-3 text-sm text-ink/50">
            Асистент друкує…
          </div>
        )}
        <div ref={endRef} aria-hidden />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className="rounded-full border border-brand-100 bg-surface px-3 py-1.5 text-sm text-ink/70 transition hover:border-brand hover:text-brand"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-0 mt-4 flex gap-2 bg-canvas/95 py-3 backdrop-blur"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Ваше запитання
        </label>
        <input
          id="assistant-input"
          className="min-w-0 flex-1 rounded-2xl border border-brand-100 px-4 py-3 text-ink"
          placeholder="Опишіть, що потрібно, — наприклад: «стрижка для собаки»"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-brand px-5" disabled={typing}>
          Надіслати
        </button>
      </form>
    </div>
  );
}
