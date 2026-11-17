"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isBackendEnabled } from "@/lib/api/backendClient";
import { parsePartnerInterest, type PartnerInterestInput } from "@/lib/partners/interest";
import { PARTNER_PLANS, planLabel } from "@/lib/partners/plans";
import type { PartnerPlan } from "@/lib/types";
import styles from "@/app/for-partners/partners.module.css";

const DRAFT_KEY = "vetnear:partner-interest-draft:v1";
const fingerprint = (data: Omit<PartnerInterestInput, "requestId">) => JSON.stringify(data);
type ClaimPlace = { slug: string; name: string; locality: string; phone: string; website?: string };

export function PartnerInterestForm({ initialPlan, initialFounding, intakeEnabled, contactEmail: teamContact, claimPlace }: {
  initialPlan: PartnerPlan;
  initialFounding: boolean;
  intakeEnabled?: boolean;
  contactEmail?: string | null;
  claimPlace?: ClaimPlace;
}) {
  const [organization, setOrganization] = useState(claimPlace?.name ?? "");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [locality, setLocality] = useState(claimPlace?.locality ?? "Київ");
  const [officialWebsite, setOfficialWebsite] = useState(claimPlace?.website ?? "");
  const [plan, setPlan] = useState(initialPlan);
  const [founding, setFounding] = useState(initialFounding);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"editing" | "local" | "received">("editing");
  const [restored, setRestored] = useState(false);
  const [receiptId, setReceiptId] = useState("");
  const pending = useRef(false);
  const identity = useRef({ id: "", fingerprint: "" });
  const backend = intakeEnabled ?? isBackendEnabled();
  const claimSlug = claimPlace?.slug;

  useEffect(() => {
    try {
      const parsed = parsePartnerInterest(JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"));
      if (!parsed.ok || parsed.value.claimPlaceSlug !== claimSlug) return;
      const { requestId, ...p } = parsed.value;
      setOrganization(p.organization); setContactName(p.contactName); setContactEmail(p.contactEmail);
      setLocality(p.locality); setOfficialWebsite(p.officialWebsite); setPlan(p.requestedPlan);
      setFounding(p.foundingPartner); setMessage(p.message); setConsent(false); setRestored(true);
      identity.current = { id: requestId, fingerprint: fingerprint(p) };
    } catch { /* optional draft restore */ }
  }, [claimSlug]);

  const draftText = () => [
    "Партнерська заявка VetNear — чернетка, не підтвердження доставки", "",
    `Заклад: ${organization}`, `Місто: ${locality}`, `Контактна особа: ${contactName}`,
    `Робочий email: ${contactEmail}`, `Офіційний сайт: ${officialWebsite}`,
    ...(claimPlace ? [`Перевірка представника профілю: ${claimPlace.name} (${claimPlace.slug})`] : []),
    `Обговорення: ${planLabel(plan)}`, "", message,
  ].join("\n");
  const emailHref = teamContact ? `mailto:${teamContact}?subject=${encodeURIComponent(`VetNear: ${organization || "партнерський пілот"}`)}&body=${encodeURIComponent(draftText())}` : undefined;

  function downloadDraft() {
    try {
      const url = URL.createObjectURL(new Blob([draftText()], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "vetnear-partner-draft.txt"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Не вдалося завантажити файл. Дані залишилися у формі — скопіюйте їх перед закриттям."); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    const fields = { organization: organization.trim(), contactName: contactName.trim(), contactEmail: contactEmail.trim(), locality: locality.trim(), officialWebsite: officialWebsite.trim(), requestedPlan: plan, foundingPartner: founding, message: message.trim(), ...(claimSlug ? { claimPlaceSlug: claimSlug } : {}), consent: true as const };
    if (!consent) { setError("Погодьте обробку заявки, щоб продовжити."); return; }
    const currentFingerprint = fingerprint(fields);
    if (identity.current.fingerprint !== currentFingerprint) identity.current = { id: crypto.randomUUID(), fingerprint: currentFingerprint };
    const parsed = parsePartnerInterest({ ...fields, requestId: identity.current.id });
    if (!parsed.ok) { setError(parsed.error); return; }
    let saved = false;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(parsed.value)); saved = true; } catch { /* receipt is independent of local storage */ }
    if (!backend) {
      if (saved) setStatus("local");
      else setError("Браузер не дозволив зберегти чернетку. Дані залишились у формі — завантажте їх перед закриттям сторінки.");
      return;
    }
    pending.current = true; setBusy(true);
    try {
      const response = await fetch("/api/partner-interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.value), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || data?.ok !== true || data.id !== parsed.value.requestId || data.planActive !== false) throw new Error(typeof data?.error === "string" ? data.error : "Сервер не підтвердив отримання заявки.");
      setStatus("received");
      setReceiptId(data.id);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* local cleanup best-effort */ }
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Не вдалося підтвердити отримання."} ${saved ? "Чернетка збережена в цьому браузері." : "Залиште форму відкритою: локальної копії немає."} Повторна спроба з незміненими даними не створить нову заявку.`);
    } finally { pending.current = false; setBusy(false); }
  }

  if (status !== "editing") return <section className={styles.receipt} role="status">
    <h2>{status === "received" ? "Заявку отримано для розгляду" : "Чернетка лише на вашому пристрої"}</h2>
    <p>{status === "received" ? "Сервер підтвердив отримання контактів і побажань. Після перевірки представника команда зможе погодити зміни профілю. Публікація та платні послуги потребують окремого погодження." : "Команда VetNear не отримала цю чернетку. Збережіть файл для себе або відкрийте лист, якщо контакт команди доступний нижче."}</p>
    {status === "received" && <p className={styles.note}>Номер заявки: {receiptId}</p>}
    <dl className={styles.statusList}><div><dt>Формат</dt><dd>{planLabel(plan)}</dd></div><div><dt>Підписка</dt><dd>Не активована</dd></div><div><dt>Оплата</dt><dd>Не стягувалася</dd></div></dl>
    <div className={styles.actions}>{status === "local" && <><button type="button" className="btn btn-brand" onClick={downloadDraft}>Завантажити чернетку</button>{emailHref && <a className="btn btn-ghost" href={emailHref}>Відкрити лист до команди</a>}<button type="button" className="btn btn-ghost" onClick={() => setStatus("editing")}>Повернутися до чернетки</button></>}<Link href="/for-partners" className="btn btn-ghost">До партнерської програми</Link></div>
    {status === "local" && emailHref && <p className={styles.note}>Лист відкриється у вашій поштовій програмі. Перевірте текст і надішліть його самостійно; VetNear не підтверджує його доставку.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;

  return <form className={styles.form} onSubmit={submit}>
    {!backend && <div className={styles.notice}><p>Зараз це особиста чернетка: серверне приймання ще не підключено. Заповнення форми не надсилає дані команді.</p>{teamContact && <a href={`mailto:${teamContact}`}>Написати команді: {teamContact}</a>}</div>}
    {claimPlace && <div className={styles.claim}><strong>{claimPlace.name}</strong><p>{claimPlace.locality} · офіційний телефон у каталозі: {claimPlace.phone}</p><p>Попросимо підтвердження через відомий офіційний канал. Ваш робочий email у формі сам по собі не надає права редагувати заклад.</p><Link href={`/place/${claimPlace.slug}`} className={styles.inlineLink}>Переглянути поточну картку</Link></div>}
    {restored && <p className={styles.notice}>Відновлено вашу чернетку з цього браузера. Перевірте дані та ще раз погодьте їх обробку.</p>}
    <fieldset disabled={busy} className={`${styles.fields} mt-6`}>
      <div className={styles.field}><label htmlFor="interest-organization">Назва закладу *</label><input id="interest-organization" required maxLength={180} value={organization} onChange={e => setOrganization(e.target.value)} autoComplete="organization" /></div>
      <div className={styles.field}><label htmlFor="interest-locality">Місто або село *</label><input id="interest-locality" required maxLength={160} value={locality} onChange={e => setLocality(e.target.value)} autoComplete="address-level2" /></div>
      <div className={styles.field}><label htmlFor="interest-email">Робочий email *</label><input id="interest-email" type="email" required maxLength={254} value={contactEmail} onChange={e => setContactEmail(e.target.value)} autoComplete="email" /></div>
      <div className={styles.field}><label htmlFor="interest-name">Ваше ім’я · необов’язково</label><input id="interest-name" maxLength={120} value={contactName} onChange={e => setContactName(e.target.value)} autoComplete="name" /></div>
    </fieldset>
    <details className={styles.details} open={claimPlace ? true : undefined}>
      <summary>{claimPlace ? "Що потрібно уточнити" : "Деталі й побажання · необов’язково"}</summary>
      <fieldset disabled={busy} className={styles.fields}>
        <div className={`${styles.field} ${styles.wide}`}><label htmlFor="interest-message">Що важливо для вашого закладу?</label><textarea id="interest-message" rows={3} maxLength={claimPlace ? 1000 : 1500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Зміни графіка, послуги, дані філій або питання про участь…" /></div>
        <div className={`${styles.field} ${styles.wide}`}><label htmlFor="interest-site">Офіційний сайт</label><input id="interest-site" type="url" maxLength={500} placeholder="https://" value={officialWebsite} onChange={e => setOfficialWebsite(e.target.value)} /></div>
        <div className={`${styles.field} ${styles.wide}`}><label htmlFor="interest-plan">Формат обговорення</label><select id="interest-plan" value={plan} onChange={e => setPlan(e.target.value as PartnerPlan)}>{PARTNER_PLANS.map(p => <option key={p.id} value={p.id}>{p.name}{p.id !== "free" ? " — побажання до майбутніх інструментів" : " — базовий профіль"}</option>)}</select></div>
      </fieldset>
    </details>
    <label className={styles.check}><input type="checkbox" checked={founding} disabled={busy} onChange={e => setFounding(e.target.checked)} /><span>Хочу долучитися до раннього пілоту й дати зворотний звʼязок.</span></label>
    <label className={styles.check}><input type="checkbox" required checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><span>Погоджуюся на обробку даних для розгляду заявки відповідно до <Link href="/privacy" className={styles.inlineLink}>політики конфіденційності</Link>. Без рекламної підписки.</span></label>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><button type="submit" disabled={busy} aria-busy={busy} className="btn btn-brand">{busy ? "Надсилаємо заявку…" : backend ? "Надіслати заявку без оплати" : "Зберегти чернетку на пристрої"}</button>{!backend && <button type="button" className="btn btn-ghost" onClick={downloadDraft}>Завантажити текст</button>}</div>
    <p className={styles.note}>Без оплати й автоматичної підписки. Не додавайте медичні дані клієнтів або тварин.</p>
  </form>;
}
