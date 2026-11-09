"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export type VisualMotion = "float" | "drift" | "tilt" | "bob" | "sway" | "none";

/**
 * Decorative generated artwork with a layered motion system:
 *  - reveal:   one-shot entrance (fade + rise + de-blur) when scrolled into view
 *  - motion:   idle loop (float / drift / bob / sway) or pointer tilt
 *  - glow:     breathing mint aura behind the object
 *  - shine:    glossy light sweep clipped to the artwork's own silhouette
 *  - shadow:   contact shadow that breathes with the float loop
 *  - parallax: subtle scroll-linked depth offset
 * Everything is disabled under prefers-reduced-motion (see globals.css).
 * SSR renders the final, fully visible state; JS only "arms" the reveal.
 */
export function GeneratedVisual({
  src,
  alt = "",
  className = "",
  priority = false,
  sizes = "(max-width: 640px) 90vw, 720px",
  motion = "float",
  reveal = true,
  glow = false,
  shine = false,
  shadow = false,
  parallax = 0,
  delay = 0,
  fit = "contain",
}: {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  motion?: VisualMotion;
  reveal?: boolean;
  glow?: boolean;
  shine?: boolean;
  shadow?: boolean;
  /** Scroll depth factor, e.g. 0.06. 0 disables parallax. */
  parallax?: number;
  /** Entrance delay in ms (useful for staggering several visuals). */
  delay?: number;
  fit?: "contain" | "cover";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealState, setRevealState] = useState<"idle" | "armed" | "shown">("idle");

  // Entrance reveal: arm after mount, show once ~15% is visible.
  useEffect(() => {
    const node = ref.current;
    if (!reveal || !node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = node.getBoundingClientRect();
    // Already on screen at first paint (hero art): animate in immediately.
    const visibleNow = rect.top < window.innerHeight && rect.bottom > 0;
    setRevealState("armed");
    if (visibleNow) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setRevealState("shown")));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealState("shown");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reveal]);

  // Scroll-linked parallax (rAF-throttled, passive listener).
  useEffect(() => {
    const node = ref.current;
    if (!parallax || !node) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const offset = rect.top + rect.height / 2 - window.innerHeight / 2;
      const clamped = Math.max(-80, Math.min(80, offset * parallax));
      node.style.setProperty("--visual-py", `${clamped.toFixed(1)}px`);
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
  }, [parallax]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (motion !== "tilt" || event.pointerType === "touch" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.setProperty("--visual-rx", `${(y * -10).toFixed(2)}deg`);
    ref.current.style.setProperty("--visual-ry", `${(x * 12).toFixed(2)}deg`);
    ref.current.style.setProperty("--visual-gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    ref.current.style.setProperty("--visual-gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  };

  const reset = () => {
    ref.current?.style.setProperty("--visual-rx", "0deg");
    ref.current?.style.setProperty("--visual-ry", "0deg");
  };

  const maskStyle = { "--visual-mask": `url("${src}")`, "--visual-delay": `${delay}ms` } as CSSProperties;

  return (
    <div
      ref={ref}
      className={[
        "generated-visual",
        `generated-visual--${motion}`,
        fit === "cover" ? "generated-visual--cover" : "",
        revealState !== "idle" ? `generated-visual--reveal-${revealState}` : "",
        className,
      ].join(" ")}
      style={maskStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      aria-hidden={alt ? undefined : true}
    >
      {glow && <span aria-hidden className="generated-visual__glow" />}
      {shadow && <span aria-hidden className="generated-visual__shadow" />}
      <div className="generated-visual__stage">
        <div className="generated-visual__motion">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            quality={92}
            className="generated-visual__image"
          />
          {shine && <span aria-hidden className="generated-visual__shine" />}
        </div>
      </div>
    </div>
  );
}
