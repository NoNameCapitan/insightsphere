"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FavoritePlaceButton } from "@/components/FavoritePlaceButton";
import { getActivePet } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

export function PlaceDetailUtilityActions({ placeId }: { placeId: string }) {
  const [pet, setPet] = useState<PetProfile | null>(null);
  useEffect(() => setPet(getActivePet()), []);
  return <div className="mt-4 flex items-center gap-3 print:hidden">
    <FavoritePlaceButton placeId={placeId} />
    {pet ? <Link href={`/my-pets/${pet.id}`} className="btn btn-ghost flex-1 py-2.5 text-sm">Відкрити медкартку {pet.name}</Link> : <Link href="/my-pets/new" className="btn btn-ghost flex-1 py-2.5 text-sm">Створити медкартку</Link>}
  </div>;
}
