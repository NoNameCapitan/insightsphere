"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { ALL_ANIMALS, ALL_DISTRICTS, ANIMAL_LABELS, DISTRICT_LABELS, normalizeDistrict } from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { createPet, deletePet, updatePet } from "@/lib/pets/store";
import { isCalendarDate } from "@/lib/pets/validation";
import { PetProfileIcon } from "@/components/icons/ServiceIcons";
import styles from "@/components/PetCare.module.css";
import type { AnimalType, KyivDistrict, PetProfile, Sex } from "@/lib/types";

const num = (value: string) => value.trim() === "" ? undefined : Number(value.replace(",", "."));
const CLINICS = PLACES.filter((place) => place.category === "veterinary_clinic");
const LOCALITIES = [...new Set(PLACES.map((place) => place.locality).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, "uk"));

export function PetProfileForm({ existing, onSaved }: { existing?: PetProfile; onSaved?: (pet: PetProfile) => void }) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const [preferredDistrict, setPreferredDistrict] = useState<KyivDistrict | "">(normalizeDistrict(existing?.preferredDistrict) ?? "");
  const [preferredLocality, setPreferredLocality] = useState(existing?.preferredLocality ?? "");
  const [favoriteClinicId, setFavoriteClinicId] = useState(existing?.favoriteClinicId ?? "");
  const [emergencyNote, setEmergencyNote] = useState(existing?.emergencyNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);

  const field = "w-full rounded-2xl border border-brand-100 bg-white px-3.5 py-3 text-ink outline-none placeholder:text-ink/55 focus:border-brand focus:ring-2 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-sm font-medium text-ink/70";

  const readPhoto = (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Підтримуються лише JPG, PNG або WebP."); return; }
    if (file.size > 2_000_000) { setError("Фото має бути менше 2 МБ."); return; }
    setError(null);
    setReadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => { setPhotoUrl(String(reader.result ?? "")); setReadingPhoto(false); };
    reader.onerror = () => { setError("Не вдалося прочитати фото. Оберіть файл ще раз."); setReadingPhoto(false); };
    reader.onabort = () => setReadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!name.trim()) { setError("Вкажіть ім’я тварини."); return; }
    if (readingPhoto) return;
    const years = num(ageYears);
    const months = num(ageMonths);
    const weight = num(weightKg);
    if ((years !== undefined && (!Number.isInteger(years) || years < 0)) ||
      (months !== undefined && (!Number.isInteger(months) || months < 0 || months > 11))) {
      setError("Вік має бути невід’ємним цілим числом; місяці — від 0 до 11."); setDetailsOpen(true); return;
    }
    if (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) {
      setError("Вкажіть вагу більше нуля, наприклад 4,8 кг."); setDetailsOpen(true); return;
    }
    if (birthDate && (!isCalendarDate(birthDate) || new Date(`${birthDate}T00:00:00`) > new Date())) {
      setError("Перевірте дату народження: вона не може бути в майбутньому."); setDetailsOpen(true); return;
    }
    const payload = {
      name: name.trim(), animalType, breed: breed.trim() || undefined,
      birthDate: birthDate || undefined, ageYears: years, ageMonths: months, sex,
      weightKg: weight, photoUrl: photoUrl || undefined,
      microchipNumber: microchipNumber.trim() || undefined,
      allergies: allergies.trim() || undefined, importantNotes: notes.trim() || undefined,
      preferredDistrict: preferredDistrict || undefined, preferredLocality: preferredLocality.trim() || undefined, favoriteClinicId: favoriteClinicId || undefined,
      emergencyNote: emergencyNote.trim() || undefined,
    };
    try {
      const pet = existing ? updatePet(existing.id, payload) : createPet(payload);
      if (!pet) { setError("Медкартку не знайдено. Поверніться до списку тварин."); return; }
      if (onSaved) onSaved(pet);
      else router.push(`/my-pets/${pet.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не вдалося зберегти медкартку. Спробуйте ще раз.");
    }
  };

  const remove = () => {
    if (existing && window.confirm("Видалити медичну картку цієї тварини?")) {
      try {
        deletePet(existing.id);
        router.push("/my-pets");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не вдалося видалити медкартку.");
      }
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-5">
      {error && <p className="rounded-xl bg-emergency-50 px-4 py-3 text-sm text-emergency-700" role="alert">{error}</p>}
      <div className="space-y-4">
        <div><label htmlFor="pet-name" className={labelCls}>Ім’я тварини *</label><input id="pet-name" required maxLength={100} autoComplete="off" className={field} value={name} onChange={(event) => setName(event.target.value)} placeholder="Як звати вашого друга?" /></div>
        <div><label htmlFor="pet-type" className={labelCls}>Вид тварини</label><select id="pet-type" className={field} value={animalType} onChange={(event) => setAnimalType(event.target.value as AnimalType)}>{ALL_ANIMALS.map((item) => <option key={item} value={item}>{ANIMAL_LABELS[item]}</option>)}</select></div>
        <button type="submit" className="btn btn-brand w-full" disabled={readingPhoto}>{readingPhoto ? "Читаємо фото…" : existing ? "Зберегти картку" : "Створити медкартку"}</button>
        {!existing && <p className={styles.storage}>Без реєстрації. Картка зберігатиметься в цьому браузері; копію можна завантажити після створення.</p>}
      </div>

      <details className={styles.summary} open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary>Фото та відомості — за бажанням</summary>
        <div className="space-y-5">
          <div className="flex items-center gap-4"><div className="h-16 w-16 overflow-hidden rounded-2xl bg-brand-50">{photoUrl ? <Image unoptimized src={photoUrl} alt="Фото тварини" width={64} height={64} className="h-full w-full object-cover" /> : <PetProfileIcon className="h-full w-full p-2" />}</div><label className="btn btn-ghost cursor-pointer px-4 py-2.5 text-sm">Додати фото<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => readPhoto(event.target.files?.[0])} /></label></div>
          <div><label htmlFor="pet-sex" className={labelCls}>Стать</label><select id="pet-sex" className={field} value={sex} onChange={(event) => setSex(event.target.value as Sex)}><option value="unknown">Не вказано</option><option value="male">Хлопчик</option><option value="female">Дівчинка</option></select></div>
          <div><label htmlFor="pet-breed" className={labelCls}>Порода</label><input id="pet-breed" className={field} value={breed} onChange={(event) => setBreed(event.target.value)} /></div>
          <div><label htmlFor="pet-birth" className={labelCls}>Дата народження</label><input id="pet-birth" type="date" className={field} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
          <details><summary className="cursor-pointer text-sm font-semibold text-brand">Якщо точна дата невідома</summary><div className="mt-4 grid grid-cols-2 gap-3"><div><label htmlFor="pet-years" className={labelCls}>Років</label><input id="pet-years" className={field} inputMode="numeric" value={ageYears} onChange={(event) => setAgeYears(event.target.value)} /></div><div><label htmlFor="pet-months" className={labelCls}>Місяців</label><input id="pet-months" className={field} inputMode="numeric" value={ageMonths} onChange={(event) => setAgeMonths(event.target.value)} /></div></div></details>
          <div><label htmlFor="pet-weight" className={labelCls}>Поточна вага, кг</label><input id="pet-weight" className={field} inputMode="decimal" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} /></div>
        </div>
      </details>
      <details className={styles.summary} open={Boolean(existing)}>
        <summary>Мій ветеринар і місце пошуку</summary>
        <div className="space-y-4">
          <div><label htmlFor="pet-locality" className={labelCls}>Зручне місто або село</label><input id="pet-locality" list="pet-localities" className={field} maxLength={100} value={preferredLocality} onChange={(event) => { setPreferredLocality(event.target.value); if (event.target.value.trim() !== "Київ") setPreferredDistrict(""); }} placeholder="Київ, Буча, Бровари…" /><datalist id="pet-localities">{LOCALITIES.map((item) => <option key={item} value={item} />)}</datalist><p className="mt-2 text-xs leading-5 text-ink/65">Це ваша перевага для пошуку, а не поточна геолокація.</p></div>
          {(!preferredLocality || preferredLocality.trim() === "Київ") && <div><label htmlFor="pet-district" className={labelCls}>Зручний район Києва</label><select id="pet-district" className={field} value={preferredDistrict} onChange={(event) => setPreferredDistrict(event.target.value as KyivDistrict | "")}><option value="">Не вказано</option>{ALL_DISTRICTS.map((item) => <option key={item} value={item}>{DISTRICT_LABELS[item]}</option>)}</select></div>}
          <div><label htmlFor="pet-clinic" className={labelCls}>Мій ветеринар</label><select id="pet-clinic" className={field} value={favoriteClinicId} onChange={(event) => setFavoriteClinicId(event.target.value)}><option value="">Оберіть клініку</option>{CLINICS.map((item) => <option key={item.id} value={item.id}>{item.name}{item.locality ? ` · ${item.locality}` : ""}</option>)}</select></div>
        </div>
      </details>
      <details className={styles.summary}>
        <summary>Важливе перед прийомом</summary>
        <div className="space-y-4">
          <div><label htmlFor="pet-chip" className={labelCls}>Номер мікрочипа</label><input id="pet-chip" className={field} value={microchipNumber} onChange={(event) => setMicrochip(event.target.value)} /></div>
          <div><label htmlFor="pet-allergies" className={labelCls}>Відомі алергії</label><input id="pet-allergies" className={field} value={allergies} onChange={(event) => setAllergies(event.target.value)} /></div>
          <div><label htmlFor="pet-notes" className={labelCls}>Хронічні стани й важливі особливості</label><textarea id="pet-notes" rows={3} className={field} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <div><label htmlFor="pet-emergency" className={labelCls}>Нотатка для невідкладної ситуації</label><input id="pet-emergency" className={field} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)} placeholder="Наприклад: відома реакція на анестезію" /></div>
        </div>
      </details>
      {existing && <button type="button" onClick={remove} className="block min-h-11 text-sm font-medium text-emergency-700 hover:underline">Видалити медкартку</button>}
    </form>
  );
}
