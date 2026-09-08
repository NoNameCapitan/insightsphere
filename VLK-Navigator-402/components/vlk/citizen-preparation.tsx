"use client";

import { BookOpen, Check, ClipboardCheck, Search, ShieldCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { CommandBrand } from "@/components/vlk/command-brand";
import type { VlkArticle } from "@/lib/vlk-sample-data";
import type { ArticleRule } from "@/lib/vlk-rules";

export const CITIZEN_PREPARATION_CHECKS = [
  "Маю направлення на проходження ВЛК",
  "Зібрав медичні виписки та висновки профільних лікарів",
  "Маю актуальні результати обстежень і досліджень",
  "У документах описані стійкі порушення функцій",
  "Підготував оригінали та копії документів",
] as const;

const PREPARATION_STEPS = [
  { icon: Search, title: "Знайдіть норму", text: "Введіть діагноз, код МКХ-10 або номер статті." },
  { icon: BookOpen, title: "Звірте пункт", text: "Читайте дослівний текст і не обирайте пункт лише за назвою діагнозу." },
  { icon: ClipboardCheck, title: "Підготуйте докази", text: "Висновок залежить від документованих порушень функцій і результатів обстежень." },
] as const;

type CitizenPreparationProps = {
  checked: string[];
  selected?: VlkArticle;
  selectedRule?: ArticleRule;
  onToggle: (item: string, checked: boolean) => void;
};

export function CitizenPreparation({
  checked,
  selected,
  selectedRule,
  onToggle,
}: CitizenPreparationProps) {
  return (
    <aside className="verification-rail relative flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[#b58b35]/25 bg-[#faf8f4] shadow-[var(--shadow-soft)] xl:min-h-0">
      <CommandBrand
        decorative
        size={180}
        className="pointer-events-none absolute -bottom-8 -right-8 opacity-[0.035]"
      />
      <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-white px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c6b63]">
            Режим громадянина
          </p>
          <h2 className="mt-0.5 text-sm font-bold">Підготовка до ВЛК</h2>
        </div>
        <span className="rounded-full bg-[#e8ede8] px-2 py-1 text-[10px] font-bold text-[#1f564f]">
          локально
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
        <div className="rounded-lg border border-[#a8792f]/20 bg-[#fbf5e8] p-2.5 text-[11px] leading-4 text-[#6b5423]">
          Навігатор не встановлює діагноз і не визначає придатність. Він допомагає знайти норму
          та підготувати документи для рішення ВЛК.
        </div>

        <ol className="mt-3 space-y-1.5" aria-label="Етапи підготовки до ВЛК">
          {PREPARATION_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-2.5 rounded-lg border border-[var(--hairline)] bg-white p-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e8ede8] text-[11px] font-black text-[#1f564f]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <step.icon className="size-3.5 text-[#2c6b63]" />
                  {step.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#68766f]">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>

        {selected ? (
          <div className="mt-3 rounded-lg border border-[#2c6b63]/20 bg-[#edf3f0] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c6b63]">
              Відкрита норма
            </p>
            <p className="mt-1 text-xs font-bold">
              Стаття {selected.article}
              {selectedRule && selectedRule.point !== "—" ? ` · пункт «${selectedRule.point}»` : ""}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#55635f]">{selected.title}</p>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#55635f]">
            Мій чекліст
          </p>
          <span className="text-[10px] font-bold text-[#68766f]">
            {checked.length}/{CITIZEN_PREPARATION_CHECKS.length}
          </span>
        </div>
        <div className="mt-1.5 space-y-1.5">
          {CITIZEN_PREPARATION_CHECKS.map((item) => {
            const complete = checked.includes(item);
            return (
              <label
                key={item}
                className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition ${complete ? "border-[#2c6b63]/25 bg-[#edf3f0]" : "border-[var(--hairline)] bg-white"}`}
              >
                <Checkbox
                  checked={complete}
                  onCheckedChange={(value) => onToggle(item, value === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-4">{item}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-[var(--hairline)] bg-white p-3 text-[10px] text-[#68766f]">
        {checked.length === CITIZEN_PREPARATION_CHECKS.length ? (
          <Check className="size-3.5 text-[#2c6b63]" />
        ) : (
          <ShieldCheck className="size-3.5 text-[#2c6b63]" />
        )}
        Дані не надсилаються та зберігаються лише в цьому браузері
      </div>
    </aside>
  );
}
