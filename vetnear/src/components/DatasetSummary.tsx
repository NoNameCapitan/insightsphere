// Small, honest dataset summary for the hackathon demo. Counts are derived from
// the bundled dataset so the numbers stay correct if the data changes.
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { hasPhoneConfirmedEmergency } from "@/lib/data/verification";
import { PLACES } from "@/lib/data/places";
import type { PlaceCategory } from "@/lib/types";

const ORDER: { category: PlaceCategory; label: string }[] = [
  { category: "veterinary_clinic", label: "ветклінік" },
  { category: "pet_store", label: "зоомагазинів" },
  { category: "vet_pharmacy", label: "ветаптек" },
  { category: "grooming", label: "салонів грумінгу" },
  { category: "pet_boarding", label: "перетримка" },
  { category: "shelter", label: "притулків" },
  { category: "dog_training", label: "дресура" },
  { category: "pet_friendly_place", label: "місць, дружніх до тварин" },
];

export function DatasetSummary({ className = "" }: { className?: string }) {
  const publicPlaces = PLACES.filter(isSearchablePublicPlace);
  const verifiedCount = publicPlaces.filter((p) => p.verificationStatus === "verified").length;
  const reviewCount = publicPlaces.filter((p) => p.verificationStatus === "needs_review").length;
  const counts = publicPlaces.reduce<Partial<Record<PlaceCategory, number>>>((m, p) => {
    m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, {});
  const parts = ORDER.filter(({ category }) => (counts[category] ?? 0) > 0).map(
    ({ category, label }) => `${counts[category]} ${label}`,
  );
  const emergencyNote = hasPhoneConfirmedEmergency(PLACES)
    ? "Невідкладну допомогу підтверджено дзвінком."
    : "Невідкладні/цілодобові заклади додаються тільки після підтвердження дзвінком.";

  return (
    <section className={`container-px mx-auto max-w-3xl ${className}`}>
      <div className="rounded-2xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-sm text-ink/70">
        <span className="font-semibold text-ink">Пілотна база Києва:</span>{" "}
        {publicPlaces.length} місць — {verifiedCount} перевірено за публічними джерелами,{" "}
        {reviewCount} очікують ручної перевірки · {parts.join(" · ")}.{" "}
        <span className="text-ink/60">Перед візитом зателефонуйте. {emergencyNote}</span>
      </div>
    </section>
  );
}
