"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./HomeHero.module.css";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

// Six specks of warm light at different depths. Positions are fixed so the
// server and client render the same markup.
const MOTES = [
  { x: 62, y: 22, size: 7, depth: 1.6, delay: 0 },
  { x: 74, y: 58, size: 4, depth: 2.2, delay: -3 },
  { x: 86, y: 34, size: 9, depth: 1.2, delay: -6 },
  { x: 55, y: 70, size: 5, depth: 2.6, delay: -9 },
  { x: 92, y: 74, size: 6, depth: 1.9, delay: -12 },
  { x: 68, y: 44, size: 3, depth: 3, delay: -15 },
] as const;

/**
 * The hero "shot": the photograph sits on a 3D plane behind volumetric light,
 * floating motes and film grain. It opens like a film frame (letterbox bars
 * part, the camera settles in), leans towards a fine pointer with real depth,
 * and pushes in slowly as the page scrolls. Text, search and links never
 * move. Everything stops with the pause button or the system "reduce motion".
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
      <div className={styles.sceneBeam} aria-hidden />
      <div className={styles.sceneLight} aria-hidden />
      <div className={styles.sceneMotes} aria-hidden>
        {MOTES.map((mote, index) => (
          <span
            key={index}
            style={{
              left: `${mote.x}%`,
              top: `${mote.y}%`,
              width: mote.size,
              height: mote.size,
              ["--depth" as string]: mote.depth,
              animationDelay: `${mote.delay}s`,
            }}
          />
        ))}
      </div>
      <div className={styles.sceneShade} aria-hidden />
      <div className={styles.sceneGrain} aria-hidden />
      <div className={styles.letterbox} aria-hidden />
      <button type="button" className={styles.motionToggle} disabled={reduced} aria-pressed={active} aria-label={reduced ? "Рух зменшено в налаштуваннях системи" : active ? "Зупинити рух сцени" : "Увімкнути рух сцени"} onClick={() => setEnabled(!enabled)}>
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">{active ? <path d="M7 5v10M13 5v10" /> : <path d="m7 4 9 6-9 6V4Z" />}</svg>
        <span>{active ? "Рух увімкнено" : "Без руху"}</span>
      </button>
    </div>
  );
}
