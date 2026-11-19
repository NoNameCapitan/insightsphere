import Image from "next/image";
import type { ReactNode } from "react";
import type { PlaceCategory } from "@/lib/types";

type IconProps = { className?: string };

/**
 * Action glyphs (call, route, filter, location, verified). These are controls,
 * not objects: quiet single-weight marks in the surrounding text colour, so the
 * warm-room objects below stay the only "things" on a surface.
 */
function Glyph({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return <Glyph {...props}><path d="M6.6 3.8c1-.5 3.2 2.6 3.3 3.6 0 .7-1.5 1.5-1.6 2.1 1 2.5 3.5 5 6 6 .6-.1 1.4-1.6 2.1-1.6 1 .1 4.1 2.3 3.6 3.3-.9 1.7-2.3 3.9-4.8 3.1C9.9 18.6 5.4 14.1 3.7 8.8c-.8-2.5 1.4-3.9 2.9-5Z" /></Glyph>;
}

export function RouteIcon(props: IconProps) {
  return <Glyph {...props}><path d="m4 11.6 16-7.1-7.1 16-2.1-6.8L4 11.6Z" /></Glyph>;
}

export function LocationIcon(props: IconProps) {
  return <Glyph {...props}><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></Glyph>;
}

export function VerifiedIcon(props: IconProps) {
  return <Glyph {...props}><path d="M12 3.2 18.6 6v5.3c0 4.1-2.8 7.7-6.6 9-3.8-1.3-6.6-4.9-6.6-9V6L12 3.2Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></Glyph>;
}

export function FilterIcon(props: IconProps) {
  return <Glyph {...props}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></Glyph>;
}

export function PetProfileIcon({ className }: IconProps) {
  return <TileIcon name="pet" className={className} />;
}

export const PawIcon = PetProfileIcon;

/**
 * Clay icon tiles (public/visuals/icons): the object sits on its own ivory
 * surface with a natural shadow. Inside an `.icon3d` holder the tile fills
 * the holder; elsewhere it takes the size from `className`.
 */
export type TileIconName =
  | "clinic" | "pharmacy" | "store" | "grooming" | "boarding" | "shelter" | "emergency"
  | "bomb-shelter" | "alert" | "location" | "phone" | "route" | "shield" | "verified"
  | "vaccine" | "treatment" | "visit" | "weight" | "document" | "reminder" | "microchip" | "pet";

export function TileIcon({ name, className }: IconProps & { name: TileIconName }) {
  return (
    <Image
      src={`/visuals/icons/${name}.webp`}
      alt=""
      aria-hidden
      width={144}
      height={144}
      sizes="80px"
      className={`icon-raster ${className ?? ""}`}
    />
  );
}

/**
 * Category icons — small objects from the same warm room (v1.40).
 *
 * Not UI symbols: each icon is a solid matte object — sage ceramic, cream and
 * brass details — lit by the same warm lamp as the hero (from the upper left),
 * resting on a soft warm contact shadow. No outlines; the silhouette alone
 * carries recognition, which also reads better at 24 px. Emergency is the one
 * terracotta object. Colours come from CSS tokens (`--obj-*` in theme.css), so
 * the objects sit in lamplight in both themes. Gradients are defined once per
 * page by <IconMaterialDefs /> in the root layout; flat fallbacks apply
 * wherever those definitions are absent (e.g. tests).
 */
type Shape = { body: ReactNode; detail?: ReactNode; line?: ReactNode; metal?: boolean; rim?: string };

const HOUSE = "M5.4 15.2 16 6.2l10.6 9v9.4a2.4 2.4 0 0 1-2.4 2.4H7.8a2.4 2.4 0 0 1-2.4-2.4v-9.4Z";

const SHAPES: Partial<Record<PlaceCategory, Shape>> = {
  // A first-aid case: sage ceramic body, a cream cross, a dark leather handle.
  veterinary_clinic: {
    line: <path d="M12.6 10V8.4a2.1 2.1 0 0 1 2.1-2.1h2.6a2.1 2.1 0 0 1 2.1 2.1V10" />,
    body: <rect x="4.8" y="9.6" width="22.4" height="17" rx="5" />,
    detail: <path d="M14.5 13.3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v3h3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-3v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-3h-3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h3v-3Z" />,
    rim: "M8.4 11.4h15.2",
  },
  // Emergency: the only terracotta object — a round clay token with a cream cross.
  emergency_vet: {
    body: <circle cx="16" cy="15.8" r="11" />,
    detail: <path d="M14.4 10.4a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v3.8h3.8a1 1 0 0 1 1 1v1.2a1 1 0 0 1-1 1h-3.8v3.8a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-1v-3.8h-3.8a1 1 0 0 1-1-1v-1.2a1 1 0 0 1 1-1h3.8v-3.8Z" />,
    rim: "M9.2 11.2a9.2 9.2 0 0 1 5-4",
  },
  // A ceramic medicine jar with a brass lid and a cream label.
  vet_pharmacy: {
    body: <path d="M8.6 13.6a4 4 0 0 1 4-4h6.8a4 4 0 0 1 4 4v9.4a4 4 0 0 1-4 4h-6.8a4 4 0 0 1-4-4v-9.4Z" />,
    // The cross is cut out of the label, so the ceramic shows through.
    detail: <><rect x="10.6" y="4.4" width="10.8" height="5.2" rx="1.8" /><path fillRule="evenodd" d="M13 15h6a1.6 1.6 0 0 1 1.6 1.6v4a1.6 1.6 0 0 1-1.6 1.6h-6a1.6 1.6 0 0 1-1.6-1.6v-4A1.6 1.6 0 0 1 13 15Zm2.25 1.1v1.75H13.5v1.5h1.75v1.75h1.5v-1.75h1.75v-1.5h-1.75V16.1h-1.5Z" /></>,
    rim: "M11.4 11.6h9.2",
  },
  // A paper bag (sage) with a cream bone.
  pet_store: {
    line: <path d="M12.2 12V10a3.8 3.8 0 0 1 7.6 0v2" />,
    body: <path d="M6.6 12h18.8l-1.4 12.4a2.9 2.9 0 0 1-2.9 2.6H10.9a2.9 2.9 0 0 1-2.9-2.6L6.6 12Z" />,
    detail: <g transform="rotate(-22 16 19)"><rect x="12.2" y="18.1" width="7.6" height="1.8" rx=".9" /><circle cx="12" cy="17.8" r="1.55" /><circle cx="12" cy="20.2" r="1.55" /><circle cx="20" cy="17.8" r="1.55" /><circle cx="20" cy="20.2" r="1.55" /></g>,
    rim: "M8.8 13.8h14.4",
  },
  // Grooming scissors: brass blades, sage handles.
  grooming: {
    line: <path d="M13 19.6 23.6 6.2M19 19.6 8.4 6.2" />,
    metal: true,
    body: <path fillRule="evenodd" d="M10.2 18.2a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8Zm0 2.6a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM21.8 18.2a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8Zm0 2.6a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />,
    detail: <circle cx="16" cy="15.3" r="1.5" />,
  },
  // Boarding: a small house with a warm lit window — somewhere to spend the night.
  pet_boarding: {
    body: <path d={HOUSE} />,
    detail: <path d="M17.6 15.4a4.3 4.3 0 1 0 3.4 6.8 3.5 3.5 0 0 1-3.4-6.8Z" />,
    rim: "M8.6 15 16 8.8",
  },
  // Shelter: the same house, a cream heart inside.
  shelter: {
    body: <path d={HOUSE} />,
    detail: <path d="M16 23.8c-3.1-2.1-4.7-3.6-4.7-5.5a2.45 2.45 0 0 1 4.7-1 2.45 2.45 0 0 1 4.7 1c0 1.9-1.6 3.4-4.7 5.5Z" />,
    rim: "M8.6 15 16 8.8",
  },
};

// Any other category: a soft paw, the same sage ceramic.
const PAW: Shape = {
  body: <><path d="M16 15.4c3.7 0 6.8 3.5 6.8 6.6 0 2.4-1.8 3.8-3.7 3.8-1.2 0-2.1-.6-3.1-.6s-1.9.6-3.1.6c-1.9 0-3.7-1.4-3.7-3.8 0-3.1 3.1-6.6 6.8-6.6Z" /><ellipse cx="9.2" cy="13.4" rx="2.1" ry="2.6" /><ellipse cx="13.5" cy="9.5" rx="2.1" ry="2.7" /><ellipse cx="18.5" cy="9.5" rx="2.1" ry="2.7" /><ellipse cx="22.8" cy="13.4" rx="2.1" ry="2.6" /></>,
};

export function ServiceIcon({ category, className }: IconProps & { category: PlaceCategory }) {
  return <RoomObjectSvg shape={SHAPES[category] ?? PAW} urgent={category === "emergency_vet"} className={className} />;
}

/**
 * The same objects for scenarios and personal records, so the whole product
 * speaks one object language (home "readiness" rail, owner block…).
 */
export type RoomObjectName = "urgent" | "lantern" | "tag" | "shield" | "record" | "calendar";

const OBJECTS: Record<RoomObjectName, Shape> = {
  // Animal suddenly unwell: the same terracotta token as the emergency category.
  urgent: SHAPES.emergency_vet as Shape,
  // Air-raid alert: a storm lantern — the light you carry to a shelter.
  lantern: {
    line: <path d="M12.2 8.2a3.8 3.8 0 0 1 7.6 0" />,
    body: <path d="M10.4 11.4h11.2a1.6 1.6 0 0 1 1.6 1.6v10a3.4 3.4 0 0 1-3.4 3.4h-7.6a3.4 3.4 0 0 1-3.4-3.4v-10a1.6 1.6 0 0 1 1.6-1.6Z" />,
    detail: <><rect x="11" y="8.2" width="10" height="3.2" rx="1.3" /><path d="M16 14.6c1.8 2 2.8 3.6 2.8 5.1a2.8 2.8 0 0 1-5.6 0c0-1.5 1-3.1 2.8-5.1Z" /></>,
    rim: "M11.2 14.2v8",
  },
  // Found an animal: a collar tag with a cream heart.
  tag: {
    line: <><circle cx="16" cy="5.8" r="1.9" /><path d="M16 7.7v1.9" /></>,
    body: <circle cx="16" cy="18.4" r="8.8" />,
    detail: <path d="M16 22.4c-2.6-1.8-3.9-3-3.9-4.6a2.05 2.05 0 0 1 3.9-.9 2.05 2.05 0 0 1 3.9.9c0 1.6-1.3 2.8-3.9 4.6Z" />,
    rim: "M9.9 14.4a7.4 7.4 0 0 1 4-3.6",
  },
  // Bite or rabies risk: a ceramic shield with a cream check.
  shield: {
    body: <path d="M16 4.8 25.4 8.4v7.4c0 5.4-3.9 9.9-9.4 11.6-5.5-1.7-9.4-6.2-9.4-11.6V8.4L16 4.8Z" />,
    detail: <path d="m11.4 16.1 1.9-1.9 2.3 2.3 4.9-4.9 1.9 1.9-6.8 6.8-4.2-4.2Z" />,
    rim: "M9.4 10.2 16 7.6",
  },
  // A pet's own record card.
  record: {
    body: <rect x="6" y="6.4" width="20" height="20.6" rx="3.6" />,
    detail: <><rect x="11.1" y="8.9" width="1.8" height="5.6" rx=".8" /><rect x="9.2" y="10.8" width="5.6" height="1.8" rx=".8" /><rect x="17" y="10.8" width="6" height="1.8" rx=".9" /><rect x="9.2" y="17.2" width="13.8" height="1.8" rx=".9" /><rect x="9.2" y="21.2" width="9.6" height="1.8" rx=".9" /></>,
    rim: "M9 8.6h14",
  },
  // The next date to remember.
  calendar: {
    line: <path d="M11 5.2v4.2M21 5.2v4.2" />,
    body: <rect x="5.6" y="7.4" width="20.8" height="19.4" rx="4" />,
    detail: <><rect x="9.4" y="13" width="13.2" height="1.7" rx=".85" /><rect x="17" y="17.4" width="5.6" height="5.6" rx="1.5" /></>,
    rim: "M8.6 9.6h14.8",
  },
};

export function RoomObject({ name, className }: IconProps & { name: RoomObjectName }) {
  return <RoomObjectSvg shape={OBJECTS[name]} urgent={name === "urgent"} className={className} />;
}

function RoomObjectSvg({ shape, urgent, className }: IconProps & { shape: Shape; urgent: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={`svc-icon${urgent ? " svc-icon--urgent" : ""} ${className ?? ""}`} aria-hidden="true" focusable="false">
      <ellipse className="svc-icon__contact" cx="16" cy="28.6" rx="9.6" ry="1.8" />
      {shape.line && <g className={`svc-icon__line${shape.metal ? " svc-icon__line--metal" : ""}`}>{shape.line}</g>}
      <g className="svc-icon__body">{shape.body}</g>
      {shape.detail && <g className="svc-icon__detail">{shape.detail}</g>}
      {shape.rim && <path className="svc-icon__rim" d={shape.rim} />}
    </svg>
  );
}

/**
 * Shared gradients for the object material. Rendered once in the root layout;
 * the stops read CSS tokens, so the lamplight follows the theme.
 */
export function IconMaterialDefs() {
  const stop = (offset: string, color: string, opacity?: number) => (
    <stop offset={offset} style={{ stopColor: `var(${color})`, ...(opacity === undefined ? {} : { stopOpacity: opacity }) }} />
  );
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {/* Lamp from the upper left: a soft light spot, then the object's shaded side. */}
        <radialGradient id="vn-obj-body" cx=".3" cy=".22" r=".95">
          {stop("0", "--obj-hi")}{stop(".52", "--obj-mid")}{stop("1", "--obj-lo")}
        </radialGradient>
        <radialGradient id="vn-obj-urgent" cx=".3" cy=".22" r=".95">
          {stop("0", "--obj-urgent-hi")}{stop(".52", "--obj-urgent-mid")}{stop("1", "--obj-urgent-lo")}
        </radialGradient>
        <linearGradient id="vn-obj-detail" x1="0" y1="0" x2=".5" y2="1">
          {stop("0", "--obj-detail-hi")}{stop("1", "--obj-detail-lo")}
        </linearGradient>
        <radialGradient id="vn-obj-contact">
          {stop("0", "--obj-shadow")}{stop("1", "--obj-shadow", 0)}
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Air-raid shelter (safety layer) — not the animal-shelter category. */
export function BombShelterIcon({ className }: IconProps) {
  return <TileIcon name="bomb-shelter" className={className} />;
}
