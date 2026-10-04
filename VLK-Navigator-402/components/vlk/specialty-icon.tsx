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
 * Clinical Motion Atlas — custom 24×24 glyphs for the existing 36/40px plates.
 * Graphite contours, green functional details and a restrained translucent wash.
 * Keep independent shapes readable at the native size and preserve each motion
 * class. Accessible names belong to the specialty buttons, not these SVGs.
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
      <path d="M5.8 2.7v2.2M10.8 2.7v2.2" />
      <path className="si-stethoscope-tube" d="M5.8 3.8H4.6a1.5 1.5 0 0 0-1.5 1.5v3.6a5.2 5.2 0 0 0 10.4 0V5.3A1.5 1.5 0 0 0 12 3.8h-1.2" />
      <path className="si-stethoscope-tube" d="M8.3 14.2v1.2a5.5 5.5 0 0 0 11 0v-3.1" />
      <circle className="si-chest-piece si-accent si-tint" cx="19.3" cy="10" r="2.3" />
      <path className="si-ecg si-accent" strokeWidth="1.35" pathLength="1" d="M2.4 21h2.4l1-1.6 1.5 3.1 1-1.5h2" />
    </>
  );
}

function Surgeon() {
  return (
    <>
      <g className="si-scalpel">
        <path className="si-scalpel-handle si-tint" d="m8.2 12.1 2.1 1.2-4.7 7.8a1.25 1.25 0 0 1-2.1-1.3Z" />
        <path className="si-scalpel-blade si-accent si-tint" d="m8.2 12.1 5.6-9.5c.35-.5.8-.25.8.35 0 4-1.4 7.35-4.3 10.35Z" />
        <path className="si-scalpel-neck" strokeWidth="1.3" d="m8.7 11.3 2.1 1.2m-5.1 4.6.9.55m.05-2.15.9.55" />
        <path className="si-gleam si-accent" strokeWidth="1.3" pathLength="1" d="M11.4 9.8c.9-1.5 1.4-2.8 1.7-4.3" />
      </g>
      <g className="si-clamp si-accent" strokeWidth="1.3">
        <circle cx="16.8" cy="19.9" r="1.65" />
        <circle cx="21.1" cy="19.9" r="1.65" />
        <path d="m17.1 18.3 2.8-5V7.2l-.95-2.5M20.8 18.3l-2.9-5V7.2l.95-2.5" />
        <path d="M17.9 15.8h2" />
      </g>
      <path className="si-incision si-accent" strokeWidth="1.3" pathLength="1" d="M8.8 22h3.6" />
    </>
  );
}

function Neurologist() {
  return (
    <>
      <path className="si-brain-core" d="M17.6 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.6 1.5M18 5.1a4 4 0 0 1 2.5 5.8M18 18a4 4 0 0 0 2-7.5M20 17.5A4 4 0 1 1 12 18a4 4 0 1 1-8-.5M6 18a4 4 0 0 1-2-7.5M6 5.1a4 4 0 0 0-2.5 5.8" />
      <path className="si-brain-fold" strokeWidth="1.3" d="M5.5 8.2c-.9 1-.8 2.3.1 3m12.8-3c.9 1 .8 2.3-.1 3" />
      <path className="si-neural-signal si-accent" strokeWidth="1.3" pathLength="1" d="M12 6.2v4.3m-.9.6-2.2-1.7M12.9 11.1l2.2-1.7M11.3 12.7l-2 2.3m3.4-2.3 2 2.3" />
      <circle className="si-neural-node si-neural-node-core si-accent si-solid" cx="12" cy="11.6" r="1" />
      <circle className="si-neural-node si-neural-node-a si-accent si-solid" cx="8.4" cy="9" r=".75" />
      <circle className="si-neural-node si-neural-node-b si-accent si-solid" cx="15.6" cy="9" r=".75" />
      <circle className="si-neural-node si-neural-node-c si-accent si-solid" cx="8.8" cy="15.5" r=".75" />
      <circle className="si-neural-node si-neural-node-d si-accent si-solid" cx="15.2" cy="15.5" r=".75" />
    </>
  );
}

function Psychiatrist() {
  return (
    <>
      <path className="si-psy-brain si-tint" d="M10.4 5.5c0-1.8-1.7-2.8-3.2-2.3-1.2.3-2 1.4-2 2.7C3.6 6.3 2.7 7.7 2.8 9.2c.1 1 .6 1.7 1.3 2.3-1.3.8-1.9 2.4-1.4 3.9.4 1.1 1.2 1.9 2.3 2.1.2 1.7 1.4 2.8 3 2.6 1.5-.1 2.4-1.4 2.4-3Z" />
      <path className="si-psy-center" strokeWidth="1.3" d="M5.3 7.5c1.6-.3 2.8.5 3 1.9m-1 1.9c-.7.8-.6 1.6.1 2.3m-2.1 1.5c1.4-.5 2.5.1 3 1.2" />
      <path className="si-dialog-bubble si-accent si-tint" d="M15.2 4.8h4.6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.5l-3.1 2.7v-2.7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
      <path className="si-dialog-one si-accent" pathLength="1" strokeWidth="1.35" d="M15.6 8.2h3.8" />
      <path className="si-dialog-two si-accent" pathLength="1" strokeWidth="1.35" d="M15.6 11.4h3.8" />
    </>
  );
}

function Ophthalmologist() {
  return (
    <>
      <path className="si-eyelid" d="M2.2 12s3.5-6.1 9.8-6.1 9.8 6.1 9.8 6.1-3.5 6.1-9.8 6.1S2.2 12 2.2 12Z" />
      <g className="si-pupil si-accent">
        <circle className="si-tint" cx="12" cy="12" r="3.3" strokeWidth="1.5" />
        <circle className="si-solid" cx="12" cy="12" r="1.05" />
      </g>
      <path className="si-eye-glint si-accent" strokeWidth="1.3" pathLength="1" d="M13.1 10.3 14.1 9.3" />
    </>
  );
}

function Ent() {
  return (
    <>
      <path d="M5.2 8.4a6.1 6.1 0 1 1 12.2 0c0 5.2-5.4 5.4-5.4 9.4a3.35 3.35 0 1 1-6.7 0" />
      <path className="si-ear-inner si-accent" d="M14 8.3a2.4 2.4 0 0 0-4.8 0v1.2a1.9 1.9 0 1 1 0 3.8" />
      <path className="si-sound-wave-one si-accent" strokeWidth="1.3" d="M19.5 7a5 5 0 0 1 0 3.8" />
      <path className="si-sound-wave-two si-accent" strokeWidth="1.3" d="M22 5.4a7.6 7.6 0 0 1 0 7" />
    </>
  );
}

function Dentist() {
  return (
    <>
      <g className="si-tooth">
        <path className="si-tint" d="M12 4.7c-2.4 0-3.7-2-6.1-.7-2.5 1.4-2.1 4.5-1.1 7.3.8 2.3.7 7.6 2.9 9.1.8.5 1.2-.5 1.4-1.6l.9-3.8c.7-2.4 3.3-2.4 4 0l.9 3.8c.2 1.1.6 2.1 1.4 1.6 2.2-1.5 2.1-6.8 2.9-9.1 1-2.8 1.4-5.9-1.1-7.3-2.4-1.3-3.7.7-6.1.7Z" />
        <path className="si-enamel-glint si-accent" pathLength="1" strokeWidth="1.35" d="M6.5 6.9c-.5.9-.4 2.1 0 3" />
        <path className="si-pulp si-accent" strokeWidth="1.3" d="M12 7.5v4.2m0-2.2-1.8-1.4M12 9.5l1.8-1.4" />
      </g>
    </>
  );
}

function Dermatologist() {
  return (
    <>
      <g className="si-magnifier">
        <circle className="si-tint" cx="10" cy="10" r="6.5" />
        <path strokeWidth="2.3" d="m15 15 5.7 5.7" />
        <g className="si-skin-sample">
          <path className="si-skin-surface" strokeWidth="1.3" d="M6.2 6.9c2.5-.6 5.1-.6 7.6 0" />
          <path className="si-skin-layer-one si-accent" strokeWidth="1.3" d="M6.1 10.5c1.4-.7 2.5.7 3.9 0s2.5.7 3.9 0" />
          <path className="si-skin-layer-two si-accent" strokeWidth="1.3" d="M6.7 13.4c1.1-.5 2 .5 3.1 0s2 .5 3.1 0" />
          <circle className="si-skin-detail si-accent si-solid" cx="8.2" cy="8.4" r=".45" />
          <circle className="si-solid" cx="11.9" cy="8.4" r=".45" />
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
