import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/pet-store-near-me";

export const metadata: Metadata = {
  title: "Зоомагазин поруч — корми та товари для тварин у Києві",
  description:
    "Найближчі зоомагазини Києва: корми, аксесуари, наповнювачі, переноски. Відстань, графік і маршрут.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "pet_store").slice(0, 30);
  return (
    <Landing
      h1="Зоомагазин поруч"
      intro="Зоомагазини Києва з кормами та товарами для тварин. Знайдіть найближчий за вашим розташуванням."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=pet_store"
      ctaLabel="Знайти поруч"
    />
  );
}
