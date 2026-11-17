import type { Metadata } from "next";
import { SavedPlacesClient } from "@/components/SavedPlacesClient";

export const metadata: Metadata = {
  title: "Збережені місця",
  description: "Ваші збережені контакти ветеринарів та інших сервісів для тварин.",
  robots: { index: false, follow: false },
};

export default function SavedPlacesPage() { return <SavedPlacesClient />; }
