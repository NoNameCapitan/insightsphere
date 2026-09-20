import type { SpecialtyId } from "@/lib/vlk-sample-data";

/* Five reference glyphs adapted from Lucide (Stethoscope, Brain, BrainCircuit, Eye, Ear).
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

/**
 * Clinical Motion Atlas — єдиний набір службових line-art іконок.
 * Полотно 24×24, currentColor, однакова товщина ліній, без заливок.
 *
 * Правила якості (іконка живе на 34–50 px, тому вирішує оптика, а не деталь):
 * силует лишається незмінним; другорядний штрих не тонший за 1.3, інакше він
 * зникає; дві паралельні лінії не ближче ніж 1.6 одиниці, інакше вони
 * зливаються в пляму; кожен гліф оптично центрований у полотні 24×24.
 * Рух задається CSS через локальні класи SVG-частин; сама іконка лишається
 * семантично декоративною, а доступна назва належить кнопці спеціальності.
 */

type Props = { id: SpecialtyId; className?: string };

const COMMON = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Therapist() {
  return (
    <>
      <path d="M11 2v2M5 2v2" />
      <path className="si-stethoscope-tube" d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
      <path className="si-stethoscope-tube" d="M8 15a6 6 0 0 0 12 0v-3" />
      <circle className="si-chest-piece si-accent" cx="20" cy="10" r="2" />
      <path className="si-ecg si-accent" strokeWidth="1.35" pathLength="1" d="M2.4 21h2.8l1.1-1.7 1.6 3.4 1.1-1.7h2.7" />
    </>
  );
}

function Surgeon() {
  return (
    <>
      <g className="si-scalpel">
        <path className="si-scalpel-handle" d="m10.5 13.2 2.2 2.2-5.3 5.3a1.55 1.55 0 0 1-2.2-2.2Z" />
        <path className="si-scalpel-blade si-accent" d="m10.5 13.2 8.3-9.4c.4-.5 1-.2 1 .4.3 3.4-1.1 6.2-3.5 8.5l-3.6 2.7Z" />
        <path className="si-scalpel-neck" strokeWidth="1.35" d="m11.4 12.2 2.3 2.3m-6.9 3.4 1.1 1.1m.5-2.7 1.1 1.1" />
        <path className="si-gleam si-accent" strokeWidth="1.3" pathLength="1" d="M15.2 10.7c1.3-1.3 2.2-2.6 2.6-4.1" />
      </g>
      <path className="si-incision si-accent" strokeWidth="1.25" pathLength="1" d="M13.6 20.4h5.4" />
    </>
  );
}

function Neurologist() {
  return (
    <>
      <path className="si-brain-core" d="M17.6 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.6 1.5M18 5.1a4 4 0 0 1 2.5 5.8M18 18a4 4 0 0 0 2-7.5M20 17.5A4 4 0 1 1 12 18a4 4 0 1 1-8-.5M6 18a4 4 0 0 1-2-7.5M6 5.1a4 4 0 0 0-2.5 5.8" />
      <path className="si-neural-signal si-accent" strokeWidth="1.35" pathLength="1" d="M12 6.2v5.1m0 0-2.9-2.2m2.9 2.2 2.9-2.2m-2.9 2.2-2.4 3.2m2.4-3.2 2.4 3.2" />
      <circle className="si-neural-node si-neural-node-core si-accent" cx="12" cy="11.3" r="1.05" strokeWidth="1.35" />
      <circle className="si-neural-node si-neural-node-a si-accent" cx="9.1" cy="9.1" r=".65" strokeWidth="1.25" />
      <circle className="si-neural-node si-neural-node-b si-accent" cx="14.9" cy="9.1" r=".65" strokeWidth="1.25" />
      <circle className="si-neural-node si-neural-node-c si-accent" cx="9.6" cy="14.5" r=".65" strokeWidth="1.25" />
      <circle className="si-neural-node si-neural-node-d si-accent" cx="14.4" cy="14.5" r=".65" strokeWidth="1.25" />
    </>
  );
}

function Psychiatrist() {
  return (
    <>
      <path className="si-psy-brain" d="M10.3 5.6a2.7 2.7 0 0 0-5.1 1 3.7 3.7 0 0 0-1.8 5.6 3.8 3.8 0 0 0 1.7 6.1 2.8 2.8 0 0 0 5.2-1.5Z" />
      <path className="si-psy-center" strokeWidth="1.35" d="M6.5 8.3c1.1.2 1.9.9 2.3 1.9M6 13.8c1.2-.5 2.2-.2 3 1" />
      <path className="si-dialog-bubble si-accent" d="M14.8 5.2h5.1a2 2 0 0 1 2 2v5.4a2 2 0 0 1-2 2h-2l-2.7 2.3v-2.3h-.4a2 2 0 0 1-2-2V7.2a2 2 0 0 1 2-2Z" />
      <path className="si-dialog-one si-accent" pathLength="1" strokeWidth="1.35" d="M15.5 8.5h3.8" />
      <path className="si-dialog-two si-accent" pathLength="1" strokeWidth="1.35" d="M15.5 11.5h3.8" />
    </>
  );
}

function Ophthalmologist() {
  return (
    <>
      <path className="si-eyelid" d="M2.1 12.3a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.8 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.8 0" />
      <circle className="si-pupil si-accent" cx="12" cy="12" r="3" />
      <path className="si-eye-glint si-accent" strokeWidth="1.3" pathLength="1" d="M13.1 10.3 14.2 9.2" />
    </>
  );
}

function Ent() {
  return (
    <>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
      <path className="si-ear-inner si-accent" d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
      <path className="si-sound-wave-one si-accent" strokeWidth="1.4" d="M20.4 7.1a5 5 0 0 1 0 3.8" />
      <path className="si-sound-wave-two si-accent" strokeWidth="1.4" d="M22.3 5.5a7.6 7.6 0 0 1 0 7" />
    </>
  );
}

function Dentist() {
  return (
    <>
      <g className="si-tooth" transform="translate(0.9 0)">
        <path d="M11 4.1C8.5 4.1 7.4 2.5 5.2 3.7 2.6 5.1 3.2 8.6 4.2 11.2c.8 2 1 6.8 2.6 8.7.6.8 1.4.5 1.7-.5.7-2.1.8-6 2.5-6s1.8 3.9 2.5 6c.3 1 1.1 1.3 1.7.5 1.6-1.9 1.8-6.7 2.6-8.7.6-1.5.9-2.9.8-4.1" />
        <path d="M11 4.1c1.6 0 2.5-.8 3.8-.9 2.3-.2 3.7 1.2 3.8 3.9" />
      </g>
      <path className="si-enamel-glint si-accent" pathLength="1" strokeWidth="1.35" d="M7 6.8c-.5.9-.4 2.2 0 3.2" />
      <path className="si-pulp si-accent" strokeWidth="1.3" d="M11.9 7.5v4.2m0-2.3L10.1 8m1.8 1.4L13.7 8" />
    </>
  );
}

function Dermatologist() {
  return (
    <>
      <g className="si-magnifier">
        <circle cx="10" cy="10" r="6.5" />
        <path d="m14.7 14.7 6 6" />
        <g className="si-skin-sample">
          <path className="si-skin-surface" strokeWidth="1.35" d="M6.2 7.3c2.5-.6 5.1-.6 7.6 0" />
          <path className="si-skin-layer-one si-accent" strokeWidth="1.35" d="M6.1 10.1c1.4-.6 2.5.6 3.9 0s2.5.6 3.9 0" />
          <path className="si-skin-layer-two si-accent" strokeWidth="1.35" d="M6.7 12.9c1.1-.5 2 .5 3.1 0s2 .5 3.1 0" />
          <circle className="si-skin-detail si-accent" cx="8.2" cy="8.7" r=".5" strokeWidth="1.25" />
          <circle cx="11.9" cy="8.7" r=".5" strokeWidth="1.25" />
        </g>
      </g>
    </>
  );
}

const GLYPHS: Record<SpecialtyId, () => React.JSX.Element> = {
  therapist: Therapist,
  surgeon: Surgeon,
  neurologist: Neurologist,
  psychiatrist: Psychiatrist,
  ophthalmologist: Ophthalmologist,
  ent: Ent,
  dentist: Dentist,
  dermatologist: Dermatologist,
};

export function SpecialtyIcon({ id, className = "" }: Props) {
  const Glyph = GLYPHS[id];
  if (!Glyph) return null;
  return (
    <svg {...COMMON} aria-hidden="true" focusable="false" className={`si si-${id} ${className}`}>
      <Glyph />
    </svg>
  );
}
