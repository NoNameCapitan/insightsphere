"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PetProfileForm } from "@/components/PetProfileForm";
import { GeneratedVisual } from "@/components/GeneratedVisual";
import { PetProfileIcon, VerifiedIcon } from "@/components/icons/ServiceIcons";
import { DocumentIcon, ReminderIcon, TreatmentIcon, VaccinationIcon, VisitIcon, WeightIcon } from "@/components/icons/MedicalIcons";
import { ANIMAL_LABELS } from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { getPet, toggleReminder } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

const TABS = ["Огляд", "Вакцинації", "Обробки", "Візити", "Вага", "Документи"] as const;
type Tab = (typeof TABS)[number];

function formatDate(value?: string) {
  if (!value) return "Не вказано";
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function WeightChart({ entries }: { entries: NonNullable<PetProfile["weightHistory"]> }) {
  const values = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
  if (values.length < 2) return <p className="text-sm text-ink/50">Додайте щонайменше два записи — тут зʼявиться графік зміни ваги.</p>;
  const min = Math.min(...values.map((item) => item.weightKg));
  const max = Math.max(...values.map((item) => item.weightKg));
  const range = Math.max(max - min, 0.5);
  const points = values.map((item, index) => `${12 + index * (276 / (values.length - 1))},${74 - ((item.weightKg - min) / range) * 48}`).join(" ");
  return <div>
    <svg viewBox="0 0 300 88" className="h-28 w-full" role="img" aria-label="Графік ваги">
      <path d="M12 74H288" stroke="#DDE7E2" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#126E66" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle key={values[index].id} cx={cx} cy={cy} r="4" fill="#fff" stroke="#126E66" strokeWidth="2" />; })}
    </svg>
    <div className="flex justify-between text-xs text-ink/45"><span>{formatDate(values[0].date)}</span><strong className="text-ink">{values.at(-1)?.weightKg} кг</strong><span>{formatDate(values.at(-1)?.date)}</span></div>
  </div>;
}

export default function PetDetailPage() {
  const params = useParams<{ id: string }>();
  const [pet, setPet] = useState<PetProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("Огляд");
  const [shared, setShared] = useState(false);
  const refresh = () => setPet(getPet(params.id));
  useEffect(refresh, [params.id]);

  const timeline = useMemo(() => {
    if (!pet) return [];
    return [
      ...(pet.vaccinations ?? []).map((item) => ({ id: item.id, date: item.date, title: item.name, meta: item.clinicName || "Вакцинація", type: "vaccination" as const })),
      ...(pet.treatments ?? []).map((item) => ({ id: item.id, date: item.date, title: item.name, meta: item.kind === "deworming" ? "Протиглисна обробка" : "Захист від бліх і кліщів", type: "treatment" as const })),
      ...(pet.visits ?? []).map((item) => ({ id: item.id, date: item.date, title: item.reason, meta: item.clinicName || "Візит до ветеринара", type: "visit" as const })),
      ...(pet.documents ?? []).map((item) => ({ id: item.id, date: item.date, title: item.title, meta: "Документ", type: "document" as const })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [pet]);

  if (pet === undefined) return <div className="container-px py-12 text-center text-ink/45">Завантажуємо медкартку…</div>;
  if (pet === null) return <div className="container-px py-12 text-center"><p className="text-ink/55">Медкартку не знайдено.</p><Link href="/my-pets" className="btn btn-brand mt-4">До моїх тварин</Link></div>;

  const favoriteClinic = PLACES.find((place) => place.id === pet.favoriteClinicId);
  const upcoming = [
    ...(pet.vaccinations ?? []).flatMap((item) => item.nextDate ? [{ date: item.nextDate, title: `Вакцинація · ${item.name}` }] : []),
    ...(pet.treatments ?? []).flatMap((item) => item.nextDate ? [{ date: item.nextDate, title: item.kind === "deworming" ? "Протиглисна обробка" : "Захист від бліх і кліщів" }] : []),
    ...(pet.reminders ?? []).filter((item) => !item.completed).map((item) => ({ date: item.date, title: item.title })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const shareRecord = async () => {
    const text = `${pet.name} · медична картка VetNear. ${ANIMAL_LABELS[pet.animalType]}${pet.microchipNumber ? ` · мікрочип ${pet.microchipNumber}` : ""}`;
    if (navigator.share) await navigator.share({ title: `Медкартка ${pet.name}`, text });
    else await navigator.clipboard.writeText(text);
    setShared(true);
    window.setTimeout(() => setShared(false), 2000);
  };

  const recordCount = (pet.vaccinations?.length ?? 0) + (pet.treatments?.length ?? 0) + (pet.visits?.length ?? 0) + (pet.documents?.length ?? 0);

  return (
    <main className="container-px mx-auto max-w-3xl py-7 print:max-w-none print:bg-white">
      <div className="flex items-center justify-between print:hidden"><Link href="/my-pets" className="text-sm font-medium text-brand hover:underline">Мої тварини</Link><span className="text-xs text-ink/40">Приватна картка на цьому пристрої</span></div>

      <header className="relative mt-4 overflow-hidden rounded-3xl border border-brand-100 bg-white p-5 shadow-card sm:p-6">
        <div className="grid items-start gap-4">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-brand-100 bg-brand-50">
            {pet.photoUrl ? <Image unoptimized src={pet.photoUrl} alt="" width={80} height={80} className="h-full w-full object-cover" /> : <PetProfileIcon className="h-full w-full p-2" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold text-ink">{pet.name}</h1>
            <p className="mt-1 text-sm text-ink/55">{ANIMAL_LABELS[pet.animalType]}{pet.breed ? ` · ${pet.breed}` : ""}{pet.ageYears != null ? ` · ${pet.ageYears} р.` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">{pet.weightKg ? `${pet.weightKg} кг` : "Вага не вказана"}</span>{pet.microchipNumber && <span className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-ink/60">Чип {pet.microchipNumber}</span>}<span className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-ink/60">{recordCount} записів</span></div>
          </div>
        </div>
        <GeneratedVisual src="/visuals/e-medical-record.webp" className="h-28 w-full sm:h-40" motion="float" glow shine sizes="(max-width: 640px) 92vw, 720px" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 print:hidden">
          <button type="button" onClick={() => { void shareRecord(); }} className="btn btn-ghost py-2.5 text-sm">{shared ? "Скопійовано" : "Поділитися"}</button>
          <button type="button" onClick={() => window.print()} className="btn btn-ghost py-2.5 text-sm">Експорт PDF</button>
        </div>
      </header>

      <section className="mt-4 rounded-3xl border border-brand-100 bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3"><ReminderIcon className="h-12 w-12 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">Потребує уваги</p>{upcoming.length ? <div className="mt-2 space-y-2">{upcoming.slice(0, 2).map((item) => <div key={`${item.date}-${item.title}`} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-ink/65">{item.title}</span><span className="shrink-0 font-semibold text-brand-700">{formatDate(item.date)}</span></div>)}</div> : <p className="mt-1 text-sm text-ink/50">Додайте наступну вакцинацію, обробку або нагадування.</p>}</div></div>
        <Link href={`/my-pets/${pet.id}/records/new`} className="btn btn-brand mt-4 w-full py-3">Додати запис</Link>
      </section>

      <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-brand-100 bg-white p-1 print:hidden" aria-label="Розділи медкартки">
        {TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${tab === item ? "bg-brand text-white" : "text-ink/55 hover:bg-brand-50 hover:text-brand"}`}>{item}</button>)}
      </nav>

      {(tab === "Огляд" || typeof window === "undefined") && <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl border border-brand-100 bg-white p-5 sm:col-span-2"><div className="flex items-center gap-3"><DocumentIcon className="h-11 w-11" /><div><h2 className="font-display text-lg font-bold text-ink">Медичне резюме</h2><p className="text-xs text-ink/45">Ключове перед зверненням до лікаря</p></div></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><SummaryField label="Алергії" value={pet.allergies} /><SummaryField label="Хронічні стани" value={pet.importantNotes} /><SummaryField label="Для невідкладної ситуації" value={pet.emergencyNote} /></dl></section>
        <section className="rounded-3xl border border-brand-100 bg-white p-5"><div className="flex items-center gap-3"><WeightIcon className="h-11 w-11" /><div><h2 className="font-display text-lg font-bold text-ink">Вага</h2><p className="text-xs text-ink/45">Останні вимірювання</p></div></div><div className="mt-3"><WeightChart entries={pet.weightHistory ?? []} /></div></section>
        <section className="rounded-3xl border border-brand-100 bg-white p-5"><div className="flex items-center gap-3"><VerifiedIcon className="h-11 w-11" /><div><h2 className="font-display text-lg font-bold text-ink">Улюблена клініка</h2><p className="text-xs text-ink/45">Швидкий контакт</p></div></div>{favoriteClinic ? <div className="mt-4"><p className="font-semibold text-ink">{favoriteClinic.name}</p><p className="mt-1 text-sm text-ink/55">{favoriteClinic.address}</p><div className="mt-3 flex gap-2"><a href={`tel:${favoriteClinic.phone}`} className="btn btn-brand flex-1 py-2 text-sm">Зателефонувати</a><Link href={`/place/${favoriteClinic.slug}`} className="btn btn-ghost py-2 text-sm">Профіль</Link></div></div> : <p className="mt-4 text-sm leading-6 text-ink/50">Оберіть клініку в налаштуваннях картки або додайте заклад до обраного.</p>}</section>
        <section className="rounded-3xl border border-brand-100 bg-white p-5 sm:col-span-2"><div className="flex items-center gap-3"><VisitIcon className="h-11 w-11" /><div><h2 className="font-display text-lg font-bold text-ink">Останні записи</h2><p className="text-xs text-ink/45">Медична історія за датою</p></div></div><Timeline items={timeline.slice(0, 6)} /></section>
      </div>}

      {tab === "Вакцинації" && <RecordSection icon={<VaccinationIcon className="h-12 w-12" />} title="Вакцинації" empty="Додайте першу вакцинацію та наступну дату." items={(pet.vaccinations ?? []).map((item) => ({ id: item.id, title: item.name, date: item.date, meta: [item.clinicName, item.nextDate ? `Наступна: ${formatDate(item.nextDate)}` : null].filter(Boolean).join(" · ") }))} addHref={`/my-pets/${pet.id}/records/new?type=vaccination`} />}
      {tab === "Обробки" && <RecordSection icon={<TreatmentIcon className="h-12 w-12" />} title="Обробки" empty="Додайте протиглисну обробку або захист від кліщів." items={(pet.treatments ?? []).map((item) => ({ id: item.id, title: item.name, date: item.date, meta: `${item.kind === "deworming" ? "Від глистів" : "Блохи й кліщі"}${item.nextDate ? ` · Наступна: ${formatDate(item.nextDate)}` : ""}` }))} addHref={`/my-pets/${pet.id}/records/new?type=treatment`} />}
      {tab === "Візити" && <RecordSection icon={<VisitIcon className="h-12 w-12" />} title="Візити" empty="Після першого візиту тут зʼявиться медична timeline." items={(pet.visits ?? []).map((item) => ({ id: item.id, title: item.reason, date: item.date, meta: [item.clinicName, item.outcome].filter(Boolean).join(" · ") }))} addHref={`/my-pets/${pet.id}/records/new?type=visit`} />}
      {tab === "Вага" && <RecordSection icon={<WeightIcon className="h-12 w-12" />} title="Історія ваги" empty="Додайте перше вимірювання." items={(pet.weightHistory ?? []).map((item) => ({ id: item.id, title: `${item.weightKg} кг`, date: item.date, meta: "Вимірювання" }))} addHref={`/my-pets/${pet.id}/records/new?type=weight`} />}
      {tab === "Документи" && <RecordSection icon={<DocumentIcon className="h-12 w-12" />} title="Документи" empty="Завантажте фото ветпаспорта, довідки або результату." items={(pet.documents ?? []).map((item) => ({ id: item.id, title: item.title, date: item.date, meta: item.fileName || "Документ", href: item.dataUrl }))} addHref={`/my-pets/${pet.id}/records/new?type=document`} />}

      <div className="mt-5 hidden space-y-5 print:block">
        <PrintGroup title="Вакцинації" items={(pet.vaccinations ?? []).map((item) => `${formatDate(item.date)} — ${item.name}${item.clinicName ? ` · ${item.clinicName}` : ""}`)} />
        <PrintGroup title="Обробки" items={(pet.treatments ?? []).map((item) => `${formatDate(item.date)} — ${item.name}`)} />
        <PrintGroup title="Візити" items={(pet.visits ?? []).map((item) => `${formatDate(item.date)} — ${item.reason}${item.outcome ? ` · ${item.outcome}` : ""}`)} />
        <PrintGroup title="Документи" items={(pet.documents ?? []).map((item) => `${formatDate(item.date)} — ${item.title}`)} />
      </div>

      <section className="mt-5 rounded-3xl border border-brand-100 bg-white p-5 print:hidden"><details><summary className="cursor-pointer font-semibold text-brand">Налаштування медкартки</summary><div className="mt-5"><PetProfileForm existing={pet} /></div></details></section>
      <div className="mt-5 grid grid-cols-2 gap-3 print:hidden"><Link href="/nearby" className="btn btn-brand">Знайти допомогу</Link><Link href={`/my-pets/${pet.id}/records/new?type=reminder`} className="btn btn-ghost">Нагадування</Link></div>

      {(pet.reminders ?? []).length > 0 && <section className="mt-5 rounded-3xl border border-brand-100 bg-white p-5 print:hidden"><h2 className="font-display text-lg font-bold text-ink">Нагадування</h2><div className="mt-3 space-y-2">{(pet.reminders ?? []).map((item) => <label key={item.id} className="flex items-center gap-3 rounded-2xl bg-canvas px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(item.completed)} onChange={() => { toggleReminder(pet.id, item.id); refresh(); }} /><span className={`flex-1 ${item.completed ? "text-ink/35 line-through" : "text-ink/70"}`}>{item.title}</span><span className="text-xs text-ink/45">{formatDate(item.date)}</span></label>)}</div></section>}
    </main>
  );
}

function Timeline({ items }: { items: { id: string; date: string; title: string; meta: string; type: string }[] }) {
  if (!items.length) return <div className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-ink/50">Після першого запису тут зʼявиться хронологія медичної історії.</div>;
  return <ol className="mt-4 space-y-4">{items.map((item, index) => <li key={item.id} className="relative flex gap-3"><span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-brand bg-white" />{index < items.length - 1 && <span className="absolute bottom-[-16px] left-[5px] top-3 w-px bg-brand-100" />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-ink">{item.title}</p><time className="shrink-0 text-xs text-ink/45">{formatDate(item.date)}</time></div><p className="mt-0.5 text-sm text-ink/50">{item.meta}</p></div></li>)}</ol>;
}

function SummaryField({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-2xl bg-canvas p-3"><dt className="text-xs font-medium text-ink/45">{label}</dt><dd className="mt-1 leading-6 text-ink/70">{value || "Не вказано"}</dd></div>;
}

function PrintGroup({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-2xl border border-brand-100 p-4"><h2 className="font-display text-lg font-bold">{title}</h2>{items.length ? <ul className="mt-2 space-y-1 text-sm">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-ink/45">Записів немає</p>}</section>;
}

function RecordSection({ icon, title, empty, items, addHref }: { icon: React.ReactNode; title: string; empty: string; items: { id: string; title: string; date: string; meta: string; href?: string }[]; addHref: string }) {
  return <section className="mt-5 rounded-3xl border border-brand-100 bg-white p-5"><div className="flex items-center gap-3">{icon}<div><h2 className="font-display text-xl font-bold text-ink">{title}</h2><p className="text-xs text-ink/45">{items.length} записів</p></div></div>{items.length ? <div className="mt-4 divide-y divide-brand-100">{items.map((item) => <div key={item.id} className="py-3"><div className="flex justify-between gap-3"><p className="font-semibold text-ink">{item.title}</p><time className="shrink-0 text-xs text-ink/45">{formatDate(item.date)}</time></div><p className="mt-1 text-sm text-ink/50">{item.meta}</p>{item.href && <a href={item.href} download={item.meta} className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">Відкрити документ</a>}</div>)}</div> : <p className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-ink/50">{empty}</p>}<Link href={addHref} className="btn btn-brand mt-4 w-full py-2.5 text-sm print:hidden">Додати запис</Link></section>;
}
