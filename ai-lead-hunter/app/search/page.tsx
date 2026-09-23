import { Suspense } from "react";
import SearchView from "@/components/SearchView";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-app py-10 text-sm text-slate-500">
          Завантаження пошуку…
        </div>
      }
    >
      <SearchView />
    </Suspense>
  );
}
