"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PetProfileCard } from "@/components/PetProfileCard";
import { exportPetsBackup, getActivePetId, getPetCollectionReadIssue, getPets, importPetsBackup } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";
import styles from "@/components/PetCare.module.css";

export default function MyPetsPage() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [readIssue, setReadIssue] = useState<string | null>(null);

  const reload = () => {
    setPets(getPets());
    setReadIssue(getPetCollectionReadIssue());
    setActiveId(getActivePetId());
    setLoaded(true);
  };
  useEffect(reload, []);

  const saveBackup = () => {
    const url = URL.createObjectURL(new Blob([exportPetsBackup()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vetnear-medcards-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Копію збережено у файл. Зберігайте його там, де не загубите.");
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error("Файл завеликий. Оберіть резервну копію VetNear до 20 МБ.");
      const count = importPetsBackup(await file.text());
      reload();
      setNotice(`Відновлено медкарток: ${count}.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Не вдалося прочитати файл.");
    }
  };

  return (
    <div className="container-px operating-screen mx-auto max-w-3xl py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div><h1 className="operating-heading font-display text-3xl font-bold text-ink">Мої тварини</h1><p className="mt-2 max-w-md text-sm leading-6 text-ink/65">Наступна подія, ваш ветеринар і важливе перед прийомом.</p></div>
        {pets.length > 0 && <Link href="/my-pets/new" className="btn btn-brand shrink-0 px-4 py-2.5 text-sm">Додати</Link>}
      </header>
      {!loaded ? <div className="skeleton h-48" aria-busy="true" aria-label="Завантажуємо ваші картки" /> : readIssue ? (
        <section className="rounded-2xl border border-emergency/20 bg-emergency-50 p-5" role="alert">
          <h2 className="text-xl font-semibold text-ink">Картки не завантажилися</h2>
          <p className="mt-3 text-sm leading-6 text-ink/75">{readIssue}</p>
          <button type="button" onClick={reload} className="btn btn-ghost mt-4 min-h-11">Спробувати ще раз</button>
        </section>
      ) : pets.length === 0 ? (
        <section className={styles.intro}>
          <h2 className="max-w-sm font-display text-3xl font-semibold leading-tight">Турбота починається<br />з імені.</h2>
          <p className="mt-4 max-w-sm text-sm leading-6">Створіть картку свого друга. Збережіть контакт ветеринара й наступну дату — решту додасте, коли буде потрібно.</p>
          <Link href="/my-pets/new" className={styles.introAction}>Додати тварину <span aria-hidden className="ml-3">→</span></Link>
        </section>
      ) : (
        <><ul className="space-y-4">{pets.map((p) => <li key={p.id}><PetProfileCard pet={p} active={p.id === activeId} /></li>)}</ul><div className="mt-6"><Link href="/nearby" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">Знайти допомогу поруч</Link></div></>
      )}
      <aside className="mt-6 border-t border-brand-100 pt-5" aria-label="Збереження та резервні копії">
        <p className={styles.storage}>Картки зберігаються лише в цьому браузері. Після очищення його даних вони зникнуть. Резервна копія допоможе відновити записи на іншому пристрої.</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {pets.length > 0 && <button type="button" onClick={saveBackup} className="min-h-11 font-semibold text-brand hover:underline">Зберегти копію</button>}
          <label className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand hover:underline">Відновити з копії<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.target.value = ""; }} /></label>
        </div>
        {notice && <p role="status" className="mt-2 text-sm text-ink/70">{notice}</p>}
      </aside>
    </div>
  );
}
