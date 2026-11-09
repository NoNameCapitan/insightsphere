import Link from "next/link";
import { SITE } from "@/lib/seo";

export type LegalSection = { title: string; body: React.ReactNode };

/** Shared calm long-read layout for /privacy and /terms. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <article className="container-px mx-auto max-w-2xl py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{SITE.name}</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
      <p className="mt-1 text-xs text-ink/45">Оновлено: {updated}</p>
      <div className="mt-4 text-sm leading-6 text-ink/75">{intro}</div>

      <div className="mt-6 space-y-6">
        {sections.map((s, i) => (
          <section key={s.title}>
            <h2 className="font-display text-base font-bold text-ink">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-2 space-y-2 text-sm leading-6 text-ink/75 [&_a]:text-brand-700 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 border-t border-brand-100 pt-4 text-xs text-ink/50">
        <Link href="/privacy" className="hover:text-brand">Конфіденційність</Link>
        {" · "}
        <Link href="/terms" className="hover:text-brand">Умови користування</Link>
        {" · "}
        <Link href="/" className="hover:text-brand">На головну</Link>
      </p>
    </article>
  );
}

/** Contact line: the configured e-mail, or the in-product report channel. */
export function LegalContact() {
  if (SITE.contactEmail) {
    return (
      <p>
        Напишіть нам: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Відповідаємо протягом
        30 днів.
      </p>
    );
  }
  return (
    <p>
      Звернутися можна через кнопку «Повідомити про неточність» на сторінці будь-якого закладу або через форму{" "}
      <Link href="/add-place">«Додати заклад»</Link>.
    </p>
  );
}
