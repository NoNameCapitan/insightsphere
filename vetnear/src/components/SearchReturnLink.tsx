"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DISCOVERY_RETURN_KEY, DISCOVERY_RESTORE_KEY, safeDiscoveryReturn } from "./discoveryState";

export function SearchReturnLink() {
  const [href, setHref] = useState("/nearby");
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(DISCOVERY_RETURN_KEY) ?? "null");
      if (safeDiscoveryReturn(saved)) setHref(saved.path);
    } catch { /* A blocked session store never prevents returning to search. */ }
  }, []);
  return <Link href={href} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline" onClick={() => {
    try { sessionStorage.setItem(DISCOVERY_RESTORE_KEY, href); } catch { /* Optional scroll recovery. */ }
  }}><span aria-hidden>←</span> До результатів пошуку</Link>;
}
