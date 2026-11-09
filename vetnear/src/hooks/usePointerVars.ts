"use client";

import { useEffect, type RefObject } from "react";

/**
 * Writes the pointer position, normalised to -1…1 around the element's
 * centre, into `--mx` / `--my` on the element. CSS turns those into 3D tilt
 * and depth parallax, so React never re-renders. Fine pointers only; skipped
 * entirely under prefers-reduced-motion.
 */
export function usePointerVars(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      node.style.setProperty("--mx", x.toFixed(3));
      node.style.setProperty("--my", y.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      x = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2));
      y = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
}
