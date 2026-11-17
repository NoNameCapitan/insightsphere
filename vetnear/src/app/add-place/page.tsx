"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { ALL_ANIMALS, ALL_CATEGORIES, ALL_DISTRICTS, ANIMAL_LABELS, CATEGORY_LABELS, DISTRICT_LABELS, placeLocationLabel } from "@/lib/labels";
import { COVERAGE_REGIONS, withinCoverageBounds } from "@/config/coverage";
import { createSubmission } from "@/lib/partners/store";
import { isBackendEnabled } from "@/lib/api/backendClient";
import { getPlaces, hydratePublishedPlaces } from "@/lib/store";
import { findPartnerPlaces, type PartnerPlaceSummary } from "@/lib/partners/discovery";
import { isSafeUrl, isValidEmail, isValidPhone } from "@/lib/security/url";
import type { AnimalType, KyivDistrict, PlaceCategory, PlaceRegion } from "@/lib/types";

const FREE_SOCIAL_CATEGORIES: PlaceCategory[] = ["shelter", "animal_volunteer_help"];
const STEPS = ["Основне", "Послуги", "Підтвердження"];

export default function AddPlacePage() {
  useEffect(() => track("add_place_started"), []);

  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState<PartnerPlaceSummary[]>([]);
  const backend = isBackendEnabled();
  useEffect(() => {
    let alive = true;
    setCatalog(getPlaces());
    void hydratePublishedPlaces().then(() => { if (alive) setCatalog(getPlaces()); });
    return () => { alive = false; };
  }, []);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("veterinary_clinic");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState<PlaceRegion>("kyiv_city");
  const [locality, setLocality] = useState("");
  const [district, setDistrict] = useState<KyivDistrict | "">("");
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
  const [result, setResult] = useState<Awaited<ReturnType<typeof createSubmission>> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const field = "w-full rounded-xl border border-brand-100 bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-ink/30 focus:border-brand focus:ring-2 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-sm font-medium text-ink/75";
  const num = (value: string) => (value.trim() === "" ? undefined : Number(value));
  const isFreeSocial = FREE_SOCIAL_CATEGORIES.includes(category);
  const duplicates = useMemo(() => {
    const matches = [...findPartnerPlaces(catalog, name), ...findPartnerPlaces(catalog, phone)];
    return matches.filter((place, index) => matches.findIndex(item => item.id === place.id) === index).slice(0, 3);
  }, [catalog, name, phone]);
  const scrollToStart = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  const toggleAnimal = (animal: AnimalType) => {
    setAnimals((current) => current.includes(animal) ? current.filter((item) => item !== animal) : [...current, animal]);
  };

  const stepOneErrors = () => {
    const next: string[] = [];
    if (!name.trim()) next.push("Вкажіть назву організації.");
    if (!address.trim()) next.push("Вкажіть адресу.");
    if (region === "kyiv_oblast" && !locality.trim()) next.push("Вкажіть населений пункт Київської області.");
    if (!isValidPhone(phone)) next.push("Перевірте номер телефону.");
    return next;
  };

  const goNext = () => {
    const nextErrors = step === 1 ? stepOneErrors() : [];
    setErrors(nextErrors);
    if (nextErrors.length) return;
    setStep((current) => Math.min(3, current + 1));
    scrollToStart();
  };

  const submit = async () => {
    if (inFlight.current) return;
    const nextErrors = stepOneErrors();
    if (email && !isValidEmail(email)) nextErrors.push("Перевірте email.");
    if (website && !isSafeUrl(website)) nextErrors.push("Перевірте посилання на сайт.");
    if (instagram && !isSafeUrl(instagram)) nextErrors.push("Перевірте посилання Instagram.");
    if (telegram && !isSafeUrl(telegram)) nextErrors.push("Перевірте посилання Telegram.");
    if (mapLink && !isSafeUrl(mapLink)) nextErrors.push("Перевірте посилання на карту.");

    const latitude = num(lat);
    const longitude = num(lng);
    if ((latitude !== undefined) !== (longitude !== undefined)) nextErrors.push("Вкажіть обидві координати або залиште їх порожніми.");
    if (latitude !== undefined && longitude !== undefined && !withinCoverageBounds(region, { latitude, longitude })) nextErrors.push("Перевірте координати: вони мають відповідати обраній території. Якщо не впевнені — додайте посилання на карту.");
    if (!representativeConfirmed) nextErrors.push("Підтвердіть, що представляєте заклад.");
    if (!consentModeration) nextErrors.push("Надайте згоду на модерацію даних.");

    setErrors(nextErrors);
    if (nextErrors.length) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      const receipt = await createSubmission({
        name: name.trim(), category, description: description.trim(), address: address.trim(),
        countryCode: "UA", region, locality: region === "kyiv_city" ? "Київ" : locality.trim(),
        ...(region === "kyiv_city" && district ? { district } : {}),
        latitude, longitude, phone: phone.trim(), email: email.trim() || undefined,
        website: website.trim() || undefined,
        socialLinks: { instagram: instagram.trim() || undefined, telegram: telegram.trim() || undefined },
        services: services.split(",").map((item) => item.trim()).filter(Boolean),
        animalTypes: animals, emergencyAvailable: false, appointmentRequired, deliveryAvailable,
        pickupAvailable, tags: [], contactPerson: contactPerson.trim() || undefined,
        mapLink: mapLink.trim() || undefined, representativeConfirmed, consentModeration,
      });
      setResult(receipt);
      scrollToStart();
    } catch {
      setErrors(["Не вдалося зберегти заявку. Залиште цю сторінку відкритою та спробуйте ще раз."]);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (result) {
    const sent = result.delivery.status === "sent";
    const unconfirmed = result.delivery.status === "unconfirmed";
    return (
      <div className="container-px mx-auto max-w-xl py-12">
        <div className="rounded-3xl border border-brand-100 bg-surface p-6 shadow-card sm:p-8">
          <h1 className="font-display text-3xl font-bold text-ink">{sent ? "Заявку отримано" : unconfirmed ? "Отримання ще не підтверджено" : result.localSaved ? "Чернетку збережено на пристрої" : "Заявку не збережено"}</h1>
          <p className="mt-3 leading-7 text-ink/65" role="status">{sent
            ? "Сервер підтвердив отримання. Модератор перевірить контакти, адресу та категорію. Після схвалення профіль зʼявиться у пошуку й на карті."
            : unconfirmed
              ? `Сервер не підтвердив отримання заявки. ${result.localSaved ? "Локальна копія збережена в цьому браузері." : "Локальне сховище недоступне — залиште сторінку відкритою."} Повторне надсилання може створити дублікат, якщо перший запит уже отримано.`
              : result.localSaved
                ? "Серверне надсилання в цій версії вимкнено. Модератор ще не отримав заявку; вона доступна лише в цьому браузері."
                : "Серверне надсилання вимкнено, а браузер не дозволив зберегти чернетку. Поверніться до форми, щоб скопіювати дані."}</p>
          <div className="mt-6 rounded-2xl bg-brand-50/60 p-4 text-sm leading-6 text-ink/70">Позначку невідкладної або цілодобової допомоги VetNear додає тільки після окремого підтвердження телефоном.</div>
          <Link href="/for-partners" className="btn btn-brand mt-6 w-full">Повернутися до партнерів</Link>
          {!sent && <button type="button" onClick={() => setResult(null)} className="btn btn-ghost mt-3 w-full">Повернутися до заявки</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="operating-screen container-px mx-auto max-w-xl py-8 sm:py-12">
      <Link href="/for-partners" className="text-sm font-medium text-brand hover:underline">Партнерам</Link>
      <h1 className="operating-heading mt-4 max-w-lg font-display text-3xl font-bold leading-tight text-ink">Додайте заклад до VetNear</h1>
      <p className="mt-3 max-w-lg leading-7 text-ink/60">Почніть із назви, адреси й контакту. Послуги можна описати пізніше; публікація — після перевірки.</p>

      {!backend && <p className="mt-5 rounded-xl bg-brand-50 p-4 text-sm leading-6 text-ink/75">Серверне приймання ще не підключено. Тут можна підготувати й зберегти особисту чернетку; команда її не отримає. <Link className="font-semibold text-brand underline underline-offset-4" href="/partner-interest">Варіанти зв’язку з командою</Link></p>}
      <div className="mt-6" aria-label={`Крок ${step} із 3`}>
        <div className="flex items-center gap-2">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;
            return (
              <div key={label} className="min-w-0 flex-1">
                <div className={`h-1 rounded-full ${number <= step ? "bg-brand" : "bg-brand-100"}`} />
                <p className={`mt-2 truncate text-xs font-medium ${active ? "text-ink" : complete ? "text-brand" : "text-ink/40"}`}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-6 rounded-2xl border border-emergency/15 bg-emergency-50 p-4 text-sm text-emergency-700" role="alert">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <section className="care-surface mt-6 rounded-2xl bg-surface p-5 sm:p-7">
        {step === 1 && (
          <div className="space-y-5">
            <div><label className={labelCls} htmlFor="name">Назва закладу *</label><input id="name" className={field} value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls} htmlFor="category">Категорія</label><select id="category" className={field} value={category} onChange={(event) => setCategory(event.target.value as PlaceCategory)}>{ALL_CATEGORIES.filter((item) => item !== "emergency_vet").map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}</select></div>
              <div><label className={labelCls} htmlFor="region">Територія</label><select id="region" className={field} value={region} onChange={(event) => { setRegion(event.target.value as PlaceRegion); setDistrict(""); }}>{Object.entries(COVERAGE_REGIONS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></div>
            </div>
            {region === "kyiv_city" ? <>
              <div><label className={labelCls} htmlFor="district">Район Києва · необов’язково</label><select id="district" className={field} value={district} onChange={(event) => setDistrict(event.target.value as KyivDistrict | "")}><option value="">Не вказано</option>{ALL_DISTRICTS.map((item) => <option key={item} value={item}>{DISTRICT_LABELS[item]}</option>)}</select></div>
            </> : <div><label className={labelCls} htmlFor="locality">Населений пункт *</label><input id="locality" className={field} value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Місто, селище або село" maxLength={100} /></div>}
            {isFreeSocial && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">Для притулків і зоозахисних організацій розміщення безкоштовне.</p>}
            <div><label className={labelCls} htmlFor="address">Адреса *</label><input id="address" className={field} value={address} onChange={(event) => setAddress(event.target.value)} /></div>
            <div><label className={labelCls} htmlFor="phone">Телефон *</label><input id="phone" className={field} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+380…" inputMode="tel" /></div>
            {duplicates.length > 0 && <aside className="rounded-xl bg-brand-50 p-4 text-sm leading-6" aria-label="Можливі збіги в каталозі"><p className="font-semibold text-ink">Схожі заклади вже є в каталозі</p><p className="mt-1 text-ink/70">Перевірте картку перед створенням дубліката.</p><ul className="mt-3 space-y-3">{duplicates.map(place => <li key={place.id}><Link href={`/partner-interest?claim=${encodeURIComponent(place.slug)}`} className="font-semibold text-brand underline underline-offset-4">{place.name} — це мій заклад</Link><p className="text-ink/65">{place.address}</p></li>)}</ul></aside>}
            <button type="button" className="btn btn-brand w-full" onClick={goNext}>Продовжити</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div><label className={labelCls} htmlFor="description">Короткий опис</label><textarea id="description" rows={3} className={field} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div><label className={labelCls} htmlFor="services">Основні послуги</label><input id="services" className={field} value={services} onChange={(event) => setServices(event.target.value)} placeholder="вакцинація, огляд, УЗД" /></div>
            <div>
              <p className={labelCls}>Для яких тварин</p>
              <div className="flex flex-wrap gap-2">{ALL_ANIMALS.map((animal) => <button key={animal} type="button" aria-pressed={animals.includes(animal)} onClick={() => toggleAnimal(animal)} className={`rounded-full border px-3 py-2 text-sm font-medium ${animals.includes(animal) ? "border-brand bg-brand text-white" : "border-brand-100 text-ink/65 hover:border-brand-300"}`}>{ANIMAL_LABELS[animal]}</button>)}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls} htmlFor="contact">Контактна особа</label><input id="contact" className={field} value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} /></div>
              <div><label className={labelCls} htmlFor="email">Email</label><input id="email" className={field} value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" /></div>
            </div>
            <div><label className={labelCls} htmlFor="website">Сайт</label><input id="website" className={field} value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" /></div>
            <details className="rounded-2xl border border-brand-100 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-brand">Додаткові контакти й координати</summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2"><input className={field} value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="Instagram URL" /><input className={field} value={telegram} onChange={(event) => setTelegram(event.target.value)} placeholder="Telegram URL" /></div>
                <input className={field} value={mapLink} onChange={(event) => setMapLink(event.target.value)} placeholder="Посилання Google Maps" />
                <div className="grid grid-cols-2 gap-3"><input className={field} value={lat} onChange={(event) => setLat(event.target.value)} placeholder="Широта" inputMode="decimal" /><input className={field} value={lng} onChange={(event) => setLng(event.target.value)} placeholder="Довгота" inputMode="decimal" /></div>
              </div>
            </details>
            <div className="grid gap-2 sm:grid-cols-3"><Check label="Запис обовʼязковий" on={appointmentRequired} set={setAppt} /><Check label="Доставка" on={deliveryAvailable} set={setDelivery} /><Check label="Самовивіз" on={pickupAvailable} set={setPickup} /></div>
            <div className="flex gap-3"><button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Назад</button><button type="button" className="btn btn-brand flex-1" onClick={goNext}>Перевірити заявку</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-brand-50/55 p-4"><p className="font-semibold text-ink">{name}</p><p className="mt-1 text-sm text-ink/60">{CATEGORY_LABELS[category]} · {placeLocationLabel({ region, locality, district: district || undefined })}</p><p className="mt-1 text-sm text-ink/60">{address} · {phone}</p></div>
            <p className="text-sm leading-6 text-ink/70">Публікація потребує перевірки даних і повноважень через офіційний канал закладу. Позначка у формі не підтверджує представника. Прийом 24/7 і невідкладну допомогу перевіряємо окремо.</p>
            <div className="space-y-3 rounded-2xl border border-brand-100 p-4 text-sm">
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={representativeConfirmed} onChange={(event) => setRepConfirmed(event.target.checked)} /><span>Я підтверджую, що представляю цей заклад.</span></label>
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={consentModeration} onChange={(event) => setConsent(event.target.checked)} /><span>Я погоджуюсь на перевірку та модерацію наданих даних.</span></label>
            </div>
            <div className="flex gap-3"><button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => setStep(2)}>Назад</button><button type="button" className="btn btn-brand flex-1" disabled={submitting} aria-busy={submitting} onClick={() => void submit()}>{submitting ? "Зберігаємо…" : backend ? "Надіслати на модерацію" : "Зберегти чернетку на пристрої"}</button></div>
          </div>
        )}
      </section>
    </div>
  );
}

function Check({ label, on, set }: { label: string; on: boolean; set: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-xl border border-brand-100 px-3 py-2.5 text-sm text-ink/70"><input type="checkbox" checked={on} onChange={(event) => set(event.target.checked)} /><span>{label}</span></label>;
}
