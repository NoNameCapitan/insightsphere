"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./HomeHero.module.css";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

// Dust in the lamplight: tiny specks, mostly inside the warm area near the
// lamp (upper right), each on its own slow clock so they never pulse together.
// Positions are fixed so the server and client render the same markup.
const DUST = [
  { x: 84, y: 10, size: 3, depth: 1.4, duration: 34, delay: 0 },
  { x: 72, y: 18, size: 2, depth: 2.4, duration: 28, delay: -7 },
  { x: 91, y: 28, size: 4, depth: 1.1, duration: 38, delay: -15 },
  { x: 64, y: 30, size: 2.5, depth: 2.8, duration: 31, delay: -22 },
  { x: 79, y: 40, size: 2, depth: 1.9, duration: 26, delay: -4 },
  { x: 88, y: 46, size: 3, depth: 1.6, duration: 36, delay: -19 },
  { x: 58, y: 12, size: 2, depth: 2.2, duration: 30, delay: -12 },
  { x: 95, y: 6, size: 2.5, depth: 1.3, duration: 40, delay: -27 },
] as const;

/**
 * The hero "shot": an evening room lit by a lamp just out of frame. The photo
 * sits on a 3D plane; a soft key light, a wrap that settles around the
 * animals and a warm floor bounce sit above it, with dust drifting through the
 * light. It opens like an inhale — the lamp warms up and the eye adjusts —
 * leans gently towards a fine pointer, and pushes in a little on scroll. Text,
 * search and links never move. Everything stops with the pause button or the
 * system "reduce motion".
 */
export function CinematicCompanions() {
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [enabled, setEnabled] = useState(true);
  const scene = useRef<HTMLDivElement>(null);
  const active = enabled && !reduced;

  useEffect(() => {
    const element = scene.current;
    if (!element || !active || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const render = () => {
      element.style.setProperty("--px", x.toFixed(3));
      element.style.setProperty("--py", y.toFixed(3));
      frame = 0;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = element.getBoundingClientRect();
      x = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5));
      y = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5));
      if (!frame) frame = requestAnimationFrame(render);
    };
    const reset = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(render);
    };
    // The text column sits above the scene, so listen on the whole stage.
    const stage = element.closest<HTMLElement>("[data-cinematic-stage]") ?? element;
    stage.addEventListener("pointermove", move, { passive: true });
    stage.addEventListener("pointerleave", reset);
    return () => {
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(frame);
      element.style.removeProperty("--px");
      element.style.removeProperty("--py");
    };
  }, [active]);

  return (
    <div ref={scene} className={styles.scene} data-motion={active ? "on" : "off"}>
      <div className={styles.sceneDepth}>
        <div className={styles.sceneFrame}>
          <Image src="/visuals/care-nearby.webp" alt="Кіт і собака відпочивають поруч удома в теплому вечірньому світлі" fill priority sizes="(max-width: 700px) 100vw, (max-width: 1240px) 94vw, 1184px" className={styles.sceneImage} />
        </div>
      </div>
      <div className={styles.sceneWrap} aria-hidden />
      <div className={styles.sceneFill} aria-hidden />
      <div className={styles.sceneLamp} aria-hidden />
      <div className={styles.sceneLight} aria-hidden />
      <div className={styles.sceneMotes} aria-hidden>
        {DUST.map((speck, index) => (
          <span
            key={index}
            style={{
              left: `${speck.x}%`,
              top: `${speck.y}%`,
              width: speck.size,
              height: speck.size,
              ["--depth" as string]: speck.depth,
              ["--dur" as string]: `${speck.duration}s`,
              animationDelay: `${speck.delay}s`,
            }}
          />
        ))}
      </div>
      <div className={styles.sceneShade} aria-hidden />
      <div className={styles.sceneGrain} aria-hidden />
      <button type="button" className={styles.motionToggle} disabled={reduced} aria-pressed={active} aria-label={reduced ? "Рух зменшено в налаштуваннях системи" : active ? "Зупинити рух сцени" : "Увімкнути рух сцени"} onClick={() => setEnabled(!enabled)}>
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">{active ? <path d="M7 5v10M13 5v10" /> : <path d="m7 4 9 6-9 6V4Z" />}</svg>
        <span>{active ? "Рух увімкнено" : "Без руху"}</span>
      </button>
    </div>
  );
}
