"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows `value`, tweening from the previous value whenever it changes (for
 * example the "found" count after a radius change). Screen readers get the
 * final number only; reduced-motion users get an instant change.
 */
export function AnimatedNumber({ value, duration = 520, className = "" }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <strong className={`tabular-nums ${className}`}>
      <span aria-hidden key={value} className="num-morph">{shown}</span>
      <span className="sr-only">{value}</span>
    </strong>
  );
}
