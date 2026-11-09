"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// The ten B-asset icons, sliced from the generated sprite so each one can
// pop in on its own beat and bounce on hover.
const ICONS = [
  "clinic",
  "pharmacy",
  "boarding",
  "grooming",
  "emergency",
  "shield",
  "location",
  "phone",
  "route",
  "verified",
] as const;

export function IconShowcase({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"" | "is-armed" | "is-shown">("");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setState("is-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("is-shown");
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className={`icon-showcase grid grid-cols-5 gap-2.5 sm:gap-4 ${state} ${className}`}>
      {ICONS.map((name, i) => (
        <span key={name} className="icon-tile" style={{ ["--i" as string]: i }}>
          <Image src={`/visuals/parts/icon-${name}.webp`} alt="" width={160} height={160} sizes="(max-width: 640px) 18vw, 120px" />
        </span>
      ))}
    </div>
  );
}
