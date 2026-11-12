"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * One small runtime for page-wide motion, so individual components stay
 * untouched:
 *  - pointer spotlight: writes --sx/--sy on the card under a fine pointer;
 *  - scroll reveal: sections that start below the fold rise in once;
 *  - scroll progress: a hairline at the top of the page.
 * Everything is skipped under prefers-reduced-motion.
 */
export function MotionRuntime() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);

  // Pointer spotlight (event delegation, rAF-throttled).
  useEffect(() => {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const event = last;
      if (!event) return;
      const el = (event.target as Element | null)?.closest?.<HTMLElement>(".card, .spot");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${(event.clientX - rect.left).toFixed(0)}px`);
      el.style.setProperty("--sy", `${(event.clientY - rect.top).toFixed(0)}px`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Scroll reveal for sections below the fold; re-armed on navigation.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("sr-shown");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    const timer = window.setTimeout(() => {
      const candidates = document.querySelectorAll<HTMLElement>("main section, main [data-reveal], footer");
      candidates.forEach((el) => {
        if (el.classList.contains("sr-armed") || el.closest(".sr-armed, [data-no-reveal]")) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
        el.classList.add("sr-armed");
        io.observe(el);
      });
    }, 80);
    // Fail open: if the page has not been scrolled shortly after load (a slow
    // device, a screenshot, a reader who is not scrolling yet), show everything
    // rather than keep content hidden behind an effect.
    const showAll = () => document.querySelectorAll(".sr-armed:not(.sr-shown)").forEach((el) => el.classList.add("sr-shown"));
    const safety = window.setTimeout(showAll, 2200);
    const cancelSafety = () => window.clearTimeout(safety);
    window.addEventListener("scroll", cancelSafety, { passive: true, once: true });
    return () => {
      window.clearTimeout(timer);
      cancelSafety();
      window.removeEventListener("scroll", cancelSafety);
      io.disconnect();
      // Never leave anything hidden behind.
      document.querySelectorAll(".sr-armed:not(.sr-shown)").forEach((el) => el.classList.add("sr-shown"));
    };
  }, [pathname]);

  // Scroll progress hairline.
  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      node.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return <div ref={bar} aria-hidden className="scroll-progress" />;
}
