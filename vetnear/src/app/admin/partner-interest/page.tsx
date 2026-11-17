"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isBackendEnabled } from "@/lib/api/backendClient";
import { planLabel } from "@/lib/partners/plans";
import type { PartnerPlan } from "@/lib/types";
import styles from "@/app/for-partners/partners.module.css";

type Intake = { id: string; organization: string; contact_name: string | null; contact_email: string; locality: string; official_website: string | null; requested_plan: PartnerPlan; founding_partner: boolean; message: string | null; status: string; created_at: string };
export default function PartnerIntakeQueue() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<Intake[]>([]);
  const [page, setPage] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  async function load(target: number) {
    controller.current?.abort();
    const request = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/partner-interest?page=${target}`, { headers: { "x-admin-token": token.trim() }, cache: "no-store", signal: abort.signal });
      if (response.status === 401) throw new Error("Токен не підтверджено або доступ відкликано.");
      if (!response.ok) throw new Error("Черга тимчасово недоступна. Перевірте підключення бази та повторіть.");
      const data = await response.json();
      if (!Array.isArray(data.requests) || !(data.nextPage === null || Number.isInteger(data.nextPage))) throw new Error("Сервер повернув невідому відповідь.");
      if (generation.current !== request) return;
      setRows(data.requests); setNext(data.nextPage); setPage(target); setLoaded(true);
    } catch (e) {
      if (generation.current !== request || abort.signal.aborted) return;
      setRows([]); setNext(null); setLoaded(false); setError(e instanceof Error ? e.message : "Не вдалося завантажити чергу.");
    } finally { if (generation.current === request) setBusy(false); }
  }
  function unlock(event: FormEvent) { event.preventDefault(); void load(0); }
  function logout() { generation.current++; controller.current?.abort(); setToken(""); setRows([]); setLoaded(false); setNext(null); setError(""); setBusy(false); }
  return <div className="operating-screen container-px mx-auto max-w-4xl py-8">
    <Link href="/admin" className={styles.inlineLink}>Адміністративна панель</Link>
    <h1 className="operating-heading mt-5">Партнерські звернення</h1>
    <p className={styles.lead}>Серверна черга заявок на пілот і перевірку представника. Вміст доступний тільки після перевірки токена модератора.</p>
    {!isBackendEnabled() && <p className={styles.notice}>Серверний режим цього розгортання не увімкнено. Чернетки браузера не потрапляють до цієї черги.</p>}
    {!loaded ? <form className={`${styles.form} max-w-xl`} onSubmit={unlock}><div className={styles.field}><label htmlFor="intake-token">Токен модератора</label><input type="password" id="intake-token" value={token} onChange={event => setToken(event.target.value)} required autoComplete="off" maxLength={512} disabled={busy} /></div><p className={styles.note}>Токен тримається лише в пам’яті цієї сторінки. Не вставляйте ключ Supabase або інші службові ключі.</p><button className="btn btn-brand mt-5" disabled={busy || !token.trim()} aria-busy={busy}>{busy ? "Перевіряємо доступ…" : "Відкрити чергу"}</button></form> : <div className={styles.actions}><button className="btn btn-ghost" disabled={busy} onClick={() => void load(page)}>Оновити</button><button className="btn btn-ghost" onClick={logout}>Вийти й очистити екран</button></div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loaded && <section aria-label="Отримані звернення" aria-busy={busy}>
      <p className={`${styles.note} mt-6`} role="status">Сторінка {page + 1}. Показано {rows.length} звернень.</p>
      {rows.length === 0 ? <p className={styles.notice}>На цій сторінці звернень немає.</p> : <ul className={styles.queue}>{rows.map(row => <li key={row.id} className={styles.queueItem}><h2>{row.organization}</h2><p>{row.locality} · {planLabel(row.requested_plan)}{row.founding_partner ? " · ранній пілот" : ""}</p><p className={styles.queueMeta}>{new Date(row.created_at).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })} · {row.status === "pending_review" ? "Очікує розгляду" : row.status}</p><p>{row.contact_name || "Контактна особа не вказана"} · {row.contact_email}</p>{row.official_website && <p>{row.official_website}</p>}{row.message && <pre>{row.message}</pre>}<p className={styles.note}>ID: {row.id}</p></li>)}</ul>}
      <nav aria-label="Сторінки звернень" className={styles.actions}><button className="btn btn-ghost" disabled={busy || page === 0} onClick={() => void load(Math.max(0, page - 1))}>Попередні</button><button className="btn btn-ghost" disabled={busy || next === null} onClick={() => { if (next !== null) void load(next); }}>Наступні</button></nav>
      <p className={styles.note}>Черга працює для читання. Підтвердження представника, відповідь і погодження змін виконуються вручну через відомий офіційний канал. Цей екран не надсилає листів і не активує підписки.</p>
    </section>}
  </div>;
}
