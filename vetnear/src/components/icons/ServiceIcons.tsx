import Image from "next/image";
import { useId, type ReactNode } from "react";
import type { PlaceCategory } from "@/lib/types";

/** VetNear soft-3D action icons (phone, route, location…): the same matte material and warm light as the category icons below. */
type IconProps = { className?: string };

function SoftIcon({ className, children, coral = false }: IconProps & {
  children: (id: string) => ReactNode;
  coral?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`premium-icon ${className ?? ""}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-teal`} x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor={coral ? "#E27A6C" : "#4D8D6F"} /><stop offset="1" stopColor={coral ? "#B4463A" : "#2A6650"} />
        </linearGradient>
        <linearGradient id={`${id}-mint`} x1="11" y1="9" x2="35" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFDF6" /><stop offset=".56" stopColor="#EEF1E4" /><stop offset="1" stopColor="#D2DCC4" />
        </linearGradient>
        <linearGradient id={`${id}-sand`} x1="12" y1="8" x2="37" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF6E8" /><stop offset="1" stopColor="#E8CDA9" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-45%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="3.2" stdDeviation="2.8" floodColor="#4A3016" floodOpacity=".2" />
        </filter>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>
      <ellipse cx="24" cy="41" rx="12.5" ry="2.8" fill={coral ? "#B4463A" : "#4A3016"} opacity=".14" filter={`url(#${id}-glow)`} />
      <g className="premium-icon__object" filter={`url(#${id}-shadow)`}>{children(id)}</g>
    </svg>
  );
}

export function ClinicIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M10.5 20.5 24 10l13.5 10.5v15.2a3.8 3.8 0 0 1-3.8 3.8H14.3a3.8 3.8 0 0 1-3.8-3.8V20.5Z" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M20.2 39.3v-8.1a3.8 3.8 0 0 1 7.6 0v8.1" fill="#fff" stroke="#2A6650" strokeWidth="1.7" />
    <rect x="18" y="15" width="12" height="12" rx="4" fill={`url(#${id}-teal)`} />
    <path d="M24 18.2v5.6M21.2 21h5.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M13.2 21.1 24 12.7l10.8 8.4" stroke="#fff" strokeOpacity=".54" strokeWidth="1.4" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function PharmacyIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <rect x="10.5" y="13" width="21" height="27" rx="6" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.7" />
    <rect x="14" y="8.5" width="14" height="6.5" rx="2.5" fill={`url(#${id}-teal)`} />
    <path d="M21 21v10M16 26h10" stroke="#2A6650" strokeWidth="2.8" strokeLinecap="round" />
    <g transform="rotate(-34 35 31)"><rect x="31.5" y="23" width="7" height="16" rx="3.5" fill="#fff" stroke="#2A6650" strokeWidth="1.6" /><path d="M31.5 31h7v4.4a3.5 3.5 0 0 1-7 0V31Z" fill={`url(#${id}-sand)`} /></g>
  </>}</SoftIcon>;
}

export function HotelIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M8.5 22.5 24 9.5l15.5 13v14a3.5 3.5 0 0 1-3.5 3.5H12a3.5 3.5 0 0 1-3.5-3.5v-14Z" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14.5 20.6 24 12.7l9.5 7.9" stroke="#fff" strokeOpacity=".62" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17 39v-9a7 7 0 0 1 14 0v9" fill={`url(#${id}-teal)`} />
    <ellipse cx="24" cy="32.5" rx="3" ry="2.5" fill="#fff" /><circle cx="20.2" cy="29.2" r="1.35" fill="#fff" /><circle cx="24" cy="27.8" r="1.35" fill="#fff" /><circle cx="27.8" cy="29.2" r="1.35" fill="#fff" />
  </>}</SoftIcon>;
}

export function GroomingIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <circle cx="14.5" cy="34" r="5.3" fill={`url(#${id}-sand)`} stroke="#805C3F" strokeWidth="1.5" /><circle cx="33.5" cy="34" r="5.3" fill={`url(#${id}-sand)`} stroke="#805C3F" strokeWidth="1.5" />
    <path d="M18.7 30.7 33.7 10.5M29.3 30.7 14.3 10.5" stroke="#2A6650" strokeWidth="3.3" strokeLinecap="round" /><circle cx="24" cy="24.5" r="3.2" fill={`url(#${id}-teal)`} stroke="#fff" strokeWidth="1" />
    <path d="m35 11 1.1 2.4 2.4 1.1-2.4 1.1L35 18l-1.1-2.4-2.4-1.1 2.4-1.1L35 11Z" fill="#E8C58E" />
  </>}</SoftIcon>;
}

export function StoreIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M11 18h26l-2 21H13L11 18Z" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.7" strokeLinejoin="round" /><path d="M17 18v-3a7 7 0 0 1 14 0v3" stroke="#2A6650" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="24" cy="31" rx="3.5" ry="3" fill={`url(#${id}-teal)`} /><circle cx="19.6" cy="27.3" r="1.6" fill="#4D8D6F" /><circle cx="24" cy="25.8" r="1.6" fill="#4D8D6F" /><circle cx="28.4" cy="27.3" r="1.6" fill="#4D8D6F" /><path d="M13 20h22" stroke="#fff" strokeOpacity=".72" strokeWidth="1.4" />
  </>}</SoftIcon>;
}

export function EmergencyIcon(props: IconProps) {
  return <SoftIcon {...props} coral>{(id) => <>
    <circle cx="24" cy="24" r="16" fill={`url(#${id}-mint)`} stroke="#B4463A" strokeWidth="1.8" /><circle cx="24" cy="24" r="12" fill={`url(#${id}-teal)`} /><path d="M24 17.5v13M17.5 24h13" stroke="#fff" strokeWidth="3.8" strokeLinecap="round" /><path d="M17 14.5a13.5 13.5 0 0 1 7-2" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function ShelterIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M24 7.5 40 20.2v15.3a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V20.2L24 7.5Z" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.7" strokeLinejoin="round" /><path d="M13.2 20.8 24 12.2l10.8 8.6" stroke="#fff" strokeOpacity=".65" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M24 34.7c-4.3-3.1-6.6-5.2-6.6-8a3.6 3.6 0 0 1 6.6-2.2 3.6 3.6 0 0 1 6.6 2.2c0 2.8-2.3 4.9-6.6 8Z" fill={`url(#${id}-teal)`} />
  </>}</SoftIcon>;
}

export function LocationIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M24 6.5c-8 0-14 5.8-14 13.5 0 10.4 14 21.5 14 21.5S38 30.4 38 20C38 12.3 32 6.5 24 6.5Z" fill={`url(#${id}-teal)`} stroke="#2A6650" strokeWidth="1.5" /><circle cx="24" cy="20" r="6" fill={`url(#${id}-mint)`} /><circle cx="22" cy="17.8" r="1.2" fill="#2A6650" /><circle cx="26" cy="17.8" r="1.2" fill="#2A6650" /><path d="M20.8 21.5c1.9 2 4.5 2 6.4 0" stroke="#2A6650" strokeWidth="1.5" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function PhoneIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <path d="M14 8.8c1.7-1 5.3 4.8 5.4 6.6.1 1.2-2.6 2.7-2.9 3.8 1.7 4.2 5.9 8.5 10.2 10.2 1.1-.3 2.6-3 3.8-2.9 1.8.1 7.6 3.7 6.6 5.4-1.7 2.9-4 6.8-8.3 5.4C20 34.5 10.4 25 7.6 16.2 6.2 11.9 11.1 10.5 14 8.8Z" fill={`url(#${id}-teal)`} stroke="#2A6650" strokeWidth="1.4" />}</SoftIcon>;
}

export function RouteIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <><path d="m8 24 31-15-12.3 31-4.2-12.5L8 24Z" fill={`url(#${id}-teal)`} stroke="#2A6650" strokeWidth="1.6" strokeLinejoin="round" /><path d="m22.5 27.5 16.5-18" stroke="#fff" strokeOpacity=".72" strokeWidth="1.7" strokeLinecap="round" /></>}</SoftIcon>;
}

export function VerifiedIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <><path d="m24 6 5 3.2 6-.1 1.7 5.8 4.2 4.3-2.1 5.6.1 6-5.8 1.7-4.3 4.2-5.6-2.1-6 .1-1.7-5.8-4.2-4.3 2.1-5.6-.1-6 5.8-1.7L19.2 8 24 6Z" fill={`url(#${id}-teal)`} stroke="#2A6650" strokeWidth="1.4" strokeLinejoin="round" /><path d="m16.8 23.7 4.6 4.5 9.8-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}</SoftIcon>;
}

export function FilterIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>{[14, 24, 34].map((y, index) => <g key={y}><rect x="8" y={y - 2} width="32" height="4" rx="2" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.2" /><circle cx={[18, 31, 22][index]} cy={y} r="5" fill={`url(#${id}-teal)`} stroke="#fff" strokeWidth="1.5" /></g>)}</>}</SoftIcon>;
}

export function PetProfileIcon({ className }: IconProps) {
  return <TileIcon name="pet" className={className} />;
}

export function TrainingIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <><path d="m24 9 16 7-16 7-16-7 16-7Z" fill={`url(#${id}-teal)`} stroke="#2A6650" strokeWidth="1.5" strokeLinejoin="round" /><path d="M15.5 20.5v8c0 5 17 5 17 0v-8" fill={`url(#${id}-mint)`} stroke="#2A6650" strokeWidth="1.5" /><path d="M40 16v11" stroke="#2A6650" strokeWidth="1.7" strokeLinecap="round" /><circle cx="40" cy="30" r="2.2" fill={`url(#${id}-sand)`} /></>}</SoftIcon>;
}

export const FriendlyIcon = LocationIcon;
export const PawIcon = PetProfileIcon;

export function EmergencyCtaIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".12" /><path d="M12 7.8v8.4M7.8 12h8.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
}

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
  const shape = SHAPES[category] ?? PAW;
  const urgent = category === "emergency_vet";
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
