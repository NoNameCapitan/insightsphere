"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { DISTRICT_SHAPES, KYIV_MAP_VIEWBOX } from "@/lib/geo/kyivDistrictShapes";
import { ALL_DISTRICTS, DISTRICT_LABELS } from "@/lib/labels";
import type { KyivDistrict } from "@/lib/types";
import styles from "./DistrictMap3D.module.css";

const { width: W, height: H } = KYIV_MAP_VIEWBOX;
const VIEWBOX = `0 0 ${W} ${H}`;
const REST_TRANSFORM = "rotateX(32deg) rotateZ(-10deg)";
const TONES = ["#76b7a2", "#4e9287", "#6fa89c", "#91c4ad", "#679f90", "#8db6a5", "#568e83", "#8abca7", "#6ba294", "#a2c8b2"];
const shortName = (district: KyivDistrict) => DISTRICT_LABELS[district].replace(" район", "");

function placesWord(count: number): string {
  const digit = count % 10;
  const hundred = count % 100;
  if (digit === 1 && hundred !== 11) return "заклад";
  if (digit >= 2 && digit <= 4 && (hundred < 10 || hundred > 20)) return "заклади";
  return "закладів";
}

/** Real OSM geometry, a stable hit surface, and an equivalent HTML selector. */
export function DistrictMap3D({ value, onChange, allowAll = true, className = "", mode = "compact", showSearchLink = false }: {
  value: KyivDistrict | "all" | null;
  onChange: (district: KyivDistrict | "all") => void;
  allowAll?: boolean;
  className?: string;
  mode?: "compact" | "cinematic";
  showSearchLink?: boolean;
}) {
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [hovered, setHovered] = useState<KyivDistrict | null>(null);
  const [focused, setFocused] = useState<KyivDistrict | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [keyboardInput, setKeyboardInput] = useState(false);
  const selected = value && value !== "all" ? value : null;
  const shown = keyboardInput && focused ? focused : hovered ?? selected;
  const motion = !paused && !reducedMotion;

  const counts = useMemo(() => {
    const result = Object.fromEntries(ALL_DISTRICTS.map((district) => [district, 0])) as Record<KyivDistrict, number>;
    for (const place of PLACES) {
      if (place.district && isSearchablePublicPlace(place) && place.district in result) result[place.district] += 1;
    }
    return result;
  }, []);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) {
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
        if (boardRef.current) boardRef.current.style.transform = REST_TRANSFORM;
      }
    };
    sync();
    preference.addEventListener("change", sync);
    return () => {
      preference.removeEventListener("change", sync);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  // One bounded arrival when the scene enters view; there is no idle loop.
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera || !motion || mode !== "cinematic" || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      camera.dataset.entered = "true";
      observer.disconnect();
    }, { threshold: 0.15 });
    observer.observe(camera);
    return () => observer.disconnect();
  }, [mode, motion]);

  const resetCamera = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (boardRef.current) boardRef.current.style.transform = REST_TRANSFORM;
  };
  const choose = (district: KyivDistrict) => onChange(allowAll && district === selected ? "all" : district);
  const preview = (event: ReactPointerEvent, district: KyivDistrict) => {
    if (event.pointerType === "touch") return;
    setKeyboardInput(false);
    setHovered(district);
  };
  const onKey = (event: KeyboardEvent<SVGPathElement>, district: KyivDistrict) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(district); }
  };
  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!motion || event.pointerType === "touch" || frame.current || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const { clientX, clientY } = event;
    setKeyboardInput(false);
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const stage = stageRef.current;
      const board = boardRef.current;
      if (!stage || !board) return;
      const rect = stage.getBoundingClientRect();
      const x = Math.max(-0.5, Math.min(0.5, (clientX - rect.left) / rect.width - 0.5));
      const y = Math.max(-0.5, Math.min(0.5, (clientY - rect.top) / rect.height - 0.5));
      board.style.transform = `rotateX(${32 - y * 6}deg) rotateZ(${-10 + x * 5}deg)`;
    });
  };
  const searchHref = selected ? `/nearby?region=kyiv_city&district=${selected}&radius=10000&location=manual` : "/nearby?region=kyiv_city&location=manual";

  return (
    <div className={`${styles.map} ${mode === "cinematic" ? styles.cinematic : styles.compact} ${className}`} data-district-map
      data-motion={motion ? "enabled" : "paused"} data-input={keyboardInput ? "keyboard" : "pointer"}
      onKeyDownCapture={() => { setKeyboardInput(true); resetCamera(); }} onPointerDownCapture={() => setKeyboardInput(false)}
      onFocusCapture={(event) => { if (event.target.matches(":focus-visible")) { setKeyboardInput(true); resetCamera(); } }}>
      <div ref={stageRef} className={styles.stage} onPointerMove={handleMove} onPointerLeave={() => { resetCamera(); setHovered(null); }}>
        <div className={styles.stageHeader}>
          <span className={styles.cityName}>Київ<span>10 районів</span></span>
          <button type="button" className={styles.motionButton} aria-pressed={!paused && !reducedMotion}
            aria-label={reducedMotion ? "Системний режим без руху" : paused ? "Увімкнути рух карти" : "Зупинити рух карти"}
            disabled={reducedMotion} onClick={() => { setPaused((current) => !current); resetCamera(); }}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden>{motion ? <path d="M5.5 4v8m5-8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : <path d="m5.5 3.5 6 4.5-6 4.5v-9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />}</svg>
            <span>{reducedMotion ? "Без руху" : paused ? "Рух вимкнено" : "Рух карти"}</span>
          </button>
        </div>
        <div ref={cameraRef} className={styles.camera}>
          <div ref={boardRef} className={styles.board}>
            <svg viewBox={VIEWBOX} className={styles.ground} aria-hidden>{ALL_DISTRICTS.map((district) => <path key={district} d={DISTRICT_SHAPES[district].path} fillRule="evenodd" />)}</svg>
            {ALL_DISTRICTS.map((district, index) => (
              <div key={district} className={styles.piece} data-active={shown === district ? "true" : undefined} data-selected={selected === district ? "true" : undefined}
                style={{ "--district-tone": TONES[index] } as CSSProperties} aria-hidden>
                <svg viewBox={VIEWBOX} className={`${styles.side} ${styles.sideLow}`}><path d={DISTRICT_SHAPES[district].path} fillRule="evenodd" /></svg>
                <svg viewBox={VIEWBOX} className={styles.side}><path d={DISTRICT_SHAPES[district].path} fillRule="evenodd" /></svg>
                <svg viewBox={VIEWBOX} className={styles.face}><path d={DISTRICT_SHAPES[district].path} fillRule="evenodd" /></svg>
                <svg viewBox={VIEWBOX} className={styles.faceLight}><path d={DISTRICT_SHAPES[district].path} fillRule="evenodd" /></svg>
              </div>
            ))}
            <svg viewBox={VIEWBOX} className={styles.hit} role="group" aria-label="Райони Києва на карті" aria-describedby={`${id}-hint`}>
              {ALL_DISTRICTS.map((district) => (
                <path key={district} d={DISTRICT_SHAPES[district].path} fillRule="evenodd" role="button" tabIndex={0} aria-pressed={selected === district}
                  aria-label={`${DISTRICT_LABELS[district]}: ${counts[district]} ${placesWord(counts[district])} у каталозі`}
                  onPointerEnter={(event) => preview(event, district)} onPointerLeave={() => setHovered((current) => current === district ? null : current)}
                  onFocus={() => setFocused(district)} onBlur={() => setFocused(null)} onClick={() => choose(district)} onKeyDown={(event) => onKey(event, district)} />
              ))}
            </svg>
          </div>
        </div>
        <div className={styles.mapLabel} aria-hidden>
          <span className={styles.locationMark}><svg viewBox="0 0 20 20" fill="none"><path d="M10 17s5-4.6 5-9A5 5 0 0 0 5 8c0 4.4 5 9 5 9Z" stroke="currentColor" strokeWidth="1.4" /><circle cx="10" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.4" /></svg></span>
          <span>{shown ? shortName(shown) : "Ваш район. Ваша турбота."}<small>{shown ? `${counts[shown]} ${placesWord(counts[shown])} у каталозі` : "Оберіть район на карті або у списку"}</small></span>
        </div>
        <p className={styles.coordinates} aria-hidden>50.45° N · 30.52° E</p>
      </div>
      <div className={styles.controls}>
        <div className={styles.selection}>
          <p className={styles.selectionTitle}>{selected ? DISTRICT_LABELS[selected] : "Турбота у вашому районі"}</p>
          <p className={styles.selectionText}>{selected ? `${counts[selected]} ${placesWord(counts[selected])} у стартовому каталозі. Перед візитом уточніть графік і прийом телефоном.` : `${total} ${placesWord(total)} у стартовому каталозі Києва. Оберіть район, щоб звузити пошук.`}</p>
        </div>
        <p id={`${id}-hint`} className={styles.hint}>На карті або зі списку</p>
        <ul className={styles.legend} aria-label="Оберіть район Києва зі списку">
          {allowAll && <li className={styles.allItem}><button type="button" className={styles.districtButton} aria-pressed={!selected} onClick={() => onChange("all")}>Усі райони <span>{total}</span></button></li>}
          {ALL_DISTRICTS.map((district) => <li key={district}>
            <button type="button" className={styles.districtButton} aria-pressed={selected === district} onClick={() => choose(district)}
              onPointerEnter={(event) => preview(event, district)} onPointerLeave={() => setHovered((current) => current === district ? null : current)}
              onFocus={() => setFocused(district)} onBlur={() => setFocused(null)}>
              {shortName(district)}<span aria-hidden>{selected === district ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 6 2.3 2.3 4.7-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : counts[district]}</span>
            </button>
          </li>)}
        </ul>
        <p className={styles.srOnly} role="status" aria-live="polite">{selected ? `Обрано ${DISTRICT_LABELS[selected]}. ${counts[selected]} ${placesWord(counts[selected])} у каталозі.` : "Пошук за всіма районами Києва."}</p>
        {showSearchLink && <Link href={searchHref} className={styles.searchLink}>{selected ? `Заклади: ${DISTRICT_LABELS[selected]}` : "Усі заклади Києва"}<svg viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>}
        <p className={styles.credit}>Схематичні межі © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Для вибору району, не навігації.</p>
      </div>
    </div>
  );
}
