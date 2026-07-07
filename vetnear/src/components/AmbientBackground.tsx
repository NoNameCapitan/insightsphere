"use client";
// Ambient background glow (freeze-polish §8). A very soft teal/warm radial
// gradient that gently follows the pointer on desktop.
//
// Safety/perf rules baked in:
//  - pointer-events-none, fixed, -z-10 → never blocks clicks, no layout shift
//  - rAF loop with lerp; listener is passive; loop stops when idle
//  - touch devices: static centered glow, no pointer tracking
//  - prefers-reduced-motion: static glow, no tracking
//  - opacity is very low → readability untouched
import { useEffect, useRef } from "react";

export function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduced || !finePointer) return; // static glow only

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.35;
    let x = targetX;
    let y = targetY;
    let raf = 0;
    let running = false;

    const tick = () => {
      // Gentle lerp — the glow lags softly behind the cursor.
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      el.style.setProperty("--amb-x", `${x}px`);
      el.style.setProperty("--amb-y", `${y}px`);
      if (Math.abs(targetX - x) < 0.5 && Math.abs(targetY - y) < 0.5) {
        running = false; // settled → stop the loop, zero idle cost
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={
        {
          "--amb-x": "50vw",
          "--amb-y": "35vh",
        } as React.CSSProperties
      }
    >
      {/* Primary calm teal glow — follows the pointer on desktop. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(560px circle at var(--amb-x) var(--amb-y), rgb(14 116 102 / 0.07), transparent 70%)",
        }}
      />
      {/* Soft warm counter-glow, anchored bottom-right for gentle depth. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(680px circle at 85% 90%, rgb(217 164 65 / 0.05), transparent 70%)",
        }}
      />
    </div>
  );
}
