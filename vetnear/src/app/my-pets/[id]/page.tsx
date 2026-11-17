"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PetProfileForm } from "@/components/PetProfileForm";
import { PetPortrait } from "@/components/PetPortrait";
import { DocumentIcon, ReminderIcon, TreatmentIcon, VaccinationIcon, VisitIcon, WeightIcon } from "@/components/icons/MedicalIcons";
import { track } from "@/lib/analytics";
import { ANIMAL_LABELS } from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { buildIcs } from "@/lib/pets/calendar";
import { careToday, getPetCareEvents, petClinicSearchHref, type PetCareEvent } from "@/lib/pets/care";
import styles from "@/components/PetCare.module.css";
import { getPet, toggleReminder } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

const TABS = ["Огляд", "Вакцинації", "Обробки", "Візити", "Вага", "Документи", "Нагадування"] as const;
type Tab = (typeof TABS)[number];

function formatDate(value?: string) {
  if (!value) return "Не вказано";
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function WeightChart({ entries }: { entries: NonNullable<PetProfile["weightHistory"]> }) {
  const values = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
  if (values.length < 2) return <p className="text-sm text-ink/65">Додайте щонайменше два записи — тут зʼявиться графік зміни ваги.</p>;
  const min = Math.min(...values.map((item) => item.weightKg));
  const max = Math.max(...values.map((item) => item.weightKg));
  const range = Math.max(max - min, 0.5);
  const points = values.map((item, index) => `${12 + index * (276 / (values.length - 1))},${74 - ((item.weightKg - min) / range) * 48}`).join(" ");
  return <div>
    <svg viewBox="0 0 300 88" className="h-28 w-full" role="img" aria-label="Графік ваги">
      <path d="M12 74H288" stroke="#DDE7E2" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#06756A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle key={values[index].id} cx={cx} cy={cy} r="4" fill="#fff" stroke="#06756A" strokeWidth="2" />; })}
    </svg>
    <div className="flex justify-between text-xs text-ink/65"><span>{formatDate(values[0].date)}</span><strong className="text-ink">{values.at(-1)?.weightKg} кг</strong><span>{formatDate(values.at(-1)?.date)}</span></div>
  </div>;
}

export default function PetDetailPage() {
  const params = useParams<{ id: string }>();
  const [pet, setPet] = useState<PetProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("Огляд");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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

  if (pet === undefined) return <div className="container-px mx-auto max-w-3xl space-y-4 py-7" aria-busy="true" aria-label="Завантажуємо медкартку"><div className="skeleton h-40" /><div className="skeleton h-28" /><div className="skeleton h-48" /></div>;
  if (pet === null) return <div className="container-px py-12 text-center"><p className="text-ink/55">Медкартку не знайдено.</p><Link href="/my-pets" className="btn btn-brand mt-4">До моїх тварин</Link></div>;

  const favoriteClinic = PLACES.find((place) => place.id === pet.favoriteClinicId);
  const today = careToday();
  const allEvents = getPetCareEvents(pet);
  const upcoming = allEvents.filter((item) => item.date >= today);
  const pastDates = allEvents.filter((item) => item.date < today);
  const nextEvent = upcoming[0];

  const openSettings = () => {
    setSettingsOpen(true);
    document.getElementById("pet-settings")?.scrollIntoView({ block: "start" });
  };

  const shareRecord = async () => {
    const text = `${pet.name} · коротка інформація з VetNear. ${ANIMAL_LABELS[pet.animalType]}${pet.microchipNumber ? ` · мікрочип ${pet.microchipNumber}` : ""}`;
    try {
      setActionError(null);
      if (navigator.share) await navigator.share({ title: `Коротка інформація про ${pet.name}`, text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) setActionError("Не вдалося поділитися. Ви можете зберегти картку через «Експорт PDF».");
    }
  };

  const changeReminder = (id: string) => {
    try {
      setActionError(null);
      if (!toggleReminder(pet.id, id)) throw new Error("Медкартку не знайдено.");
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Не вдалося зберегти нагадування.");
    }
  };

  const addToCalendar = (events: PetCareEvent[]) => {
    const ics = buildIcs(events.map((item) => ({ ...item, petId: pet.id, petName: pet.name, url: `${window.location.origin}/my-pets/${encodeURIComponent(pet.id)}` })));
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vetnear-${pet.name}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    track("calendar_exported");
  };


  const recordCount = (pet.vaccinations?.length ?? 0) + (pet.treatments?.length ?? 0) + (pet.visits?.length ?? 0) + (pet.documents?.length ?? 0);

  return (
    <div className="container-px operating-screen mx-auto max-w-3xl py-7 print:max-w-none print:bg-white">
      <div className="flex items-center justify-between gap-4 print:hidden"><Link href="/my-pets" className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">Мої тварини</Link><span className="text-xs text-ink/65">У цьому браузері</span></div>
      {actionError && <p role="alert" className="mt-4 rounded-xl bg-emergency-50 px-4 py-3 text-sm text-emergency-700 print:hidden">{actionError}</p>}
      <header className={styles.intro}>
        <div className={styles.identity}>
          <div className={styles.portrait}><PetPortrait name={pet.name} photoUrl={pet.photoUrl} size={72} /></div>
          <div className="min-w-0"><h1 className="break-words font-display text-3xl font-semibold">{pet.name}</h1><p className="mt-1 text-sm">{ANIMAL_LABELS[pet.animalType]}{pet.breed ? ` · ${pet.breed}` : ""}</p><p className="mt-2 text-xs">{recordCount ? `${recordCount} записів у вашій історії` : "Ваша історія турботи починається тут"}</p></div>
        </div>
      </header>

      <section className={`${styles.next} mt-4`} aria-labelledby="next-care-heading">
        <h2 id="next-care-heading" className={styles.nextTitle}>Наступна дія</h2>
        {nextEvent ? <><p className={styles.nextName}>{nextEvent.title}</p><p className={styles.nextDate}>{nextEvent.date === today ? "Сьогодні · " : ""}{formatDate(nextEvent.date)}</p><div className="mt-4 flex flex-wrap gap-3 print:hidden"><button type="button" onClick={() => addToCalendar([nextEvent])} className="btn btn-brand py-2.5 text-sm">Додати в календар</button>{nextEvent.reminderId && <button type="button" onClick={() => changeReminder(nextEvent.reminderId!)} className="btn btn-ghost py-2.5 text-sm">Позначити виконаним</button>}<Link href={`/my-pets/${pet.id}/records/new`} className="btn btn-ghost py-2.5 text-sm">Додати запис</Link></div></> : <><p className={styles.nextName}>Що заплануємо далі?</p><p className="mt-2 text-sm leading-6 text-ink/65">Збережіть дату візиту, грумінгу або подію за рекомендацією ветеринара.</p><Link href={`/my-pets/${pet.id}/records/new?type=reminder`} className="btn btn-brand mt-4 py-2.5 text-sm print:hidden">Запланувати подію</Link></>}
        {nextEvent && <p className="mt-3 text-xs leading-5 text-ink/65 print:hidden">Файл для вашого календаря. Нагадування залежать від його налаштувань; імпорт не синхронізує подальші зміни.</p>}
      </section>
      <div className={styles.personalGrid}>
        <section className={styles.panel}><h2>Мій ветеринар</h2>{favoriteClinic ? <><p className="mt-3 font-semibold text-ink">{favoriteClinic.name}</p><p className="mt-1 text-sm leading-6 text-ink/65">{favoriteClinic.locality ? `${favoriteClinic.locality}, ` : ""}{favoriteClinic.address}</p><div className="mt-3 flex flex-wrap gap-3 print:hidden">{favoriteClinic.phone && <a href={`tel:${favoriteClinic.phone}`} className="btn btn-brand py-2.5 text-sm">Зателефонувати</a>}<Link href={`/place/${favoriteClinic.slug}`} className="btn btn-ghost py-2.5 text-sm">Профіль</Link></div><p className="mt-3 text-xs leading-5 text-ink/65">Перед поїздкою уточніть прийом. Збережений контакт не підтверджує, що клініка відкрита зараз.</p></> : <><p className="mt-2 text-sm leading-6 text-ink/65">Оберіть клініку, якій довіряєте. Телефон залишиться під рукою.</p><button type="button" onClick={openSettings} className="btn btn-ghost mt-3 py-2.5 text-sm print:hidden">Зберегти ветеринара</button><Link href={petClinicSearchHref(pet)} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand print:hidden">{pet.preferredLocality ? `Пошук: ${pet.preferredLocality}` : "Знайти клініку"}</Link></>}</section>
        <section className={styles.panel}><h2>Перед прийомом</h2><dl className="mt-3 space-y-3 text-sm"><SummaryField label="Відомі алергії" value={pet.allergies} /><SummaryField label="Важливі особливості" value={pet.importantNotes} />{pet.emergencyNote && <SummaryField label="Для невідкладної ситуації" value={pet.emergencyNote} />}</dl><button type="button" onClick={openSettings} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline print:hidden">Доповнити інформацію</button></section>
      </div>
      {pastDates.length > 0 && <details className={`${styles.summary} mt-3`}><summary>Минулі заплановані дати · {pastDates.length}</summary><p className="mb-3 text-sm leading-6 text-ink/65">Перевірте записи. Минула дата не означає, що процедура пропущена або її потрібно повторити.</p><ul className="space-y-3">{pastDates.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{item.title} · {formatDate(item.date)}</span>{item.reminderId && <button type="button" className="min-h-11 font-semibold text-brand" onClick={() => changeReminder(item.reminderId!)}>Позначити виконаним</button>}</li>)}</ul></details>}
      {upcoming.length > 1 && <details className={`${styles.summary} print:hidden`}><summary>Усі заплановані події · {upcoming.length}</summary><ul className="space-y-3">{upcoming.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{item.title} · {formatDate(item.date)}</span><button type="button" onClick={() => addToCalendar([item])} className="min-h-11 font-semibold text-brand">У календар</button></li>)}</ul><button type="button" onClick={() => addToCalendar(upcoming)} className="mt-3 min-h-11 text-sm font-semibold text-brand">Завантажити всі заплановані події</button></details>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold text-ink">Історія турботи</h2><Link href={`/my-pets/${pet.id}/records/new`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand print:hidden">Додати запис</Link></div>
      <nav className={`${styles.recordTabs} print:hidden`} aria-label="Розділи медкартки">{TABS.map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
      {tab === "Огляд" && <div className="mt-3 space-y-4">
        {timeline.length ? <section className={styles.panel}><h2>Останні записи</h2><Timeline items={timeline.slice(0, 6)} /></section> : <div className="rounded-2xl border border-dashed border-brand-200 p-5 text-sm leading-6 text-ink/65">Після першого візиту або щеплення додайте запис. Тут зберігатиметься ваша історія за датою.</div>}
        {(pet.weightHistory?.length ?? 0) > 0 && <section className={styles.panel}><h2>Вага</h2><div className="mt-3"><WeightChart entries={pet.weightHistory ?? []} /></div></section>}
      </div>}

      {tab === "Вакцинації" && <RecordSection icon={<span className="icon3d h-12 w-12"><VaccinationIcon className="h-9 w-9" /></span>} title="Вакцинації" empty="Додайте першу вакцинацію та наступну дату." items={(pet.vaccinations ?? []).map((item) => ({ id: item.id, title: item.name, date: item.date, meta: [item.clinicName, item.nextDate ? `Наступна: ${formatDate(item.nextDate)}` : null].filter(Boolean).join(" · "), href: item.documentDataUrl }))} addHref={`/my-pets/${pet.id}/records/new?type=vaccination`} />}
      {tab === "Обробки" && <RecordSection icon={<span className="icon3d h-12 w-12"><TreatmentIcon className="h-9 w-9" /></span>} title="Обробки" empty="Додайте протиглисну обробку або захист від кліщів." items={(pet.treatments ?? []).map((item) => ({ id: item.id, title: item.name, date: item.date, meta: `${item.kind === "deworming" ? "Від глистів" : "Блохи й кліщі"}${item.nextDate ? ` · Наступна: ${formatDate(item.nextDate)}` : ""}`, href: item.documentDataUrl }))} addHref={`/my-pets/${pet.id}/records/new?type=treatment`} />}
      {tab === "Візити" && <RecordSection icon={<span className="icon3d h-12 w-12"><VisitIcon className="h-9 w-9" /></span>} title="Візити" empty="Після першого візиту тут зʼявиться медична історія." items={(pet.visits ?? []).map((item) => ({ id: item.id, title: item.reason, date: item.date, meta: [item.clinicName, item.outcome].filter(Boolean).join(" · "), href: item.documentDataUrl }))} addHref={`/my-pets/${pet.id}/records/new?type=visit`} />}
      {tab === "Вага" && <RecordSection icon={<span className="icon3d h-12 w-12"><WeightIcon className="h-9 w-9" /></span>} title="Історія ваги" empty="Додайте перше вимірювання." items={(pet.weightHistory ?? []).map((item) => ({ id: item.id, title: `${item.weightKg} кг`, date: item.date, meta: "Вимірювання" }))} addHref={`/my-pets/${pet.id}/records/new?type=weight`} />}
      {tab === "Документи" && <RecordSection icon={<span className="icon3d h-12 w-12"><DocumentIcon className="h-9 w-9" /></span>} title="Документи" empty="Завантажте фото ветпаспорта, довідки або результату." items={(pet.documents ?? []).map((item) => ({ id: item.id, title: item.title, date: item.date, meta: item.fileName || "Документ", href: item.dataUrl }))} addHref={`/my-pets/${pet.id}/records/new?type=document`} />}

      {tab === "Нагадування" && <section className="mt-5 rounded-3xl border border-brand-100 bg-white p-5 print:hidden"><div className="flex items-center gap-3"><span className="icon3d h-12 w-12"><ReminderIcon className="h-9 w-9" /></span><div><h2 className="font-display text-xl font-bold text-ink">Нагадування</h2><p className="text-xs text-ink/65">Позначайте виконане. Щоб не пропустити — додайте в календар.</p></div></div>{(pet.reminders ?? []).length ? <div className="mt-4 space-y-2">{(pet.reminders ?? []).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-canvas px-3 py-2.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={Boolean(item.completed)} onChange={() => changeReminder(item.id)} /><span className={`flex-1 ${item.completed ? "text-ink/35 line-through" : "text-ink/70"}`}>{item.title}</span><span className="text-xs text-ink/65">{formatDate(item.date)}</span></label>)}</div> : <p className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-ink/65">Нагадувань поки немає.</p>}<Link href={`/my-pets/${pet.id}/records/new?type=reminder`} className="btn btn-brand mt-4 w-full py-2.5 text-sm">Додати нагадування</Link></section>}

      <div className="mt-5 hidden space-y-5 print:block">
        <PrintGroup title="Вакцинації" items={(pet.vaccinations ?? []).map((item) => `${formatDate(item.date)} — ${item.name}${item.clinicName ? ` · ${item.clinicName}` : ""}`)} />
        <PrintGroup title="Обробки" items={(pet.treatments ?? []).map((item) => `${formatDate(item.date)} — ${item.name}`)} />
        <PrintGroup title="Візити" items={(pet.visits ?? []).map((item) => `${formatDate(item.date)} — ${item.reason}${item.outcome ? ` · ${item.outcome}` : ""}`)} />
        <PrintGroup title="Документи" items={(pet.documents ?? []).map((item) => `${formatDate(item.date)} — ${item.title}`)} />
      </div>

      <section id="pet-settings" className="mt-5 scroll-mt-24 rounded-2xl bg-white p-5 print:hidden"><details open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}><summary className="min-h-8 cursor-pointer font-semibold text-brand">Налаштування медкартки</summary><div className="mt-5"><PetProfileForm existing={pet} onSaved={(updated) => { setPet(updated); setSettingsOpen(false); }} /></div></details></section>
      <div className="mt-5 flex flex-wrap gap-3 print:hidden"><button type="button" onClick={() => { void shareRecord(); }} className="btn btn-ghost py-2.5 text-sm">{shared ? "Готово" : "Поділитися короткою інформацією"}</button><button type="button" onClick={() => window.print()} className="btn btn-ghost py-2.5 text-sm">Експорт PDF</button></div>
      <p className="mt-3 text-xs leading-5 text-ink/65 print:hidden">Коротка інформація містить ім’я, вид і номер чипа, якщо він вказаний. Для історії записів скористайтеся PDF. Картка залишається в цьому браузері — <Link href="/my-pets" className="font-semibold text-brand underline underline-offset-4">збережіть резервну копію</Link>.</p>

    </div>
  );
}

function Timeline({ items }: { items: { id: string; date: string; title: string; meta: string; type: string }[] }) {
  if (!items.length) return <div className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-ink/65">Після першого запису тут зʼявиться хронологія медичної історії.</div>;
  return <ol className="mt-4 space-y-4">{items.map((item, index) => <li key={item.id} className="relative flex gap-3"><span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-brand bg-white" />{index < items.length - 1 && <span className="absolute bottom-[-16px] left-[5px] top-3 w-px bg-brand-100" />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-ink">{item.title}</p><time className="shrink-0 text-xs text-ink/65">{formatDate(item.date)}</time></div><p className="mt-0.5 text-sm text-ink/65">{item.meta}</p></div></li>)}</ol>;
}

function SummaryField({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-2xl bg-canvas p-3"><dt className="text-xs font-medium text-ink/65">{label}</dt><dd className="mt-1 leading-6 text-ink/70">{value || "Не вказано"}</dd></div>;
}

function PrintGroup({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-2xl border border-brand-100 p-4"><h2 className="font-display text-lg font-bold">{title}</h2>{items.length ? <ul className="mt-2 space-y-1 text-sm">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-ink/65">Записів немає</p>}</section>;
}

function RecordSection({ icon, title, empty, items, addHref }: { icon: React.ReactNode; title: string; empty: string; items: { id: string; title: string; date: string; meta: string; href?: string }[]; addHref: string }) {
  return <section className="mt-5 rounded-3xl border border-brand-100 bg-white p-5"><div className="flex items-center gap-3">{icon}<div><h2 className="font-display text-xl font-bold text-ink">{title}</h2><p className="text-xs text-ink/65">{items.length} записів</p></div></div>{items.length ? <div className="mt-4 divide-y divide-brand-100">{items.map((item) => <div key={item.id} className="py-3"><div className="flex justify-between gap-3"><p className="font-semibold text-ink">{item.title}</p><time className="shrink-0 text-xs text-ink/65">{formatDate(item.date)}</time></div><p className="mt-1 text-sm text-ink/65">{item.meta}</p>{item.href && <a href={item.href} download={item.meta} className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">Відкрити документ</a>}</div>)}</div> : <p className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-ink/65">{empty}</p>}<Link href={addHref} className="btn btn-brand mt-4 w-full py-2.5 text-sm print:hidden">Додати запис</Link></section>;
}
