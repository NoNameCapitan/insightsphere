import Link from "next/link";
import { redirect } from "next/navigation";
import { NeedRouter } from "@/components/NeedRouter";

export default async function HelpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const urgent = values.urgent === "1";
  if (urgent) {
    const destination = new URLSearchParams();
    for (const key of ["animal", "region", "locality", "district", "radius", "location"]) {
      const value = values[key];
      if (typeof value === "string") destination.set(key, value);
    }
    destination.set("category", "veterinary_clinic");
    destination.set("sort", "distance");
    destination.set("urgent", "1");
    redirect(`/nearby?${destination}`);
  }
  return (
    <div className="operating-screen container-px mx-auto max-w-2xl py-6">
      <Link href="/" className="text-sm text-brand hover:underline">← Головна</Link>
      <h1 className="operating-heading mt-2 font-display text-2xl font-extrabold text-ink">
        {urgent ? "Допомога у терміновій ситуації" : "Що потрібно вашому улюбленцю?"}
      </h1>
      <p className="mt-1 text-ink/60">
        {urgent ? "Прямий зв’язок із клінікою — без реєстрації та опитування." : "Оберіть ситуацію — ми покажемо найближчі відповідні заклади. Без діагнозів."}
      </p>
      <div className="mt-5">
        <NeedRouter key={urgent ? "urgent" : "root"} initialStep={urgent ? "urgent" : "root"} />
      </div>
    </div>
  );
}
