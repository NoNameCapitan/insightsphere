"use client";

import { useEffect, useId, useRef } from 'react';
import { snakeGeometry } from './snake-motion';
import { HERO_INTRO_KEY, HERO_SNAKE_DURATION, heroSnakeFrame } from './hero-snake-motion';

const idle = snakeGeometry(1);
let introClaimed = false;

/** One intro per tab session. No hover replay, interval, or navigation delay. */
export function HeroEmblem() {
  const id = useId().replace(/:/g, '');
  const root = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const bodies = svg.querySelectorAll<SVGPathElement>('[data-snake-body]');
    const heads = svg.querySelectorAll<SVGGElement>('[data-snake-head]');
    const snakes = svg.querySelectorAll<SVGGElement>('[data-snake]');
    let frame = 0, active = false, began = 0;
    const draw = (progress: number, opacity = 1) => {
      const shape = snakeGeometry(progress);
      bodies.forEach(el => el.setAttribute('d', shape.path));
      heads.forEach(el => el.setAttribute('transform', `translate(${shape.head.join(' ')}) rotate(${shape.angle})`));
      snakes.forEach(el => el.setAttribute('opacity', String(opacity)));
      svg.dataset.snakeProgress = progress.toFixed(3);
    };
    const finish = () => {
      cancelAnimationFrame(frame); frame = 0; active = false;
      delete svg.dataset.snakeRunning; svg.dataset.introState = 'complete'; draw(1);
    };
    const tick = (now: number) => {
      if (now - began >= HERO_SNAKE_DURATION) { finish(); return; }
      const pose = heroSnakeFrame(now - began); draw(pose.progress, pose.opacity);
      frame = requestAnimationFrame(tick);
    };
    const startOnce = () => {
      if (document.hidden || active) return;
      let seen = introClaimed;
      try { seen ||= sessionStorage.getItem(HERO_INTRO_KEY) === 'seen'; } catch { /* local fallback */ }
      if (seen) { finish(); return; }
      introClaimed = true;
      try { sessionStorage.setItem(HERO_INTRO_KEY, 'seen'); } catch { /* animation never blocks the app */ }
      if (reduced.matches) { finish(); return; }
      active = true; began = performance.now();
      svg.dataset.introState = 'playing'; svg.dataset.snakeRunning = 'true';
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => { if (document.hidden) { if (active) finish(); } else startOnce(); };
    const preference = () => { if (reduced.matches) finish(); };
    // Defer the claim until the committed effect: Strict Mode's test cleanup
    // cancels this frame and cannot consume the once-only introduction.
    frame = requestAnimationFrame(startOnce);
    reduced.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => { finish(); reduced.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  const snake = <g data-snake fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path data-snake-body d={idle.path} stroke="#102b29" strokeWidth="5" />
    <path data-snake-body d={idle.path} stroke={`url(#${id}-snake)`} strokeWidth="3.3" />
    <path data-snake-body d={idle.path} stroke="#fff4cd" strokeWidth=".65" opacity=".55" />
    <g data-snake-head transform={`translate(${idle.head.join(' ')}) rotate(${idle.angle})`}>
      <path d="M-2.8 -1.3 Q0 -3.5 3.6 -.8 Q5 0 3.6 1.1 Q0 3.5 -2.8 1.3Z" fill="#e6c97d" stroke="#102b29" strokeWidth=".65" />
      <circle cx="1.8" cy="-1" r=".55" fill="#073d35" stroke="none" />
    </g>
  </g>;
  return <svg ref={root} className="hero-emblem-vector" viewBox="19 10 62 80" width="140" height="148" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-cup`} x1="0" y1="0" x2="1" y2=".3"><stop stopColor="#8d702f" /><stop offset=".32" stopColor="#ecd494" /><stop offset=".55" stopColor="#b39550" /><stop offset=".82" stopColor="#f0dea4" /><stop offset="1" stopColor="#8d702f" /></linearGradient>
      <linearGradient id={`${id}-snake`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e8d28c" /><stop offset=".5" stopColor="#cbaa58" /><stop offset="1" stopColor="#efdba4" /></linearGradient>
      <clipPath id={`${id}-front`}><path d="M30 60H72V68H30Z M30 44H72V49H30Z M30 25H72V40H30Z" /></clipPath>
    </defs>
    <path d="M50 12 77 23V51Q77 72 50 86Q23 72 23 51V23Z" fill="#13372e" fillOpacity=".55" stroke="#bfa05d" strokeWidth=".7" />
    <path d="M50 16 73 26V51Q73 68 50 82Q27 68 27 51V26Z" fill="none" stroke="#d1b66e" strokeOpacity=".25" strokeWidth=".45" />
    {snake}
    <g data-static-cup fill={`url(#${id}-cup)`} stroke="#e2c882" strokeWidth=".55">
      <path d="M47 51H53L52 73Q52 77 58 79H42Q48 77 48 73Z" />
      <path d="M33 43Q36 54 50 54Q64 54 67 43Z" />
      <path d="M32 41H68L67 44H33Z" />
      <path d="M43 77H57Q59 78 60 81H40Q41 78 43 77Z" />
      <path d="M35 43H65" fill="none" stroke="#fff1c9" strokeWidth=".6" />
    </g>
    <g clipPath={`url(#${id}-front)`}>{snake}</g>
  </svg>;
}
