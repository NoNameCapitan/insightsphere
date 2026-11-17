import type { Metadata } from "next";
import { KyivEventsHub } from "./KyivEventsHub";
import { EVENT_CATEGORIES, type KyivEventCategory } from "@/lib/data/kyivUpdates";

export const metadata: Metadata = {
  title: "Події та можливості для тварин · Київ і Київщина",
  description: "Вакцинації, адопції, події та корисні можливості Києва і Київської області. Дати, умови, першоджерела та збереження у вашому браузері.",
  alternates: { canonical: "/kyiv-updates" },
};
export const dynamic = "force-dynamic";

export default async function KyivUpdatesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const query = await searchParams;
  const category = EVENT_CATEGORIES.includes(query.category as KyivEventCategory) ? query.category as KyivEventCategory : "all";
  return <KyivEventsHub initialCategory={category} initialNow={new Date().toISOString()} />;
}
