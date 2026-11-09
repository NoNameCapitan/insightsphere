"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-px mx-auto max-w-md py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Щось пішло не так</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Не вдалося показати сторінку</h1>
      <p className="mt-2 text-sm text-ink/65">
        Це збій на нашому боці. Спробуйте ще раз. Якщо ситуація термінова — не чекайте, телефонуйте в
        найближчу клініку.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={() => retry()} className="btn btn-brand">Спробувати ще раз</button>
        <Link href="/help" className="btn btn-emergency">Термінова допомога</Link>
        <Link href="/" className="btn btn-ghost">На головну</Link>
      </div>
    </section>
  );
}
