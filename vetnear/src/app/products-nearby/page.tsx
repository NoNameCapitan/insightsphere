"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Disclaimer } from "@/components/JsonLd";
import { useGeolocation } from "@/hooks/useGeolocation";
import { track } from "@/lib/analytics";
import { INVENTORY, PRODUCTS } from "@/lib/data/products";
import { calculateDistance, formatDistance } from "@/lib/distance";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { getActivePet } from "@/lib/pets/store";
import { getPlaces } from "@/lib/store";
import type { AnimalType, Place, ProductCategory } from "@/lib/types";

const CAT_LABELS: Record<ProductCategory, string> = {
  cat_food: "Корм для котів",
  dog_food: "Корм для собак",
  bird_food: "Корм для птахів",
  litter: "Наповнювачі",
  carriers: "Переноски",
  collars: "Нашийники",
  grooming_products: "Грумінг-товари",
  vet_diet: "Ветдієти",
  pharmacy_otc: "Аптека (без рецепта)",
  accessories: "Аксесуари",
  other_product: "Інше",
};

function freshness(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "вчора";
  return `${days} дн тому`;
}

export default function ProductsNearbyPage() {
  const geo = useGeolocation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [animal, setAnimal] = useState<AnimalType | "all">("all");

  useEffect(() => {
    track("product_search_started");
    if (geo.status === "idle" && !geo.coords) geo.request();
    const pet = getActivePet();
    if (pet) setAnimal(pet.animalType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placesById = useMemo(() => {
    const map = new Map<string, Place>();
    for (const p of getPlaces()) map.set(p.id, p);
    return map;
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (animal !== "all" && p.animalType !== animal && p.animalType !== "other") return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.brand ?? "").toLowerCase().includes(q)) return false;
      return true;
    }).map((product) => {
      const stock = INVENTORY.filter((i) => i.productId === product.id)
        .map((i) => {
          const place = placesById.get(i.placeId);
          const dist =
            place && geo.coords
              ? calculateDistance(geo.coords, { latitude: place.latitude, longitude: place.longitude })
              : null;
          return { inv: i, place, dist };
        })
        .filter((s) => s.place)
        .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))
        .slice(0, 3);
      return { product, stock };
    }).filter((r) => r.stock.length > 0);
  }, [query, category, animal, placesById, geo.coords]);

  const sel = "rounded-xl border border-brand-100 bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold text-ink">Товари поруч</h1>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[11px] font-semibold text-amber">
          <span aria-hidden>◇</span> демо-каталог
        </span>
      </div>
      <p className="mt-1 text-ink/60">Наявність орієнтовна — телефонуйте, щоб підтвердити.</p>

      <div className="mt-4 space-y-2">
        <input
          className="w-full rounded-2xl border border-brand-100 px-4 py-3 text-ink"
          placeholder="Пошук товару або бренду…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <select className={sel} value={category} onChange={(e) => setCategory(e.target.value as ProductCategory | "all")}>
            <option value="all">Усі категорії</option>
            {(Object.keys(CAT_LABELS) as ProductCategory[]).map((c) => (
              <option key={c} value={c}>{CAT_LABELS[c]}</option>
            ))}
          </select>
          <select className={sel} value={animal} onChange={(e) => setAnimal(e.target.value as AnimalType | "all")}>
            <option value="all">Усі тварини</option>
            <option value="cat">Коти</option>
            <option value="dog">Собаки</option>
            <option value="bird">Птахи</option>
            <option value="rodent">Гризуни</option>
            <option value="reptile">Рептилії</option>
          </select>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink/60">Знайдено товарів: <strong className="text-ink">{results.length}</strong></p>

      <ul className="mt-3 space-y-3">
        {results.map(({ product, stock }) => (
          <li key={product.id} className="card p-4">
            <p className="font-display font-bold text-ink">{product.title}</p>
            <p className="text-sm text-ink/60">{product.brand} · {CAT_LABELS[product.category]}</p>
            <ul className="mt-2 divide-y divide-brand-100/70">
              {stock.map(({ inv, place, dist }) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <Link
                      href={`/place/${place!.slug}`}
                      onClick={() => track("product_result_clicked", { productId: product.id, placeId: place!.id })}
                      className="font-medium text-ink transition-colors hover:text-brand"
                    >
                      {place!.name}
                    </Link>
                    <p className="text-xs text-ink/50">
                      {dist != null ? `${formatDistance(dist)} · ` : ""}
                      оновлено {freshness(inv.updatedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-ink">{inv.price} ₴</p>
                    <p className="text-xs text-ink/50">{AVAILABILITY_LABELS[inv.availability]}</p>
                  </div>
                </li>
              ))}
            </ul>
            <a href={`tel:${stock[0].place!.phone}`} className="btn btn-ghost mt-2 w-full py-2 text-sm">
              Зателефонувати, щоб підтвердити
            </a>
          </li>
        ))}
      </ul>

      {results.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-100 p-10 text-center text-ink/50">
          Нічого не знайдено. Спробуйте інший запит або категорію.
        </div>
      )}

      <div className="mt-6">
        <Disclaimer text="Ціни та наявність — демонстраційні дані. У продакшені вони синхронізуються з прайсами закладів (CSV/XLSX/API)." />
      </div>
    </div>
  );
}
