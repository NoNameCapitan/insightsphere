"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { ALL_ANIMALS, ALL_DISTRICTS, ANIMAL_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { createPet, deletePet, updatePet } from "@/lib/pets/store";
import { PetProfileIcon } from "@/components/icons/ServiceIcons";
import { MicrochipIcon, WeightIcon } from "@/components/icons/MedicalIcons";
import type { AnimalType, KyivDistrict, PetProfile, Sex } from "@/lib/types";

const num = (value: string) => value === "" ? undefined : Number(value);
const CLINICS = PLACES.filter((place) => place.category === "veterinary_clinic");
const STEPS = ["Основне", "Деталі", "Здоров’я"];

export function PetProfileForm({ existing }: { existing?: PetProfile }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(existing?.name ?? "");
  const [animalType, setAnimalType] = useState<AnimalType>(existing?.animalType ?? "dog");
  const [breed, setBreed] = useState(existing?.breed ?? "");
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? "");
  const [ageYears, setAgeYears] = useState(existing?.ageYears?.toString() ?? "");
  const [ageMonths, setAgeMonths] = useState(existing?.ageMonths?.toString() ?? "");
  const [sex, setSex] = useState<Sex>(existing?.sex ?? "unknown");
  const [weightKg, setWeightKg] = useState(existing?.weightKg?.toString() ?? "");
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? "");
  const [microchipNumber, setMicrochip] = useState(existing?.microchipNumber ?? "");
  const [allergies, setAllergies] = useState(existing?.allergies ?? "");
  const [notes, setNotes] = useState(existing?.importantNotes ?? "");
  const [preferredDistrict, setPreferredDistrict] = useState<KyivDistrict | "">(existing?.preferredDistrict ?? "");
  const [favoriteClinicId, setFavoriteClinicId] = useState(existing?.favoriteClinicId ?? "");
  const [emergencyNote, setEmergencyNote] = useState(existing?.emergencyNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const field = "w-full rounded-2xl border border-brand-100 bg-white px-3.5 py-3 text-ink outline-none placeholder:text-ink/30 focus:border-brand focus:ring-2 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-sm font-medium text-ink/70";

  const next = () => {
    if (step === 1 && !name.trim()) { setError("Вкажіть ім’я тварини."); return; }
    setError(null);
    setStep((value) => Math.min(3, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const readPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) { setError("Фото має бути менше 2 МБ."); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!name.trim()) { setError("Вкажіть ім’я тварини."); return; }
    const payload = {
      name: name.trim(), animalType, breed: breed.trim() || undefined,
      birthDate: birthDate || undefined, ageYears: num(ageYears), ageMonths: num(ageMonths), sex,
      weightKg: num(weightKg), photoUrl: photoUrl || undefined,
      microchipNumber: microchipNumber.trim() || undefined,
      allergies: allergies.trim() || undefined, importantNotes: notes.trim() || undefined,
      preferredDistrict: preferredDistrict || undefined, favoriteClinicId: favoriteClinicId || undefined,
      emergencyNote: emergencyNote.trim() || undefined,
    };
    const pet = existing ? updatePet(existing.id, payload) : createPet(payload);
    if (pet) router.push(`/my-pets/${pet.id}`);
  };

  const remove = () => {
    if (existing && window.confirm("Видалити медичну картку цієї тварини?")) {
      deletePet(existing.id);
      router.push("/my-pets");
    }
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-2" aria-label={`Крок ${step} із 3`}>
        {STEPS.map((label, index) => <div key={label}>
          <div className={`h-1 rounded-full ${index + 1 <= step ? "bg-brand" : "bg-brand-100"}`} />
          <p className={`mt-2 text-xs font-medium ${index + 1 === step ? "text-ink" : "text-ink/40"}`}>{label}</p>
        </div>)}
      </div>

      {error && <p className="mb-4 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-sm text-emergency-700" role="alert">{error}</p>}

      <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-card sm:p-7">
        {step === 1 && <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-3xl border border-brand-100 bg-brand-50">
              {photoUrl ? <Image unoptimized src={photoUrl} alt="Попередній перегляд" width={80} height={80} className="h-full w-full object-cover" /> : <PetProfileIcon className="h-full w-full p-2" />}
            </div>
            <label className="btn btn-ghost cursor-pointer px-4 py-2.5 text-sm">Додати фото<input type="file" accept="image/*" className="sr-only" onChange={(event) => readPhoto(event.target.files?.[0])} /></label>
          </div>
          <div><label htmlFor="pet-name" className={labelCls}>Ім’я *</label><input id="pet-name" autoFocus className={field} value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="pet-type" className={labelCls}>Вид</label><select id="pet-type" className={field} value={animalType} onChange={(event) => setAnimalType(event.target.value as AnimalType)}>{ALL_ANIMALS.map((item) => <option key={item} value={item}>{ANIMAL_LABELS[item]}</option>)}</select></div>
            <div><label htmlFor="pet-sex" className={labelCls}>Стать</label><select id="pet-sex" className={field} value={sex} onChange={(event) => setSex(event.target.value as Sex)}><option value="unknown">Не вказано</option><option value="male">Хлопчик</option><option value="female">Дівчинка</option></select></div>
          </div>
          <button type="button" className="btn btn-brand w-full" onClick={next}>Продовжити</button>
        </div>}

        {step === 2 && <div className="space-y-5">
          <div><label htmlFor="pet-breed" className={labelCls}>Порода</label><input id="pet-breed" className={field} value={breed} onChange={(event) => setBreed(event.target.value)} /></div>
          <div><label htmlFor="pet-birth" className={labelCls}>Дата народження</label><input id="pet-birth" type="date" className={field} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
          <details className="rounded-2xl border border-brand-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-brand">Якщо точна дата невідома</summary><div className="mt-4 grid grid-cols-2 gap-3"><div><label className={labelCls}>Років</label><input className={field} inputMode="numeric" value={ageYears} onChange={(event) => setAgeYears(event.target.value)} /></div><div><label className={labelCls}>Місяців</label><input className={field} inputMode="numeric" value={ageMonths} onChange={(event) => setAgeMonths(event.target.value)} /></div></div></details>
          <div className="flex items-end gap-3"><WeightIcon className="h-12 w-12 shrink-0" /><div className="flex-1"><label htmlFor="pet-weight" className={labelCls}>Поточна вага, кг</label><input id="pet-weight" className={field} inputMode="decimal" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} /></div></div>
          <div className="flex gap-3"><button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Назад</button><button type="button" className="btn btn-brand flex-1" onClick={next}>Продовжити</button></div>
        </div>}

        {step === 3 && <div className="space-y-5">
          <div className="flex items-end gap-3"><MicrochipIcon className="h-12 w-12 shrink-0" /><div className="flex-1"><label htmlFor="pet-chip" className={labelCls}>Номер мікрочипа</label><input id="pet-chip" className={field} value={microchipNumber} onChange={(event) => setMicrochip(event.target.value)} /></div></div>
          <div><label htmlFor="pet-allergies" className={labelCls}>Алергії</label><input id="pet-allergies" className={field} value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="Якщо відомі" /></div>
          <div><label htmlFor="pet-notes" className={labelCls}>Хронічні стани й важливі особливості</label><textarea id="pet-notes" rows={3} className={field} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <div><label htmlFor="pet-emergency" className={labelCls}>Нотатка для невідкладної ситуації</label><input id="pet-emergency" className={field} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)} placeholder="Наприклад: реакція на анестезію" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="pet-district" className={labelCls}>Зручний район</label><select id="pet-district" className={field} value={preferredDistrict} onChange={(event) => setPreferredDistrict(event.target.value as KyivDistrict | "")}><option value="">Не вказано</option>{ALL_DISTRICTS.map((item) => <option key={item} value={item}>{DISTRICT_LABELS[item]}</option>)}</select></div>
            <div><label htmlFor="pet-clinic" className={labelCls}>Улюблена клініка</label><select id="pet-clinic" className={field} value={favoriteClinicId} onChange={(event) => setFavoriteClinicId(event.target.value)}><option value="">Не вибрано</option>{CLINICS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          </div>
          <div className="rounded-2xl bg-brand-50/60 p-4 text-sm leading-6 text-ink/60">Після збереження ви зможете додати вакцинації, обробки, візити, вагу, документи й нагадування.</div>
          <div className="flex gap-3"><button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>Назад</button><button type="button" className="btn btn-brand flex-1" onClick={save}>{existing ? "Зберегти картку" : "Створити медкартку"}</button></div>
        </div>}
      </section>

      {existing && <button type="button" onClick={remove} className="mx-auto mt-6 block text-sm font-medium text-emergency-700 hover:underline">Видалити медкартку</button>}
    </div>
  );
}
