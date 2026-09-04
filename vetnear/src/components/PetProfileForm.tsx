"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALL_ANIMALS, ALL_DISTRICTS, ANIMAL_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { createPet, updatePet, deletePet } from "@/lib/pets/store";
import type { AnimalType, KyivDistrict, PetProfile, Sex } from "@/lib/types";

const num = (v: string) => (v === "" ? undefined : Number(v));
const CLINICS = PLACES.filter((p) => p.category === "veterinary_clinic");

export function PetProfileForm({ existing }: { existing?: PetProfile }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [animalType, setAnimalType] = useState<AnimalType>(existing?.animalType ?? "dog");
  const [breed, setBreed] = useState(existing?.breed ?? "");
  const [ageYears, setAgeYears] = useState(existing?.ageYears?.toString() ?? "");
  const [ageMonths, setAgeMonths] = useState(existing?.ageMonths?.toString() ?? "");
  const [sex, setSex] = useState<Sex>(existing?.sex ?? "unknown");
  const [weightKg, setWeightKg] = useState(existing?.weightKg?.toString() ?? "");
  const [allergies, setAllergies] = useState(existing?.allergies ?? "");
  const [notes, setNotes] = useState(existing?.importantNotes ?? "");
  const [preferredDistrict, setPreferredDistrict] = useState<KyivDistrict | "">(
    existing?.preferredDistrict ?? "",
  );
  const [favoriteClinicId, setFavoriteClinicId] = useState(existing?.favoriteClinicId ?? "");
  const [emergencyNote, setEmergencyNote] = useState(existing?.emergencyNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError("Вкажіть ім'я улюбленця");
      return;
    }
    const payload = {
      name: name.trim(),
      animalType,
      breed: breed.trim() || undefined,
      ageYears: num(ageYears),
      ageMonths: num(ageMonths),
      sex,
      weightKg: num(weightKg),
      allergies: allergies.trim() || undefined,
      importantNotes: notes.trim() || undefined,
      preferredDistrict: preferredDistrict || undefined,
      favoriteClinicId: favoriteClinicId || undefined,
      emergencyNote: emergencyNote.trim() || undefined,
    };
    if (existing) {
      updatePet(existing.id, payload);
      router.push(`/my-pets/${existing.id}`);
    } else {
      const pet = createPet(payload);
      router.push(`/my-pets/${pet.id}`);
    }
  };

  const remove = () => {
    if (existing && confirm("Видалити цей профіль?")) {
      deletePet(existing.id);
      router.push("/my-pets");
    }
  };

  const field = "w-full rounded-xl border border-brand-100 px-3 py-2 text-ink";
  const labelCls = "mb-1 block text-sm text-ink/70";

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="pname">Ім&apos;я *</label>
        <input id="pname" className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="ptype">Вид</label>
          <select id="ptype" className={field} value={animalType} onChange={(e) => setAnimalType(e.target.value as AnimalType)}>
            {ALL_ANIMALS.map((a) => <option key={a} value={a}>{ANIMAL_LABELS[a]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="psex">Стать</label>
          <select id="psex" className={field} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="unknown">Невідомо</option>
            <option value="male">Хлопчик</option>
            <option value="female">Дівчинка</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="pbreed">Порода</label>
        <input id="pbreed" className={field} value={breed} onChange={(e) => setBreed(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls} htmlFor="pyears">Вік (років)</label>
          <input id="pyears" className={field} inputMode="numeric" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pmonths">Місяців</label>
          <input id="pmonths" className={field} inputMode="numeric" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pweight">Вага (кг)</label>
          <input id="pweight" className={field} inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="pallergy">Алергії</label>
        <input id="pallergy" className={field} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
      </div>

      <div>
        <label className={labelCls} htmlFor="pnotes">Хронічні стани / особливі потреби</label>
        <textarea id="pnotes" className={field} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="pdist">Зручний район</label>
          <select id="pdist" className={field} value={preferredDistrict} onChange={(e) => setPreferredDistrict(e.target.value as KyivDistrict | "")}>
            <option value="">Не вказано</option>
            {ALL_DISTRICTS.map((d) => <option key={d} value={d}>{DISTRICT_LABELS[d]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="pclinic">Улюблена клініка</label>
          <select id="pclinic" className={field} value={favoriteClinicId} onChange={(e) => setFavoriteClinicId(e.target.value)}>
            <option value="">Не вибрано</option>
            {CLINICS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="pemerg">Нотатка на випадок невідкладної ситуації</label>
        <input id="pemerg" className={field} value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} placeholder="Напр.: погано переносить наркоз" />
      </div>

      {error && <p className="text-sm text-emergency">{error}</p>}

      <div className="flex gap-2">
        <button className="btn btn-brand flex-1" onClick={submit}>
          {existing ? "Зберегти" : "Створити профіль"}
        </button>
        {existing && (
          <button className="btn btn-ghost text-emergency" onClick={remove}>
            Видалити
          </button>
        )}
      </div>

      {/* Module 8 — Pet QR / MQR placeholder */}
      <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
        <p className="font-medium text-ink">Pet QR / MQR профіль — скоро</p>
        <p className="mt-1 text-sm text-ink/60">
          Публічний QR-профіль на випадок втрати тварини (контакти власника,
          алергії, улюблена клініка).
        </p>
        <button className="btn btn-ghost mt-3 cursor-not-allowed opacity-60" disabled>
          Підготувати QR-профіль
        </button>
      </div>
    </div>
  );
}
