"use client";

import { useEffect, useState } from "react";
import { Disclaimer } from "@/components/JsonLd";
import { ShareRow } from "@/components/ShareRow";
import { ALL_ANIMALS, ALL_DISTRICTS, ANIMAL_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { createCard, getCards, type LostFoundCard } from "@/lib/lostfound/store";
import { SITE } from "@/lib/seo";
import { lostFoundShareText } from "@/lib/share";
import { isValidPhone } from "@/lib/security/url";
import type { AnimalType, KyivDistrict } from "@/lib/types";

export default function LostFoundPage() {
  const [cards, setCards] = useState<LostFoundCard[]>([]);
  const [mode, setMode] = useState<"lost" | "found">("lost");
  const [petName, setPetName] = useState("");
  const [animalType, setAnimalType] = useState<AnimalType>("dog");
  const [district, setDistrict] = useState<KyivDistrict>("podil");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setCards(getCards()), []);

  const submit = () => {
    if (!petName.trim()) return setErr("Вкажіть імʼя / опис тварини.");
    if (!isValidPhone(contact)) return setErr("Вкажіть коректний контактний телефон.");
    setErr(null);
    createCard({ mode, petName: petName.trim(), animalType, district, contact: contact.trim(), note: note.trim() || undefined });
    setCards(getCards());
    setPetName(""); setContact(""); setNote("");
  };

  const field = "w-full rounded-xl border border-brand-100 px-3 py-2 text-ink";

  return (
    <div className="container-px mx-auto max-w-2xl py-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">Загублені та знайдені</h1>
      <p className="mt-1 text-ink/60">Створіть картку і поширте її у Telegram, Viber чи Facebook.</p>

      <div className="mt-4 card p-4">
        <div className="mb-3 flex overflow-hidden rounded-xl border border-brand-100">
          {(["lost", "found"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-medium ${mode === m ? "bg-brand text-white" : "text-ink/60"}`}
            >
              {m === "lost" ? "Загубився" : "Знайдено"}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <input className={field} placeholder="Імʼя або короткий опис" value={petName} onChange={(e) => setPetName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className={field} value={animalType} onChange={(e) => setAnimalType(e.target.value as AnimalType)}>
              {ALL_ANIMALS.map((a) => <option key={a} value={a}>{ANIMAL_LABELS[a]}</option>)}
            </select>
            <select className={field} value={district} onChange={(e) => setDistrict(e.target.value as KyivDistrict)}>
              {ALL_DISTRICTS.map((d) => <option key={d} value={d}>{DISTRICT_LABELS[d]}</option>)}
            </select>
          </div>
          <input className={field} placeholder="Контактний телефон +380…" value={contact} onChange={(e) => setContact(e.target.value)} />
          <textarea className={field} rows={2} placeholder="Деталі (необовʼязково)" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p className="text-sm text-emergency">{err}</p>}
          <button className="btn btn-brand w-full" onClick={submit}>Створити картку</button>
        </div>
      </div>

      <div className="mt-5">
        <Disclaimer text="Не публікуйте зайвих персональних даних. Картки зберігаються лише у вашому браузері (демо)." />
      </div>

      <ul className="mt-5 space-y-3">
        {cards.map((c) => (
          <li key={c.id} className={`card p-4 ${c.mode === "lost" ? "ring-1 ring-emergency/30" : "ring-1 ring-brand/20"}`}>
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-ink">
                {c.mode === "lost" ? "❗ Загубився" : "🟢 Знайдено"}: {c.petName}
              </p>
              <span className="text-xs text-ink/50">{ANIMAL_LABELS[c.animalType]} · {DISTRICT_LABELS[c.district]}</span>
            </div>
            {c.note && <p className="mt-1 text-sm text-ink/70">{c.note}</p>}
            <p className="mt-1 text-sm text-ink/70">📞 {c.contact}</p>
            <div className="mt-3">
              <ShareRow
                text={lostFoundShareText(c.mode, c.petName, DISTRICT_LABELS[c.district])}
                url={`${SITE.url}/lost-found`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
