"use client";

import { useRouter } from "next/navigation";
import { DistrictMap3D } from "@/components/DistrictMap3D";

/** Home section: pick a Kyiv district on the 3D map and jump to its places. */
export function HomeDistricts() {
  const router = useRouter();
  return (
    <section className="container-px mx-auto max-w-3xl pt-12">
      <div className="rounded-3xl border border-brand-100 bg-surface p-4 shadow-card sm:p-6">
        <p className="text-xs font-semibold text-brand-700">10 районів Києва</p>
        <h2 className="mt-0.5 font-display text-xl font-bold text-ink">Оберіть свій район</h2>
        <p className="mt-1 text-sm text-ink/55">Натисніть район — покажемо заклади саме в ньому.</p>
        <DistrictMap3D
          className="mt-2"
          value={null}
          allowAll={false}
          onChange={(district) => {
            if (district !== "all") router.push(`/nearby?district=${district}&radius=10000`);
          }}
        />
      </div>
    </section>
  );
}
