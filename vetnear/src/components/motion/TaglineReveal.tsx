"use client";

import { useEffect, useRef } from "react";

/**
 * Large statement whose words light up one by one, in reading order, as the
 * section scrolls through the viewport. Without JS (or with reduced motion)
 * the whole sentence is simply shown at full strength.
 */
export function TaglineReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const spans = Array.from(node.querySelectorAll<HTMLElement>("[data-word]"));
    node.dataset.live = "1";
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the block's top reaches 88% of the viewport, 1 when its bottom passes 55%.
      const progress = Math.max(0, Math.min(1, (vh * 0.88 - rect.top) / (rect.height + vh * 0.33)));
      const lit = progress * (spans.length + 2);
      spans.forEach((span, i) => span.classList.toggle("is-lit", i < lit));
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
  }, []);

  return (
    <p ref={ref} className={`tagline ${className}`}>
      {words.map((word, i) => (
        <span key={i} data-word className="tagline__word">
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
