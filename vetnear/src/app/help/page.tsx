import Link from "next/link";
import { NeedRouter } from "@/components/NeedRouter";

export default function HelpPage() {
  return (
    <div className="container-px mx-auto max-w-2xl py-6">
      <Link href="/" className="text-sm text-brand hover:underline">← Головна</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">
        Що потрібно вашому улюбленцю?
      </h1>
      <p className="mt-1 text-ink/60">
        Оберіть ситуацію — ми покажемо найближчі відповідні заклади. Без діагнозів.
      </p>
      <div className="mt-5">
        <NeedRouter />
      </div>
    </div>
  );
}
