"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/**
 * Pointer-driven 3D tilt with a specular glare that follows the cursor.
 * Children can opt into depth with the `tilt-pop` / `tilt-pop-lg` classes.
 * Touch input is ignored (cards stay calm under a finger); reduced motion
 * flattens everything in globals.css.
 */
export function Tilt3D({
  children,
  className = "",
  bodyClassName = "",
  max = 9,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  /** Classes for the rotating body — pass the child's border radius here. */
  bodyClassName?: string;
  /** Maximum tilt in degrees. */
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || event.pointerType === "touch") return;
    const { clientX, clientY } = event;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = node.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty("--tilt-rx", `${(-y * max * 2).toFixed(2)}deg`);
      node.style.setProperty("--tilt-ry", `${(x * max * 2).toFixed(2)}deg`);
      node.style.setProperty("--tilt-gx", `${((x + 0.5) * 100).toFixed(1)}%`);
      node.style.setProperty("--tilt-gy", `${((y + 0.5) * 100).toFixed(1)}%`);
      node.dataset.tilting = "1";
    });
  };

  const reset = () => {
    const node = ref.current;
    if (!node) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    node.style.setProperty("--tilt-rx", "0deg");
    node.style.setProperty("--tilt-ry", "0deg");
    delete node.dataset.tilting;
  };

  return (
    <div ref={ref} className={`tilt3d ${className}`} onPointerMove={handleMove} onPointerLeave={reset}>
      <div className={`tilt3d__body ${bodyClassName}`}>
        {children}
        {glare && <span aria-hidden className="tilt3d__glare" />}
      </div>
    </div>
  );
}
