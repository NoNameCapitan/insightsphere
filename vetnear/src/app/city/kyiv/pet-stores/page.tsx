import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/city/kyiv/pet-stores";

export const metadata: Metadata = {
  title: "Зоомагазини Києва — каталог товарів для тварин",
  description:
    "Зоомагазини Києва: корми, аксесуари, наповнювачі. Адреси, графік і маршрут за районами.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "pet_store").slice(0, 30);
  return (
    <Landing
      h1="Зоомагазини Києва"
      intro="Каталог зоомагазинів Києва. Натисніть, щоб відсортувати найближчі за вашим розташуванням."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=pet_store"
      ctaLabel="Дивитися всі поруч"
    />
  );
}
