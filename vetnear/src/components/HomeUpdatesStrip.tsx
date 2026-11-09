import Link from "next/link";
import { RevealGroup } from "@/components/RevealGroup";
import { KYIV_INFO_ITEMS, KYIV_UPDATES_AS_OF, type KyivInfoKind } from "@/lib/data/kyivUpdates";

const KIND_LABEL: Record<KyivInfoKind, string> = {
  event: "Подія",
  vaccination: "Вакцинація тварин",
  safety: "Безпека людей",
  campaign: "Допомога",
  service: "Сервіс",
};

const KIND_TONE: Record<KyivInfoKind, string> = {
  event: "bg-peach-50 text-peach-700",
  vaccination: "bg-brand-50 text-brand-700",
  safety: "bg-emergency-50 text-emergency-700",
  campaign: "bg-brand-50 text-brand-700",
  service: "bg-ink/5 text-ink/65",
};

export function HomeUpdatesStrip() {
  const featured = KYIV_INFO_ITEMS.slice(0, 3);
  return (
    <section className="container-px mx-auto max-w-4xl pt-10" aria-labelledby="kyiv-now-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-brand-700">Оновлено {KYIV_UPDATES_AS_OF}</p>
          <h2 id="kyiv-now-title" className="mt-1 font-display text-xl font-bold text-ink">
            Актуальне для власників тварин
          </h2>
        </div>
        <Link href="/kyiv-updates" className="shrink-0 text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand">
          Усі новини
        </Link>
      </div>

      <RevealGroup className="mt-4 grid gap-3 md:grid-cols-3">
        {featured.map((item) => (
          <article key={item.id} className="rounded-2xl border border-brand-100 bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded-full px-2 py-1 font-semibold ${KIND_TONE[item.kind]}`}>{KIND_LABEL[item.kind]}</span>
              <span className="text-ink/50">{item.dateLabel}</span>
            </div>
            <h3 className="mt-3 font-display text-base font-bold leading-snug text-ink">{item.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-ink/65">{item.summary}</p>
          </article>
        ))}
      </RevealGroup>
      <p className="mt-3 text-xs leading-5 text-ink/50">
        Короткі перевірені підказки без розсилок: події, вакцинації, безпека та міські сервіси. Перед поїздкою звіряйте умови в першоджерелі.
      </p>
    </section>
  );
}
