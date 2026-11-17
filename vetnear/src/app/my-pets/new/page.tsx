"use client";

import Link from "next/link";
import { PetProfileForm } from "@/components/PetProfileForm";

export default function NewPetPage() {
  return (
    <div className="container-px operating-screen mx-auto max-w-xl py-8">
      <Link href="/my-pets" className="text-sm font-medium text-brand hover:underline">Мої тварини</Link>
      <h1 className="operating-heading mt-3 font-display text-3xl font-bold text-ink">Нова медична картка</h1>
      <p className="mt-2 text-sm leading-6 text-ink/55">Почніть з імені та виду. Наступну подію й контакт ветеринара додасте у своїй картці.</p>
      <div className="mt-5">
        <PetProfileForm />
      </div>
    </div>
  );
}
