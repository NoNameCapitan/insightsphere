import type { Metadata } from "next";
import Link from "next/link";
import { GeneratedVisual } from "@/components/GeneratedVisual";

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="container-px mx-auto max-w-md py-12 text-center">
      <GeneratedVisual
        src="/visuals/j-empty-state.webp"
        className="mx-auto mb-4 h-56 w-full max-w-[320px]"
        motion="tilt"
        glow
        shine
        shadow
        sizes="320px"
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Помилка 404</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Такої сторінки немає</h1>
      <p className="mt-2 text-sm text-ink/65">
        Можливо, посилання застаріло або заклад прибрали з каталогу. Допомогу поруч можна знайти звідси:
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/help" className="btn btn-emergency">Потрібна допомога зараз</Link>
        <Link href="/nearby" className="btn btn-brand">Заклади поруч</Link>
        <Link href="/" className="btn btn-ghost">На головну</Link>
      </div>
    </section>
  );
}
