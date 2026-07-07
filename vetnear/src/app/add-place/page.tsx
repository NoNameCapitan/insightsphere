"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { ALL_ANIMALS, ALL_CATEGORIES, ALL_DISTRICTS, ANIMAL_LABELS, CATEGORY_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { createSubmission } from "@/lib/partners/store";
import { isSafeUrl, isValidEmail, isValidPhone } from "@/lib/security/url";
import type { AnimalType, KyivDistrict, PlaceCategory } from "@/lib/types";

const FREE_SOCIAL_CATEGORIES: PlaceCategory[] = ["shelter", "animal_volunteer_help"];

export default function AddPlacePage() {
  useEffect(() => track("add_place_started"), []);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("veterinary_clinic");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState<KyivDistrict>("podil");
  const [mapLink, setMapLink] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [telegram, setTelegram] = useState("");
  const [services, setServices] = useState("");
  const [animals, setAnimals] = useState<AnimalType[]>(["cat", "dog"]);
  const [appointmentRequired, setAppt] = useState(false);
  const [deliveryAvailable, setDelivery] = useState(false);
  const [pickupAvailable, setPickup] = useState(false);
  const [representativeConfirmed, setRepConfirmed] = useState(false);
  const [consentModeration, setConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const isFreeSocial = FREE_SOCIAL_CATEGORIES.includes(category);

  const toggleAnimal = (a: AnimalType) =>
    setAnimals((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const submit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Вкажіть назву організації.");
    if (!address.trim()) errs.push("Вкажіть адресу.");
    if (!isValidPhone(phone)) errs.push("Невірний номер телефону.");
    if (email && !isValidEmail(email)) errs.push("Невірний email.");
    if (website && !isSafeUrl(website)) errs.push("Невірне або небезпечне посилання на сайт.");
    if (instagram && !isSafeUrl(instagram)) errs.push("Невірне посилання Instagram.");
    if (telegram && !isSafeUrl(telegram)) errs.push("Невірне посилання Telegram.");
    if (mapLink && !isSafeUrl(mapLink)) errs.push("Невірне посилання на карту.");
    const latN = num(lat);
    const lngN = num(lng);
    if ((latN !== undefined) !== (lngN !== undefined)) errs.push("Вкажіть і широту, і довготу — або залиште обидва порожніми.");
    if (latN !== undefined && (Number.isNaN(latN) || latN < 49 || latN > 51)) errs.push("Широта виглядає некоректною для Києва.");
    if (lngN !== undefined && (Number.isNaN(lngN) || lngN < 29 || lngN > 32)) errs.push("Довгота виглядає некоректною для Києва.");
    if (!representativeConfirmed) errs.push("Підтвердіть, що ви представляєте цей заклад.");
    if (!consentModeration) errs.push("Надайте згоду на модерацію даних.");
    setErrors(errs);
    if (errs.length) return;

    createSubmission({
      name: name.trim(),
      category,
      description: description.trim(),
      address: address.trim(),
      district,
      latitude: latN,
      longitude: lngN,
      phone: phone.trim(),
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      socialLinks: {
        instagram: instagram.trim() || undefined,
        telegram: telegram.trim() || undefined,
      },
      services: services.split(",").map((s) => s.trim()).filter(Boolean),
      animalTypes: animals,
      // Partners cannot self-declare emergency/24-7. VetNear sets it only after a phone call.
      emergencyAvailable: false,
      appointmentRequired,
      deliveryAvailable,
      pickupAvailable,
      tags: [],
      contactPerson: contactPerson.trim() || undefined,
      mapLink: mapLink.trim() || undefined,
      representativeConfirmed,
      consentModeration,
    });
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const field = "w-full rounded-xl border border-brand-100 px-3 py-2 text-ink";
  const labelCls = "mb-1 block text-sm text-ink/70";

  if (done) {
    return (
      <div className="container-px mx-auto max-w-xl py-10">
        <p className="text-center text-4xl">✅</p>
        <h1 className="mt-3 text-center font-display text-2xl font-extrabold text-ink">Заявку отримано</h1>
        <div className="mt-4 space-y-3 text-sm text-ink/75">
          <p>
            Після перевірки модератором заклад може зʼявитися у VetNear. Статус:{" "}
            <strong>на модерації</strong>. Базове розміщення — безкоштовне.
          </p>
          <p className="rounded-2xl bg-amber/5 px-3 py-2 text-xs text-ink/70">
            Пілотна версія: оплата не стягується. Заявка зберігається локально у вашому
            браузері; якщо backend увімкнений у production, вона також синхронізується
            на серверну чергу модерації. Заявки проходять модерацію і не публікуються
            автоматично.
          </p>
          <div className="rounded-2xl border border-brand-100 p-4">
            <p className="font-medium text-ink">Що далі</p>
            <ol className="mt-2 list-none space-y-1 text-ink/70">
              <li>1. Модератор перевіряє контакти й категорію.</li>
              <li>2. Профіль зʼявляється у пошуку поруч і на карті.</li>
              <li>3. Дані позначаються «Перевірено за публічними джерелами»; статус «Підтверджено дзвінком» — після нашого дзвінка.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-brand-100 p-4">
            <p className="font-medium text-ink">Як стати перевіреним партнером</p>
            <p className="mt-1 text-ink/70">
              Підтвердіть, що представляєте заклад, додайте фото, послуги й графік. Платні
              плани (Verified / Pro) розширюють профіль і видимість — без тиску й без обовʼязку.
              Притулки та зоозахисні організації — безкоштовно.
            </p>
            <Link href="/for-partners#pricing" className="mt-2 inline-block text-brand hover:underline">Переглянути тарифи →</Link>
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/for-partners" className="btn btn-ghost">Для партнерів</Link>
          <Link href="/admin/moderation" className="btn btn-brand">Переглянути модерацію (демо)</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-px mx-auto max-w-xl py-6">
      <Link href="/for-partners" className="text-sm text-brand hover:underline">← Для партнерів</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">Додайте свій зообізнес на VetNear безкоштовно</h1>
      <p className="mt-1 text-ink/60">Клініка, грумінг, зоомагазин, ветаптека, притулок чи перетримка — додавання займає до 2 хвилин.</p>

      {errors.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-2xl bg-emergency-50 p-3 text-sm text-emergency-700">
          {errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      <div className="mt-5 space-y-4">
        <div>
          <label className={labelCls} htmlFor="n">Назва *</label>
          <input id="n" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="cat">Категорія</label>
            <select id="cat" className={field} value={category} onChange={(e) => setCategory(e.target.value as PlaceCategory)}>
              {ALL_CATEGORIES.filter((c) => c !== "emergency_vet").map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-ink/50">
              Термінову/цілодобову допомогу додає тільки модератор після підтвердження дзвінком.
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="dist">Район</label>
            <select id="dist" className={field} value={district} onChange={(e) => setDistrict(e.target.value as KyivDistrict)}>
              {ALL_DISTRICTS.map((d) => <option key={d} value={d}>{DISTRICT_LABELS[d]}</option>)}
            </select>
          </div>
        </div>
        {isFreeSocial && (
          <p className="rounded-2xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
            Притулки та зоозахисні організації розміщуються безкоштовно — без платних планів.
          </p>
        )}
        <div>
          <label className={labelCls} htmlFor="desc">Опис</label>
          <textarea id="desc" rows={3} className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="addr">Адреса *</label>
          <input id="addr" className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        {/* Map self-marking: paste a Google Maps link, or enter coordinates if known. */}
        <div className="rounded-2xl border border-brand-100 p-3">
          <p className="text-sm font-medium text-ink">Розташування на карті</p>
          <p className="mt-1 text-xs text-ink/50">Вставте посилання Google Maps або введіть координати. Якщо ні — модератор визначить за адресою.</p>
          <input className={`${field} mt-2`} value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="https://maps.google.com/…" />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <input className={field} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Широта (необовʼязково)" />
            <input className={field} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Довгота (необовʼязково)" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="ph">Телефон *</label>
            <input id="ph" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380…" />
          </div>
          <div>
            <label className={labelCls} htmlFor="cp">Контактна особа</label>
            <input id="cp" className={field} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={labelCls} htmlFor="em">Email</label>
            <input id="em" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="web">Сайт</label>
            <input id="web" className={field} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className={field} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram URL" />
            <input className={field} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="Telegram URL" />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="srv">Послуги (через кому)</label>
          <input id="srv" className={field} value={services} onChange={(e) => setServices(e.target.value)} placeholder="вакцинація, огляд, …" />
        </div>
        <div>
          <p className={labelCls}>Які тварини</p>
          <div className="flex flex-wrap gap-2">
            {ALL_ANIMALS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={animals.includes(a)}
                onClick={() => toggleAnimal(a)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  animals.includes(a) ? "border-brand bg-brand text-white" : "border-brand-100 text-ink/70"
                }`}
              >
                {ANIMAL_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Check label="Запис обовʼязковий" on={appointmentRequired} set={setAppt} />
          <Check label="Доставка" on={deliveryAvailable} set={setDelivery} />
          <Check label="Самовивіз" on={pickupAvailable} set={setPickup} />
        </div>
        <p className="rounded-2xl bg-amber/5 px-3 py-2 text-xs text-ink/60">
          Невідкладну/цілодобову допомогу VetNear позначає лише після підтвердження дзвінком — її не можна вказати самостійно.
        </p>

        <div className="space-y-2 rounded-2xl border border-brand-100 p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={representativeConfirmed} onChange={(e) => setRepConfirmed(e.target.checked)} />
            <span className="text-ink/80">Я підтверджую, що представляю цей заклад. *</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={consentModeration} onChange={(e) => setConsent(e.target.checked)} />
            <span className="text-ink/80">Я надаю згоду на перевірку та модерацію наданих даних. *</span>
          </label>
        </div>

        <button className="btn btn-brand w-full" onClick={submit}>Надіслати на модерацію</button>
        <p className="text-center text-xs text-ink/40">
          Базове розміщення безкоштовне. 10% доходів від платних партнерських планів VetNear спрямовує на реабілітацію постраждалих від війни.
        </p>
      </div>
    </div>
  );
}

function Check({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-brand-100 px-3 py-2">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="text-ink/80">{label}</span>
    </label>
  );
}
