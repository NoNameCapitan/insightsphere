import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/city/kyiv/shelters";

export const metadata: Metadata = {
  title: "Притулки та зоозахист у Києві",
  description:
    "Притулки для тварин і волонтерські організації Києва. Як допомогти, прихистити чи прилаштувати тварину.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => p.category === "shelter" || p.category === "animal_volunteer_help").slice(0, 30);
  return (
    <Landing
      h1="Притулки та зоозахист Києва"
      intro="Притулки та волонтерські ініціативи Києва. Підтримайте, станьте волонтером або прихистіть тварину."
      places={places}
      path={PATH}
      ctaHref="/nearby?category=shelter"
      ctaLabel="Дивитися всі поруч"
    />
  );
}
