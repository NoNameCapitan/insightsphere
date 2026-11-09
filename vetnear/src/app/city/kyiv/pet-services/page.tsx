import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/city/kyiv/pet-services";

export const metadata: Metadata = {
  title: "Послуги для тварин у Києві — каталог і карта",
  description:
    "Повний каталог послуг для тварин у Києві: клініки, магазини, аптеки, грумінг, притулки. За районами та з маршрутом.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => true).slice(0, 30);
  return (
    <Landing
      h1="Послуги для тварин у Києві"
      intro="Каталог закладів для тварин у Києві за всіма категоріями. Натисніть, щоб відсортувати найближчі."
      places={places}
      path={PATH}
      ctaHref="/nearby"
      ctaLabel="Дивитися всі поруч"
    />
  );
}
