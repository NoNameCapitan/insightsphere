"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TriageResultCard } from "@/components/TriageResultCard";
import { resolveTriage } from "@/lib/triage/engine";
import { t } from "@/lib/i18n";
import {
  recommendFromAnswers,
  type Duration,
  type Eating,
  type Intent,
  type QuestionnaireAnswers,
  type Symptom,
  type Urgency,
} from "@/lib/questionnaire";

const INTENTS: { key: Intent; label: string }[] = [
  { key: "emergency", label: t.questionnaire.intents.emergency },
  { key: "general", label: t.questionnaire.intents.general },
  { key: "vaccination", label: t.questionnaire.intents.vaccination },
  { key: "food", label: t.questionnaire.intents.food },
  { key: "medicine", label: t.questionnaire.intents.medicine },
  { key: "grooming", label: t.questionnaire.intents.grooming },
];

const URGENCIES: { key: Urgency; label: string }[] = [
  { key: "low", label: t.questionnaire.urgency.low },
  { key: "medium", label: t.questionnaire.urgency.medium },
  { key: "high", label: t.questionnaire.urgency.high },
  { key: "critical", label: t.questionnaire.urgency.critical },
];

const DURATIONS: { key: Duration; label: string }[] = [
  { key: "hours", label: t.questionnaire.duration.hours },
  { key: "day", label: t.questionnaire.duration.day },
  { key: "days", label: t.questionnaire.duration.days },
  { key: "week", label: t.questionnaire.duration.week },
];

const EATINGS: { key: Eating; label: string }[] = [
  { key: "yes", label: t.questionnaire.eating.yes },
  { key: "reduced", label: t.questionnaire.eating.reduced },
  { key: "no", label: t.questionnaire.eating.no },
];

const SYMPTOMS: { key: Symptom; label: string }[] = [
  { key: "bleeding", label: t.questionnaire.symptoms.bleeding },
  { key: "trauma", label: t.questionnaire.symptoms.trauma },
  { key: "vomiting", label: t.questionnaire.symptoms.vomiting },
  { key: "weakness", label: t.questionnaire.symptoms.weakness },
  { key: "breathing", label: t.questionnaire.symptoms.breathing },
  { key: "none", label: t.questionnaire.symptoms.none },
];

const TOTAL_STEPS = 5;

export function Questionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuestionnaireAnswers>({
    intent: "general",
    urgency: null,
    duration: null,
    eating: null,
    symptoms: [],
  });

  // Вільний опис живе тут, щоб нижня CTA і картка результату використовували
  // ОДИН і той самий тріаж-результат (ескалацію за текстом не можна оминути).
  const [freeText, setFreeText] = useState("");

  const reco = recommendFromAnswers(a);
  const triage = resolveTriage(a, freeText);

  function toResults() {
    const p = new URLSearchParams();
    if (reco.category !== "all") p.set("category", reco.category);
    if (reco.emergencyFirst) {
      p.set("emergency", "1");
      p.set("sort", "emergency");
    }
    router.push(`/nearby?${p.toString()}`);
  }

  function toggleSymptom(key: Symptom) {
    setA((prev) => {
      if (key === "none") return { ...prev, symptoms: ["none"] };
      const without = prev.symptoms.filter((s) => s !== "none");
      const next = without.includes(key)
        ? without.filter((s) => s !== key)
        : [...without, key];
      return { ...prev, symptoms: next };
    });
  }

  const Option = ({
    selected,
    onClick,
    children,
  }: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-2xl border px-4 py-3.5 text-left text-base font-semibold transition ${
        selected
          ? "border-brand bg-brand-50 text-brand-700"
          : "border-brand-100 bg-surface hover:border-brand-300"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="container-px py-6">
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-ink/50">
          <span>{step + 1} / {TOTAL_STEPS + 1}</span>
          <button onClick={toResults} className="underline hover:text-brand">
            {t.questionnaire.skip}
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${((step + 1) / (TOTAL_STEPS + 1)) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="text-2xl font-extrabold">{t.questionnaire.title}</h1>
      <p className="mt-1 text-sm text-ink/60">{t.questionnaire.intro}</p>

      <div className="mt-5 space-y-2.5">
        {step === 0 && (
          <>
            <h2 className="text-base font-bold">{t.questionnaire.q_what}</h2>
            {INTENTS.map((o) => (
              <Option
                key={o.key}
                selected={a.intent === o.key}
                onClick={() => setA({ ...a, intent: o.key })}
              >
                {o.label}
              </Option>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-base font-bold">{t.questionnaire.q_urgency}</h2>
            {URGENCIES.map((o) => (
              <Option
                key={o.key}
                selected={a.urgency === o.key}
                onClick={() => setA({ ...a, urgency: o.key })}
              >
                {o.label}
              </Option>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-base font-bold">{t.questionnaire.q_duration}</h2>
            {DURATIONS.map((o) => (
              <Option
                key={o.key}
                selected={a.duration === o.key}
                onClick={() => setA({ ...a, duration: o.key })}
              >
                {o.label}
              </Option>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-base font-bold">{t.questionnaire.q_eating}</h2>
            {EATINGS.map((o) => (
              <Option
                key={o.key}
                selected={a.eating === o.key}
                onClick={() => setA({ ...a, eating: o.key })}
              >
                {o.label}
              </Option>
            ))}
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-base font-bold">{t.questionnaire.q_symptoms}</h2>
            {SYMPTOMS.map((o) => (
              <Option
                key={o.key}
                selected={a.symptoms.includes(o.key)}
                onClick={() => toggleSymptom(o.key)}
              >
                {o.label}
              </Option>
            ))}
          </>
        )}

        {step === TOTAL_STEPS && (
          <TriageResultCard answers={a} freeText={freeText} onFreeTextChange={setFreeText} />
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="btn-ghost flex-1">
            {t.questionnaire.back}
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button onClick={() => setStep((s) => s + 1)} className="btn-brand flex-1">
            {t.questionnaire.next}
          </button>
        ) : (
          <button
            onClick={() => router.push(triage.ctaHref)}
            className={`${triage.level === "emergency_now" ? "btn-emergency" : "btn-brand"} flex-1`}
          >
            {triage.ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
