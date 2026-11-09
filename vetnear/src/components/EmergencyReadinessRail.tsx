"use client";

import Link from "next/link";
import { useRef } from "react";
import { TileIcon } from "@/components/icons/ServiceIcons";

type Scenario = {
  title: string;
  description: string;
  action: string;
  href: string;
  tone: "emergency" | "shelter" | "found" | "health";
  icon: React.ReactNode;
};

const SCENARIOS: Scenario[] = [
  {
    title: "Тварині раптово зле",
    description: "Оцініть терміновість і відкрийте найближчі клініки з можливістю одразу зателефонувати.",
    action: "Знайти допомогу",
    href: "/help",
    tone: "emergency",
    icon: <TileIcon name="emergency" />,
  },
  {
    title: "Повітряна тривога",
    description: "Під час підтвердженої тривоги VetNear активує маршрут до найближчого доступного укриття.",
    action: "Відкрити карту",
    href: "/nearby",
    tone: "shelter",
    icon: <TileIcon name="alert" />,
  },
  {
    title: "Знайшли тварину",
    description: "Перевірте міський реєстр, знайдіть місце для сканування чипа та правильний наступний крок.",
    action: "Що робити",
    href: "/lost-found",
    tone: "found",
    icon: <TileIcon name="pet" />,
  },
  {
    title: "Укус або ризик сказу",
    description: "Окремі маршрути для допомоги людині та ветеринарної оцінки тварини — без небезпечного змішування.",
    action: "Переглянути інструкцію",
    href: "/kyiv-updates",
    tone: "health",
    icon: <TileIcon name="shield" />,
  },
];

export function EmergencyReadinessRail() {
  const railRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-4" aria-labelledby="readiness-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-brand-700">Готові сценарії</p>
          <h2 id="readiness-title" className="mt-1 font-display text-2xl font-bold text-ink">
            Коли важлива кожна хвилина
          </h2>
        </div>
        <div className="hidden items-center gap-2 sm:flex" aria-label="Прокрутити сценарії">
          <button type="button" className="rail-control" onClick={() => scroll(-1)} aria-label="Попередні сценарії">
            ‹
          </button>
          <button type="button" className="rail-control" onClick={() => scroll(1)} aria-label="Наступні сценарії">
            ›
          </button>
        </div>
      </div>

      <div ref={railRef} className="readiness-rail mt-5" tabIndex={0} aria-label="Швидкі сценарії VetNear">
        {SCENARIOS.map((scenario) => (
          <Link key={scenario.title} href={scenario.href} className={`readiness-card readiness-card--${scenario.tone}`}>
            <span className="readiness-card__glow" aria-hidden />
            <span className="readiness-card__icon icon3d">{scenario.icon}</span>
            <span className="relative z-10 mt-auto block">
              <strong className="block font-display text-lg leading-tight text-ink">{scenario.title}</strong>
              <span className="mt-2 block text-sm leading-5 text-ink/65">{scenario.description}</span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-current">
                {scenario.action}<span aria-hidden>›</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink/45 sm:hidden">Проведіть убік, щоб побачити всі сценарії.</p>
    </section>
  );
}
