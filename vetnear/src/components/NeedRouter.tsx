"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { hasPhoneConfirmedEmergency, SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";
import { PLACES } from "@/lib/data/places";
import { getActivePet } from "@/lib/pets/store";
import type { AnimalType, PetProfile, PlaceCategory } from "@/lib/types";

const DISCLAIMER =
  "VetNear не ставить діагнози і не замінює ветеринара. Ми допомагаємо швидко знайти відповідний сервіс поруч.";

const link = (category: PlaceCategory) => `/nearby?category=${category}&sort=distance`;

const PUBLIC_COUNT = PLACES.reduce<Partial<Record<PlaceCategory, number>>>((m, p) => {
  if (isSearchablePublicPlace(p)) m[p.category] = (m[p.category] ?? 0) + 1;
  return m;
}, {});

const EXOTIC: AnimalType[] = ["reptile", "bird", "rodent", "exotic", "other"];

type Step = "root" | "vet" | "urgent" | "buy" | "grooming" | "boarding" | "shelter" | "unknown";

const NEEDS: { step: Step; emoji: string; label: string }[] = [
  { step: "vet", emoji: "🩺", label: "Потрібен ветеринар" },
  { step: "urgent", emoji: "🚑", label: "Термінова ситуація" },
  { step: "buy", emoji: "🛒", label: "Купити корм / ліки / товари" },
  { step: "grooming", emoji: "✂️", label: "Грумінг" },
  { step: "boarding", emoji: "🏠", label: "Перетримка / готель" },
  { step: "shelter", emoji: "🐾", label: "Притулок / допомога тварині" },
  { step: "unknown", emoji: "❓", label: "Не знаю, куди звернутися" },
];

const NO_DATA_NOTE = "Поки немає перевірених закладів цієї категорії — показуємо порожній список чесно.";

function Action({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={
        variant === "primary"
          ? "btn btn-brand w-full"
          : "btn btn-ghost w-full border border-brand-100"
      }
    >
      {label} →
    </Link>
  );
}

function Block({
  title,
  tone = "brand",
  children,
}: {
  title: string;
  tone?: "brand" | "emergency";
  children: React.ReactNode;
}) {
  const emergency = tone === "emergency";
  return (
    <div
      className={`space-y-3 rounded-3xl border p-5 text-sm ${
        emergency
          ? "border-emergency/30 bg-emergency-50 text-emergency-700"
          : "border-brand-100 bg-surface text-ink/75"
      }`}
    >
      <h2 className={`font-display text-lg font-bold ${emergency ? "text-emergency-700" : "text-ink"}`}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white/70 px-3 py-2 text-xs text-ink/70">{children}</p>;
}

export function NeedRouter() {
  const [step, setStep] = useState<Step>("root");
  const [pet, setPet] = useState<PetProfile | null>(null);
  useEffect(() => setPet(getActivePet()), []);

  const exotic = pet ? EXOTIC.includes(pet.animalType) : false;
  const exoticNote = exotic
    ? "Для екзотичних тварин спершу зателефонуйте — не всі заклади їх приймають."
    : null;

  const choose = (next: Step) => {
    track("nearby_search_started", { need: next });
    setStep(next);
  };

  return (
    <div>
      <div className="rounded-2xl border border-amber/30 bg-amber/5 px-4 py-3 text-xs text-ink/70">
        ⚠️ {DISCLAIMER}
      </div>

      {pet && (
        <p className="mt-3 text-sm text-brand">
          Активний улюбленець: {pet.name}
          {exotic ? " — екзотичний вид, телефонуйте заздалегідь" : ""}
        </p>
      )}

      {/* Step 1 — choose a need (option cards only, no result cards mixed in). */}
      {step === "root" ? (
        <div className="mt-4 space-y-2.5">
          {NEEDS.map((n) => (
            <button
              key={n.step}
              onClick={() => choose(n.step)}
              className="card flex w-full items-center gap-3 p-4 text-left transition hover:border-brand-300 active:scale-[0.99]"
            >
              <span aria-hidden className="text-2xl">{n.emoji}</span>
              <span className="font-medium text-ink">{n.label}</span>
              <span aria-hidden className="ml-auto text-brand">→</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <button onClick={() => setStep("root")} className="text-sm text-brand hover:underline">
            ← Інша ситуація
          </button>

          {/* Step 2 — exactly one recommendation block. */}
          <div className="mt-3">
            {step === "vet" && (
              <Block title="Потрібен ветеринар">
                <p>Покажемо найближчі ветклініки, відсортовані за відстанню. Перед візитом зателефонуйте.</p>
                {exoticNote && <Note>{exoticNote}</Note>}
                <Action href={link("veterinary_clinic")} label="Показати найближчі ветклініки" />
                <Action href="/questionnaire" label="Не впевнені, наскільки терміново? Оцінка терміновості" variant="secondary" />
              </Block>
            )}

            {step === "urgent" && (
              <Block title="Термінова ситуація" tone="emergency">
                <p>
                  Якщо є загроза життю (кровотеча, утруднене дихання, отруєння, судоми, травма) —
                  <strong> телефонуйте у клініку напряму вже зараз</strong> і їдьте до найближчої.
                </p>
                {!hasPhoneConfirmedEmergency(PLACES) && (
                  <Note>
                    У цій версії VetNear показує найближчі ветклініки. Цілодобові/термінові
                    провайдери додаються тільки після підтвердження дзвінком.
                  </Note>
                )}
                <Link href={SAFE_EMERGENCY_CTA_HREF} className="btn btn-emergency w-full">
                  Показати найближчі ветклініки →
                </Link>
              </Block>
            )}

            {step === "buy" && (
              <Block title="Купити корм / ліки / товари">
                <p>Корми й аксесуари — у зоомагазинах; ветпрепарати — у ветаптеках.</p>
                {exoticNote && <Note>{exoticNote}</Note>}
                <Action href={link("pet_store")} label="Корм і товари — зоомагазини поруч" />
                {PUBLIC_COUNT.vet_pharmacy ? (
                  <Action href={link("vet_pharmacy")} label="Ліки — ветаптеки поруч" variant="secondary" />
                ) : null}
              </Block>
            )}

            {step === "grooming" && (
              <Block title="Грумінг">
                <p>Покажемо салони грумінгу поруч. Запис зазвичай за телефоном.</p>
                <Action href={link("grooming")} label="Показати грумінг поруч" />
              </Block>
            )}

            {step === "boarding" && (
              <Block title="Перетримка / готель">
                <p>Покажемо готелі й перетримку для тварин поруч. Деталі уточнюйте за телефоном.</p>
                <Action href={link("pet_boarding")} label="Показати перетримку поруч" />
              </Block>
            )}

            {step === "shelter" && (
              <Block title="Притулок / допомога тварині">
                <p>Покажемо притулки та зоозахисні організації поруч.</p>
                {!PUBLIC_COUNT.shelter && <Note>{NO_DATA_NOTE}</Note>}
                <Action href={link("shelter")} label="Показати притулки поруч" />
              </Block>
            )}

            {step === "unknown" && (
              <Block title="Оберіть, що найближче до вашої ситуації">
                <p>Це не діагноз — лише підкаже, який тип закладу шукати.</p>
                {exoticNote && <Note>{exoticNote}</Note>}
                <Action href="/questionnaire" label="Тварині нездужається — оцінка терміновості" />
                <Action href={link("veterinary_clinic")} label="Здоровʼя/поведінка — до ветеринара" variant="secondary" />
                <Action href={link("pet_store")} label="Потрібно щось купити — зоомагазини" variant="secondary" />
                <Action href={link("grooming")} label="Догляд за шерстю/кігтями — грумінг" variant="secondary" />
                <Action href={link("pet_boarding")} label="Поїздка/немає з ким лишити — перетримка" variant="secondary" />
              </Block>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
