"use client";
import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { snakeFrame, snakeGeometry, SNAKE_DURATION } from "./snake-motion";

type CommandBrandProps = { className?: string; decorative?: boolean; priority?: boolean; size?: number };
const idle = snakeGeometry(1);

/** Entire interactive emblem is vector: no painted-over raster snake. */
export function CommandBrand({className="",decorative=false,priority=false,size=52}:CommandBrandProps) {
  const id=useId().replace(/:/g,"");
  const root=useRef<SVGSVGElement>(null);
  useEffect(()=>{
    const svg=root.current, button=svg?.closest('button');
    if(!svg || !button || decorative) return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0, running=false;
    const draw=(progress:number,opacity=1)=>{
      const shape=snakeGeometry(progress);
      svg.querySelectorAll<SVGPathElement>('[data-snake-body]').forEach(el=>el.setAttribute('d',shape.path));
      svg.querySelectorAll<SVGGElement>('[data-snake-head]').forEach(el=>el.setAttribute('transform',`translate(${shape.head.join(' ')}) rotate(${shape.angle})`));
      svg.querySelectorAll<SVGGElement>('[data-snake]').forEach(el=>el.setAttribute('opacity',String(opacity)));
      svg.dataset.snakeProgress=progress.toFixed(3);
    };
    const finish=()=>{cancelAnimationFrame(frame);frame=0;running=false;delete svg.dataset.snakeRunning;draw(1);};
    const start=()=>{
      if(running || reduced.matches) return;
      running=true;svg.dataset.snakeRunning='true';
      const began=performance.now();
      const tick=(now:number)=>{
        if(now-began>=SNAKE_DURATION){finish();return;}
        const pose=snakeFrame(now-began);draw(pose.progress,pose.opacity);
        frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
    };
    const enter=(event:PointerEvent)=>{if(event.pointerType!=='touch')start();};
    const key=(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' ')start();};
    const visibility=()=>{if(document.hidden)finish();};
    button.addEventListener('pointerenter',enter);
    button.addEventListener('focus',start);
    button.addEventListener('keydown',key);
    reduced.addEventListener('change',finish);
    document.addEventListener('visibilitychange',visibility);
    // Deliberately no pointerleave cancellation or click interception.
    return ()=>{finish();button.removeEventListener('pointerenter',enter);button.removeEventListener('focus',start);button.removeEventListener('keydown',key);reduced.removeEventListener('change',finish);document.removeEventListener('visibilitychange',visibility);};
  },[decorative]);
  if(decorative) return <Image src="/vlk-command-emblem.png" unoptimized width={size} height={size} sizes={`${size}px`} priority={priority} alt="" aria-hidden className={`object-contain ${className}`} />;
  const snake=<g data-snake fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path data-snake-body d={idle.path} stroke="#faf6e9" strokeWidth="4.8" />
    <path data-snake-body d={idle.path} stroke="#075348" strokeWidth="3.4" />
    <g data-snake-head transform={`translate(${idle.head.join(' ')}) rotate(${idle.angle})`}>
      <path d="M-2.8 -1.3 Q0 -3.5 3.6 -.8 Q5 0 3.6 1.1 Q0 3.5 -2.8 1.3Z" fill="#075348" stroke="#faf6e9" strokeWidth=".55" />
      <circle cx="1.8" cy="-1" r=".5" fill="#faf6e9" stroke="none" />
    </g>
  </g>;
  return <svg ref={root} className={`command-brand-vector ${className}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Емблема VLK Навігатора 402" focusable="false">
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d3b768"/><stop offset=".55" stopColor="#a8842b"/><stop offset="1" stopColor="#c5a14c"/></linearGradient>
      <clipPath id={`${id}-front`}><path d="M30 60H72V68H30Z M30 44H72V49H30Z M30 25H72V40H30Z"/></clipPath>
    </defs>
    <path d="M50 3Q52 3 55 5L83 22Q86 24 86 29V65Q86 68 82 71L65 81V89L50 98 35 89V81L18 71Q14 68 14 65V29Q14 25 18 22L45 5Q48 3 50 3Z" fill="#073d35"/>
    <path d="M50 8L81 27V65L62 77V87L50 94 38 87V77L19 65V27Z" fill="#faf6e9" stroke="#faf6e9" strokeWidth="2"/>
    <path d="M50 10L79 28V64L60 76V86L50 92 40 86V76L21 64V28Z" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.4"/>
    <path d="M50 15L52 20H57L53 23 54 28 50 25 46 28 47 23 43 20H48Z" fill={`url(#${id}-gold)`}/>
    <g fill="#073d35"><path d="M34 22H42L43 25H30Z M29 27H44L45 30H26Z M66 22H58L57 25H70Z M71 27H56L55 30H74Z"/></g>
    {[false,true].map(mirror=><g key={String(mirror)} transform={mirror?'translate(100 0) scale(-1 1)':undefined} fill="#075348">
      <path d="M39 79Q23 65 27 38" fill="none" stroke="#075348" strokeWidth="1"/>
      {[0,1,2,3,4,5].map(i=><g key={i} transform={`translate(${27+i*i*.32} ${38+i*6.8}) rotate(${-15+i*7})`}><path d="M0 6Q-7 2 -3 -4Q2 0 0 6Z"/><path d="M0 8Q7 4 6 -2Q0 1 0 8Z"/></g>)}
    </g>)}
    {snake}
    <g data-static-cup fill={`url(#${id}-gold)`} stroke="#faf6e9" strokeWidth=".8">
      <path d="M47 51H53L52 73Q52 77 58 79H42Q48 77 48 73Z"/>
      <path d="M33 43Q36 54 50 54Q64 54 67 43Z"/>
      <path d="M32 41H68L67 44H33Z"/>
      <path d="M43 77H57Q59 78 60 81H40Q41 78 43 77Z"/>
    </g>
    <g clipPath={`url(#${id}-front)`}>{snake}</g>
    <path d="M39 82L50 88 61 82V86L50 92 39 86Z" fill={`url(#${id}-gold)`}/>
  </svg>;
}
