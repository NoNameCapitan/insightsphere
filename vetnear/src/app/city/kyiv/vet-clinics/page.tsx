import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/city/kyiv/vet-clinics";

export const metadata: Metadata = {
  title: "Ветклініки Києва — список і карта ветеринарів",
  description:
    "Ветеринарні клініки Києва: адреси, графік, послуги, рейтинг і маршрут. Знайдіть ветеринара у своєму районі.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "veterinary_clinic" || p.category === "emergency_vet").slice(0, 30);
  return (
    <Landing
      h1="Ветклініки Києва"
      intro="Каталог ветеринарних клінік Києва з графіком та послугами. Натисніть, щоб відсортувати найближчі."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=veterinary_clinic"
      ctaLabel="Дивитися всі поруч"
    />
  );
}
