import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/vet-pharmacy-near-me";

export const metadata: Metadata = {
  title: "Ветаптека поруч — ветпрепарати у Києві",
  description:
    "Найближчі ветеринарні аптеки Києва: ветпрепарати, вітаміни, антипаразитарні засоби. Відстань і маршрут.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "vet_pharmacy").slice(0, 30);
  return (
    <Landing
      h1="Ветаптека поруч"
      intro="Ветеринарні аптеки Києва поруч з вами. Уточнюйте наявність препаратів телефоном."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=vet_pharmacy"
      ctaLabel="Знайти поруч"
    />
  );
}
