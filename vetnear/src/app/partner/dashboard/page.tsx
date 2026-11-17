"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { Disclaimer } from "@/components/JsonLd";
import styles from "@/app/for-partners/partners.module.css";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getSubmissions } from "@/lib/partners/store";
import type { PartnerSubmission } from "@/lib/types";

export default function PartnerDashboardPage() {
  const [subs, setSubs] = useState<PartnerSubmission[]>([]);
  useEffect(() => {
    track("partner_dashboard_opened");
    setSubs(getSubmissions());
  }, []);

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">Мої чернетки закладів</h1>
      <p className="mt-1 text-ink/60">
        У локальному режимі показуються лише заявки, збережені в цьому браузері. Після
        підключення авторизації партнер бачитиме тільки власні заклади.
      </p>

      <p className={styles.notice}>Партнерський пілот. Підписка не активована, оплата не стягується. Це локальний список заявок, а не авторизований бізнес-акаунт.</p>

      <div className="mt-4 flex gap-2">
        <Link href="/add-place" className="btn btn-brand py-2 text-sm">Додати заклад</Link>
        <Link href="/partner-interest?founding=1" className="btn btn-ghost py-2 text-sm">Обговорити партнерство</Link>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Мої заявки</h2>
        {subs.length === 0 ? (
          <p className="text-sm text-ink/50">Заявок ще немає.</p>
        ) : (
          <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-ink/80">{s.name}</p>
                  <p className="text-ink/50">{CATEGORY_LABELS[s.category]}</p>
                </div>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                  {STATUS_LABELS[s.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">Аналітика без припущень</h2>
        <p className={styles.dashboardEmpty}>У цьому кабінеті ще немає підтверджених показників вашого закладу. Реальні звіти потребують авторизації власника й підключення серверних подій. Натискання телефону або маршруту — це дія в інтерфейсі, а не підтверджений клієнт чи завершений запис.</p>
        <dl className={styles.statusList}><div><dt>Підписка</dt><dd>Не активована</dd></div><div><dt>Оплата</dt><dd>Не стягувалася</dd></div><div><dt>Доступний початок</dt><dd>Безкоштовний профіль після модерації</dd></div></dl>
        <Link href="/for-partners#pricing" className={`${styles.inlineLink} mt-5 inline-block`}>Безкоштовний профіль і партнерський пілот</Link>
      </section>

      <div className="mt-6">
        <Disclaimer text="Локальні статуси не є підтвердженням публікації на сервері. Партнерський акаунт потребує авторизації та перевірки прав власника." />
      </div>
    </div>
  );
}
