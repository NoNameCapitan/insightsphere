import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/grooming-near-me";

export const metadata: Metadata = {
  title: "Грумінг поруч — догляд за тваринами у Києві",
  description:
    "Найближчі салони грумінгу Києва: стрижка, купання, тримінг, догляд за кігтями. Відстань і запис.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "grooming").slice(0, 30);
  return (
    <Landing
      h1="Грумінг поруч"
      intro="Салони грумінгу Києва поруч з вами. Оберіть найближчий та запишіться на догляд."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=grooming"
      ctaLabel="Знайти поруч"
    />
  );
}
