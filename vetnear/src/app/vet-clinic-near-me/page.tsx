import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/vet-clinic-near-me";

export const metadata: Metadata = {
  title: "Ветклініка поруч — знайти ветеринара у Києві",
  description:
    "Найближчі ветеринарні клініки у Києві: відстань, графік роботи, послуги та маршрут. Геолокація й радіус 1–10 км.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "veterinary_clinic" || p.category === "emergency_vet").slice(0, 30);
  return (
    <Landing
      h1="Ветеринарна клініка поруч"
      intro="Оберіть найближчу ветклініку в Києві за вашим місцезнаходженням — з маршрутом, графіком роботи та послугами."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=veterinary_clinic"
      ctaLabel="Знайти поруч"
    />
  );
}
