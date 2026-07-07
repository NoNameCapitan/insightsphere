import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";

const PATH = "/pet-services-near-me";

export const metadata: Metadata = {
  title: "Послуги для тварин поруч — Київ",
  description:
    "Ветклініки, зоомагазини, аптеки, грумінг, притулки та інші послуги для тварин поруч у Києві. Геолокація, радіус 1–10 км, маршрут і графік.",
  alternates: { canonical: PATH },
};

export default function Page() {
  const places = PLACES.filter((p) => true).slice(0, 30);
  return (
    <Landing
      h1="Послуги для тварин поруч"
      intro="Усе для вашого улюбленця в одному місці: клініки, магазини, аптеки, грумінг, притулки та сервіси. Натисніть, щоб показати найближчі за вашим розташуванням."
      places={places}
      path={PATH}
      ctaHref="/nearby"
      ctaLabel="Знайти поруч"
    />
  );
}
