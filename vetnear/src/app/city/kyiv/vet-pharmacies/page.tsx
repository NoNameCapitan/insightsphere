import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";
import { regionOf } from "@/config/coverage";

const PATH = "/city/kyiv/vet-pharmacies";

export const metadata: Metadata = {
  title: "Ветаптеки Києва — ветпрепарати за районами",
  description:
    "Ветеринарні аптеки Києва: ветпрепарати, вітаміни, антипаразитарні. Адреси та маршрут.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => regionOf(p) === "kyiv_city").filter((p) => p.category === "vet_pharmacy").slice(0, 30);
  return (
    <Landing
      h1="Ветаптеки Києва"
      intro="Каталог ветаптек Києва. Уточнюйте наявність препаратів телефоном."
      places={places}
      path={PATH}
      ctaHref="/nearby?region=kyiv_city&category=vet_pharmacy"
      ctaLabel="Дивитися всі поруч"
    />
  );
}
