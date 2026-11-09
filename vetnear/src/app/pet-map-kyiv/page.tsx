import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { MapEmbed } from "@/components/MapEmbed";
import { PLACES } from "@/lib/data/places";
import { itemListJsonLd, SITE } from "@/lib/seo";

const PATH = "/pet-map-kyiv";

export const metadata: Metadata = {
  title: "Карта закладів для тварин у Києві",
  description:
    "Інтерактивна карта ветклінік, зоомагазинів, аптек, грумінгу та притулків Києва. Маркери згруповано за категоріями.",
  alternates: { canonical: PATH },
  openGraph: { title: "Карта VetNear — Київ", url: `${SITE.url}${PATH}`, type: "website" },
};

export default function PetMapKyivPage() {
  return (
    <div className="container-px mx-auto max-w-4xl py-6">
      <JsonLd data={itemListJsonLd(PLACES.slice(0, 30), `${SITE.url}${PATH}`)} />
      <h1 className="font-display text-2xl font-extrabold text-ink">Карта закладів для тварин у Києві</h1>
      <p className="mt-2 text-ink/70">
        Перегляньте ветклініки, зоомагазини, аптеки, грумінг та притулки на карті.
        Кольори маркерів відповідають категоріям.
      </p>
      <div className="mt-4">
        <MapEmbed />
      </div>
      <div className="mt-4">
        <Link href="/nearby" className="btn btn-brand">Пошук поруч за моїм розташуванням</Link>
      </div>
    </div>
  );
}
