import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";
import { regionOf } from "@/config/coverage";

const PATH = "/city/kyiv/grooming";

export const metadata: Metadata = {
  title: "Грумінг у Києві — салони догляду за тваринами",
  description:
    "Салони грумінгу Києва: стрижка, купання, тримінг. Адреси, графік і запис за районами.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => regionOf(p) === "kyiv_city").filter((p) => p.category === "grooming").slice(0, 30);
  return (
    <Landing
      h1="Грумінг у Києві"
      intro="Каталог салонів грумінгу Києва. Натисніть, щоб відсортувати найближчі."
      places={places}
      path={PATH}
      ctaHref="/nearby?region=kyiv_city&category=grooming"
      ctaLabel="Дивитися всі поруч"
    />
  );
}
