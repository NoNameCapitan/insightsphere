"use client";

import Link from "next/link";
import { PetProfileForm } from "@/components/PetProfileForm";

export default function NewPetPage() {
  return (
    <div className="container-px mx-auto max-w-xl py-6">
      <Link href="/my-pets" className="text-sm text-brand hover:underline">← Мої тварини</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">Новий улюбленець</h1>
      <p className="mt-1 text-ink/60">Дані зберігаються лише у вашому браузері.</p>
      <div className="mt-5">
        <PetProfileForm />
      </div>
    </div>
  );
}
