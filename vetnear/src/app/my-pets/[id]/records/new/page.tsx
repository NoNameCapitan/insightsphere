"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentIcon, ReminderIcon, TreatmentIcon, VaccinationIcon, VisitIcon, WeightIcon } from "@/components/icons/MedicalIcons";
import { GeneratedVisual } from "@/components/GeneratedVisual";
import { PLACES } from "@/lib/data/places";
import { addMonths, DEFAULT_INTERVAL_MONTHS, type RecordKind } from "@/lib/pets/calendar";
import { commitPetChanges } from "@/lib/pets/sync";
import { addDocument, addReminder, addTreatment, addVaccination, addVisit, addWeight, getPet } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

/** Today as YYYY-MM-DD in the user's local time zone (toISOString is UTC). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type RecordType = "vaccination" | "deworming" | "flea_tick" | "visit" | "weight" | "document" | "reminder";
const TYPES: { id: RecordType; label: string; icon: React.ReactNode }[] = [
  { id: "vaccination", label: "Вакцинація", icon: <VaccinationIcon /> },
  { id: "deworming", label: "Від глистів", icon: <TreatmentIcon /> },
  { id: "flea_tick", label: "Блохи й кліщі", icon: <TreatmentIcon /> },
  { id: "visit", label: "Візит", icon: <VisitIcon /> },
  { id: "weight", label: "Вага", icon: <WeightIcon /> },
  { id: "document", label: "Документ", icon: <DocumentIcon /> },
  { id: "reminder", label: "Нагадування", icon: <ReminderIcon /> },
];

/** One-tap names for the most common records; "Інша" leaves the field free. */
const PRESETS: Partial<Record<RecordType, string[]>> = {
  vaccination: ["Сказ", "Комплексна"],
  deworming: ["Таблетка", "Суспензія", "Краплі на холку"],
  flea_tick: ["Краплі на холку", "Таблетка", "Нашийник"],
};
const CLINIC_NAMES = PLACES.filter((place) => place.category === "veterinary_clinic").map((place) => place.name);
const isRepeating = (type: RecordType): type is RecordKind => type === "vaccination" || type === "deworming" || type === "flea_tick";

export default function NewMedicalRecordPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const initial = search.get("type");
  const initialType: RecordType = initial === "treatment"
    ? "deworming"
    : TYPES.some((item) => item.id === initial)
      ? initial as RecordType
      : "vaccination";
  const [type, setType] = useState<RecordType>(initialType);
  const [date, setDate] = useState(localToday);
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState("");
  const [nextDate, setNextDate] = useState("");
  // The next date is suggested from a typical interval until the owner edits it.
  const [nextTouched, setNextTouched] = useState(false);
  const suggestedNext = isRepeating(type) && date ? addMonths(date, DEFAULT_INTERVAL_MONTHS[type]) : "";
  const effectiveNext = nextTouched ? nextDate : suggestedNext;
  const [batch, setBatch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [weight, setWeight] = useState("");
  const [fileName, setFileName] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  // localStorage only exists in the browser: read the pet after mount so the
  // server HTML and the first client render match (fixes hydration error #418).
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setPet(getPet(params.id));
    setLoaded(true);
  }, [params.id]);
  const field = "w-full rounded-2xl border border-brand-100 bg-white px-3.5 py-3 text-ink outline-none placeholder:text-ink/30 focus:border-brand focus:ring-2 focus:ring-brand/10";
  const label = "mb-1.5 block text-sm font-medium text-ink/70";

  const readFile = (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) { setError("Файл має бути менше 2 МБ."); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!pet) { setError("Медкартку не знайдено."); return; }
    if (!date || !name.trim()) { setError(type === "weight" ? "Вкажіть вагу й дату." : "Заповніть назву та дату."); return; }
    if (type === "vaccination") addVaccination(pet.id, { date, name: name.trim(), nextDate: effectiveNext || undefined, clinicName: clinic.trim() || undefined, batchNumber: batch.trim() || undefined, documentDataUrl: dataUrl || undefined });
    if (type === "deworming" || type === "flea_tick") addTreatment(pet.id, { kind: type, date, name: name.trim(), nextDate: effectiveNext || undefined, weightKg: weight ? Number(weight) : undefined, documentDataUrl: dataUrl || undefined });
    if (type === "visit") addVisit(pet.id, { date, reason: name.trim(), clinicName: clinic.trim() || undefined, outcome: outcome.trim() || undefined, documentDataUrl: dataUrl || undefined });
    if (type === "weight") {
      const value = Number(name.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) { setError("Перевірте значення ваги."); return; }
      addWeight(pet.id, { date, weightKg: value });
    }
    if (type === "document") addDocument(pet.id, { date, title: name.trim(), fileName: fileName || undefined, dataUrl: dataUrl || undefined });
    if (type === "reminder") addReminder(pet.id, { date, title: name.trim() });
    const failure = await commitPetChanges();
    if (failure) { setError(failure); return; }
    router.push(`/my-pets/${pet.id}`);
  };

  if (!loaded) return <main className="container-px mx-auto max-w-xl py-8" aria-busy="true"><div className="skeleton h-64" /></main>;
  if (!pet) return <main className="container-px py-12 text-center"><p className="text-ink/55">Медкартку не знайдено.</p><Link href="/my-pets" className="btn btn-brand mt-4">Мої тварини</Link></main>;

  return <main className="container-px mx-auto max-w-xl py-8">
    <Link href={`/my-pets/${pet.id}`} className="text-sm font-medium text-brand hover:underline">Медкартка {pet.name}</Link>
    <div className="mt-3 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_280px]">
      <div><h1 className="font-display text-3xl font-bold text-ink">Додати запис</h1><p className="mt-2 text-sm leading-6 text-ink/55">Збережіть лише те, що потрібно. Додаткові поля можна залишити порожніми.</p></div>
      <GeneratedVisual src="/visuals/f-add-record.webp" className="mx-auto hidden h-52 w-full max-w-[300px] sm:block" motion="tilt" glow shine shadow sizes="300px" />
    </div>

    <div className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Тип запису">{TYPES.map((item) => <button key={item.id} type="button" onClick={() => { setType(item.id); setName(""); setError(null); setNextTouched(false); }} aria-pressed={type === item.id} className={`min-w-[94px] rounded-2xl border p-2.5 text-center ${type === item.id ? "border-brand bg-brand-50 text-brand-700" : "border-brand-100 bg-white text-ink/55"}`}><span className="icon3d mx-auto h-11 w-11"><span className="block h-8 w-8">{item.icon}</span></span><span className="mt-1 block text-[11px] font-semibold">{item.label}</span></button>)}</div>

    {error && <p role="alert" className="mt-4 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-sm text-emergency-700">{error}</p>}

    <section className="mt-4 space-y-5 rounded-3xl border border-brand-100 bg-white p-5 shadow-card sm:p-7">
      <div><label className={label} htmlFor="record-date">Дата</label><input id="record-date" type="date" className={field} value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div><label className={label} htmlFor="record-name">{type === "vaccination" ? "Назва вакцини" : type === "visit" ? "Причина візиту" : type === "weight" ? "Вага, кг" : type === "document" ? "Назва документа" : type === "reminder" ? "Що нагадати" : "Назва препарату"}</label>{PRESETS[type] && <div className="mb-2 flex flex-wrap gap-1.5">{PRESETS[type]!.map((preset) => <button key={preset} type="button" aria-pressed={name === preset} onClick={() => setName(preset)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${name === preset ? "border-brand bg-brand text-white" : "border-brand-100 bg-white text-ink/65 hover:border-brand-300"}`}>{preset}</button>)}</div>}<input id="record-name" className={field} inputMode={type === "weight" ? "decimal" : "text"} value={name} onChange={(event) => setName(event.target.value)} placeholder={type === "weight" ? "4,8" : ""} /></div>

      {(type === "vaccination" || type === "visit") && <div><label className={label} htmlFor="record-clinic">Клініка</label><input id="record-clinic" list="vetnear-clinics" className={field} value={clinic} onChange={(event) => setClinic(event.target.value)} /><datalist id="vetnear-clinics">{CLINIC_NAMES.map((item) => <option key={item} value={item} />)}</datalist></div>}
      {type === "vaccination" && <div><label className={label} htmlFor="record-batch">Серія вакцини</label><input id="record-batch" className={field} value={batch} onChange={(event) => setBatch(event.target.value)} /></div>}
      {(type === "vaccination" || type === "deworming" || type === "flea_tick") && <div><label className={label} htmlFor="record-next">Наступна дата</label><input id="record-next" type="date" className={field} value={effectiveNext} onChange={(event) => { setNextTouched(true); setNextDate(event.target.value); }} /><p className="mt-1.5 text-xs text-ink/45">{nextTouched ? "Дата змінена вручну." : "Орієнтовна дата за типовим інтервалом — уточніть у ветеринара."} Вона зʼявиться в «Найближче» на медкартці.</p></div>}
      {(type === "deworming" || type === "flea_tick") && <div><label className={label} htmlFor="record-weight">Вага на момент обробки, кг</label><input id="record-weight" className={field} inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} /></div>}
      {type === "visit" && <div><label className={label} htmlFor="record-outcome">Короткий результат або рекомендація</label><textarea id="record-outcome" rows={3} className={field} value={outcome} onChange={(event) => setOutcome(event.target.value)} /></div>}

      {["vaccination", "deworming", "flea_tick", "visit", "document"].includes(type) && <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/30 p-4"><DocumentIcon className="h-11 w-11 shrink-0" /><span className="flex-1 text-sm"><strong className="block text-ink">Додати фото або документ</strong><span className="mt-0.5 block truncate text-xs text-ink/45">{fileName || "JPG, PNG або PDF до 2 МБ"}</span></span><input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => readFile(event.target.files?.[0])} /></label>}

      <button type="button" className="btn btn-brand w-full" onClick={() => { void save(); }}>Зберегти запис</button>
    </section>
  </main>;
}
