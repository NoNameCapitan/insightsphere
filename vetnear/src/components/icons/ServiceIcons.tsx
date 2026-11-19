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
 * Category icons — one matte material, one warm light source (v1.39).
 *
 * Every icon is a soft ivory-sage volume lit from the upper left, with a clear
 * outline for legibility at 24 px, a single characteristic accent, a thin rim
 * light on the top edge and a soft contact shadow underneath. Colours come
 * from CSS tokens (`--svc-*` in theme.css), so the same icon sits correctly on
 * ivory tiles, on the dark evening theme and on emergency surfaces. Gradients
 * are defined once per page by <IconMaterialDefs /> in the root layout; a flat
 * fallback colour applies wherever those definitions are absent (e.g. tests).
 */
type Shape = { body: ReactNode; accent: ReactNode; rim?: string; line?: ReactNode };

const SHAPES: Partial<Record<PlaceCategory, Shape>> = {
  // A medical case: the most recognisable "vet" silhouette at small sizes.
  veterinary_clinic: {
    line: <path d="M12.5 9.5V8.2A2.2 2.2 0 0 1 14.7 6h2.6a2.2 2.2 0 0 1 2.2 2.2v1.3" />,
    body: <rect x="5.5" y="9.5" width="21" height="16.5" rx="4.6" />,
    accent: <><rect x="14.6" y="13.2" width="2.8" height="9.4" rx="1.2" /><rect x="11.3" y="16.5" width="9.4" height="2.8" rx="1.2" /></>,
    rim: "M8.6 11.6h14.8",
  },
  // Emergency: a round body and a bold cross — the only coral icon.
  emergency_vet: {
    body: <circle cx="16" cy="15.6" r="10.4" />,
    accent: <><rect x="14.5" y="9.9" width="3" height="11.4" rx="1.3" /><rect x="10.3" y="14.1" width="11.4" height="3" rx="1.3" /></>,
    rim: "M9.6 11.2a8.6 8.6 0 0 1 4.6-3.6",
  },
  // A medicine bottle with its cap.
  vet_pharmacy: {
    body: <path d="M9 13a3.6 3.6 0 0 1 3.6-3.6h6.8A3.6 3.6 0 0 1 23 13v9.8a3.6 3.6 0 0 1-3.6 3.6h-6.8A3.6 3.6 0 0 1 9 22.8V13Z" />,
    accent: <><rect x="11" y="4.6" width="10" height="4.8" rx="1.6" /><rect x="15" y="14.4" width="2" height="7.2" rx=".9" /><rect x="12.4" y="17" width="7.2" height="2" rx=".9" /></>,
    rim: "M11.6 12.4h8.8",
  },
  // A shopping bag with a bone: shop, specifically for pets.
  pet_store: {
    line: <path d="M12 11.6V10a4 4 0 0 1 8 0v1.6" />,
    body: <path d="M7 11.6h18l-1.3 12.3a2.9 2.9 0 0 1-2.9 2.6H11.2a2.9 2.9 0 0 1-2.9-2.6L7 11.6Z" />,
    accent: <g transform="rotate(-22 16 18.6)"><rect x="12.3" y="17.75" width="7.4" height="1.7" rx=".85" /><circle cx="12.1" cy="17.45" r="1.45" /><circle cx="12.1" cy="19.75" r="1.45" /><circle cx="19.9" cy="17.45" r="1.45" /><circle cx="19.9" cy="19.75" r="1.45" /></g>,
    rim: "M9.4 13.6h13.2",
  },
  // Scissors: two soft rings, clean blades, a single accent pivot.
  grooming: {
    line: <path d="M12.9 19.8 23.8 6.4M19.1 19.8 8.2 6.4" strokeWidth="1.9" />,
    body: <><circle cx="10.4" cy="22.4" r="3.7" /><circle cx="21.6" cy="22.4" r="3.7" /></>,
    accent: <circle cx="16" cy="15.4" r="1.6" />,
  },
  // Boarding: home with a crescent — a place to stay the night.
  pet_boarding: {
    body: <path d="M5.8 14.6 16 6.4l10.2 8.2v9.3a2.6 2.6 0 0 1-2.6 2.6H8.4a2.6 2.6 0 0 1-2.6-2.6v-9.3Z" />,
    accent: <path d="M17.6 15.2a4.2 4.2 0 1 0 3.2 6.6 3.4 3.4 0 0 1-3.2-6.6Z" />,
    rim: "M9.2 14.4 16 9",
  },
  // Shelter: home with a heart.
  shelter: {
    body: <path d="M5.8 14.6 16 6.4l10.2 8.2v9.3a2.6 2.6 0 0 1-2.6 2.6H8.4a2.6 2.6 0 0 1-2.6-2.6v-9.3Z" />,
    accent: <path d="M16 23.4c-3-2-4.5-3.5-4.5-5.3a2.35 2.35 0 0 1 4.5-1 2.35 2.35 0 0 1 4.5 1c0 1.8-1.5 3.3-4.5 5.3Z" />,
    rim: "M9.2 14.4 16 9",
  },
};

// Any other category: a single soft paw.
const PAW: Shape = {
  body: <path d="M16 15.6c3.6 0 6.6 3.4 6.6 6.4 0 2.3-1.7 3.7-3.6 3.7-1.2 0-2-.6-3-.6s-1.8.6-3 .6c-1.9 0-3.6-1.4-3.6-3.7 0-3 3-6.4 6.6-6.4Z" />,
  accent: <><ellipse cx="9.4" cy="13.6" rx="2" ry="2.5" /><ellipse cx="13.6" cy="9.8" rx="2" ry="2.6" /><ellipse cx="18.4" cy="9.8" rx="2" ry="2.6" /><ellipse cx="22.6" cy="13.6" rx="2" ry="2.5" /></>,
};

export function ServiceIcon({ category, className }: IconProps & { category: PlaceCategory }) {
  const shape = SHAPES[category] ?? PAW;
  const urgent = category === "emergency_vet";
  return (
    <svg viewBox="0 0 32 32" fill="none" className={`svc-icon${urgent ? " svc-icon--urgent" : ""} ${className ?? ""}`} aria-hidden="true" focusable="false">
      <ellipse className="svc-icon__contact" cx="16" cy="28.4" rx="9" ry="1.7" />
      <g className="svc-icon__body">{shape.body}</g>
      {shape.line && <g className="svc-icon__line">{shape.line}</g>}
      <g className="svc-icon__accent">{shape.accent}</g>
      {shape.rim && <path className="svc-icon__rim" d={shape.rim} />}
    </svg>
  );
}

/**
 * Shared gradients for the icon material. Rendered once in the root layout;
 * the stops read CSS tokens, so the material follows the theme.
 */
export function IconMaterialDefs() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <linearGradient id="vn-svc-body" x1="0" y1="0" x2=".55" y2="1">
          <stop offset="0" style={{ stopColor: "var(--svc-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--svc-lo)" }} />
        </linearGradient>
        <linearGradient id="vn-svc-accent" x1="0" y1="0" x2=".4" y2="1">
          <stop offset="0" style={{ stopColor: "var(--svc-accent-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--svc-accent)" }} />
        </linearGradient>
        <linearGradient id="vn-svc-urgent" x1="0" y1="0" x2=".4" y2="1">
          <stop offset="0" style={{ stopColor: "var(--svc-urgent-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--svc-urgent)" }} />
        </linearGradient>
        <radialGradient id="vn-svc-contact">
          <stop offset="0" style={{ stopColor: "var(--svc-shadow)" }} />
          <stop offset="1" style={{ stopColor: "var(--svc-shadow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Air-raid shelter (safety layer) — not the animal-shelter category. */
export function BombShelterIcon({ className }: IconProps) {
  return <TileIcon name="bomb-shelter" className={className} />;
}
