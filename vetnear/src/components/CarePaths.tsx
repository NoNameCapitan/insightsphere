import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import type { PlaceCategory } from "@/lib/types";

// Care paths: the pet's need first, the service category second. Health is the
// primary path and gets a full-width featured card; the rest sit in a 2-column
// grid. Categories with no public places are dropped so the homepage never
// advertises an empty result set.

const CARE_PATHS: { category: PlaceCategory; title: string; desc: string }[] = [
  { category: "veterinary_clinic", title: "Здоров’я", desc: "Ветклініки поруч — огляд, лікування, вакцинація" },
  { category: "vet_pharmacy", title: "Ліки", desc: "Ветаптеки поруч" },
  { category: "pet_store", title: "Їжа й товари", desc: "Зоомагазини поруч" },
  { category: "grooming", title: "Догляд", desc: "Грумінг і стрижка" },
  { category: "pet_boarding", title: "Перетримка", desc: "Коли треба залишити улюбленця" },
];

const PUBLIC_COUNT = PLACES.filter(isSearchablePublicPlace).reduce<
  Partial<Record<PlaceCategory, number>>
>((m, p) => {
  m[p.category] = (m[p.category] ?? 0) + 1;
  return m;
}, {});

const VISIBLE = CARE_PATHS.filter((c) => (PUBLIC_COUNT[c.category] ?? 0) > 0);

export function CarePaths({ className = "" }: { className?: string }) {
  const [featured, ...rest] = VISIBLE;
  if (!featured) return null;

  return (
    <section className={className}>
      <div className="mx-auto w-full max-w-5xl px-4">
        <p className="eyebrow">Потреби улюбленця</p>
        <h2 className="mt-1.5 font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Що потрібно вашому улюбленцю?
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/60">
          Оберіть потребу — VetNear покаже відповідні заклади поруч із вами.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ServiceCategoryCard
            category={featured.category}
            label={featured.title}
            description={featured.desc}
            layout="row"
            featured
            href={`/nearby?category=${featured.category}`}
            className="sm:col-span-2"
          />
          {rest.map((c) => (
            <ServiceCategoryCard
              key={c.category}
              category={c.category}
              label={c.title}
              description={c.desc}
              layout="row"
              href={`/nearby?category=${c.category}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
