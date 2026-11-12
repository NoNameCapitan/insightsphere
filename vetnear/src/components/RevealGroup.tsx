"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Staggered 3D entrance for a group's direct children: each one swings up
 * from a tilted, receded pose as the group scrolls into view. Server HTML is
 * the final visible state — JS only arms the effect — and it is skipped
 * under prefers-reduced-motion.
 */
export function RevealGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"" | "is-armed" | "is-shown">("");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = node.getBoundingClientRect();
    // Already on screen: leave it alone rather than flashing it out and in.
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) return;
    setState("is-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("is-shown");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(node);
    // Fail open: without a scroll soon after load, show the group anyway.
    const safety = window.setTimeout(() => setState("is-shown"), 2200);
    const cancelSafety = () => window.clearTimeout(safety);
    window.addEventListener("scroll", cancelSafety, { passive: true, once: true });
    return () => {
      io.disconnect();
      cancelSafety();
      window.removeEventListener("scroll", cancelSafety);
    };
  }, []);

  return (
    <div ref={ref} className={`reveal-group ${state} ${className}`}>
      {children}
    </div>
  );
}
