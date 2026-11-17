"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
export function LaunchMeasurement() {
  const pathname = usePathname();
  useEffect(() => { track("page_viewed"); }, [pathname]);
  return null;
}
