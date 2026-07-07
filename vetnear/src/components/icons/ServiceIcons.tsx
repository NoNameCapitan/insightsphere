import type { PlaceCategory } from "@/lib/types";

/**
 * Hand-drawn inline SVG icons for the public service-category cards — one
 * consistent family: 48×48 grid, 2.4 stroke, rounded joins, white/teal fills
 * with a single soft-gold accent. Sub-elements carry `service-icon__*` classes
 * that globals.css animates on hover/focus/tap; every icon is fully legible
 * with animations disabled. All icons are decorative (cards carry the text),
 * so consumers render them inside an aria-hidden container.
 */

const INK = "#0B6353"; // brand-600 outline
const TINT = "#CDEBE2"; // brand-100 soft fill
const ACCENT = "#2EA487"; // brand-400 accent
const GOLD = "#E9B949"; // sparkle / moon
const CREAM = "#EBD9B4"; // treat / bone

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Clinic building with a heartbeat cross badge. */
export function ClinicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="15" width="30" height="25" rx="5" fill="#fff" stroke={INK} strokeWidth="2.4" />
      <rect x="13.8" y="22" width="5" height="5" rx="1.6" fill={TINT} />
      <rect x="29.2" y="22" width="5" height="5" rx="1.6" fill={TINT} />
      <path
        d="M20.8 38.8v-6a3.2 3.2 0 0 1 6.4 0v6"
        fill={TINT}
        stroke={INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <g className="service-icon__pulse">
        <circle cx="24" cy="13" r="7.2" fill={ACCENT} stroke="#fff" strokeWidth="2" />
        <path
          d="M24 9.8v6.4M20.8 13h6.4"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    </Svg>
  );
}

/** Shopping bag with a paw print; a treat bone pops out on hover. */
export function StoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g className="service-icon__bone">
        <g transform="rotate(-18 36.5 10.5)">
          <rect x="32.5" y="9" width="8" height="3" rx="1.5" fill={CREAM} />
          <circle cx="32.5" cy="9.4" r="1.9" fill={CREAM} />
          <circle cx="32.5" cy="11.6" r="1.9" fill={CREAM} />
          <circle cx="40.5" cy="9.4" r="1.9" fill={CREAM} />
          <circle cx="40.5" cy="11.6" r="1.9" fill={CREAM} />
        </g>
      </g>
      <g className="service-icon__bag">
        <path
          d="M17.5 16.5v-2.2a6.5 6.5 0 0 1 13 0v2.2"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <rect x="11.5" y="16.5" width="25" height="23" rx="5.5" fill="#fff" stroke={INK} strokeWidth="2.4" />
        <ellipse cx="24" cy="30.6" rx="3.6" ry="3" fill={ACCENT} />
        <circle cx="19.4" cy="27" r="1.7" fill={ACCENT} />
        <circle cx="24" cy="25.4" r="1.7" fill={ACCENT} />
        <circle cx="28.6" cy="27" r="1.7" fill={ACCENT} />
      </g>
    </Svg>
  );
}

/** Pill bottle with a glowing plus and a capsule that tilts; shine sweeps by. */
export function PharmacyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="12.5" y="16" width="16" height="24" rx="4.5" fill="#fff" stroke={INK} strokeWidth="2.4" />
      <rect x="15" y="10" width="11" height="6" rx="2" fill={TINT} stroke={INK} strokeWidth="2.2" />
      <clipPath id="vn-pharmacy-bottle">
        <rect x="12.5" y="16" width="16" height="24" rx="4.5" />
      </clipPath>
      <g clipPath="url(#vn-pharmacy-bottle)">
        <rect
          className="service-icon__shine"
          x="12"
          y="14"
          width="4.5"
          height="28"
          rx="2.2"
          fill="#fff"
        />
      </g>
      <path
        className="service-icon__plus"
        d="M20.5 24v7M17 27.5h7"
        stroke={ACCENT}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g className="service-icon__capsule">
        <rect x="30" y="21.5" width="7.6" height="16" rx="3.8" fill="#fff" stroke={INK} strokeWidth="2.4" />
        <path d="M31.2 25.3a2.6 2.6 0 0 1 5.2 0v3H31.2z" fill={ACCENT} />
        <path d="M30 29.5h7.6" stroke={INK} strokeWidth="2" />
      </g>
    </Svg>
  );
}

/** Scissors that snip once; two sparkles wink in. */
export function GroomingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        className="service-icon__spark service-icon__spark--1"
        d="M36 12c.4 2.6 1.9 4.1 4.5 4.5-2.6.4-4.1 1.9-4.5 4.5-.4-2.6-1.9-4.1-4.5-4.5 2.6-.4 4.1-1.9 4.5-4.5z"
        fill={GOLD}
      />
      <path
        className="service-icon__spark service-icon__spark--2"
        d="M12.5 10.5c.27 1.73 1.27 2.73 3 3-1.73.27-2.73 1.27-3 3-.27-1.73-1.27-2.73-3-3 1.73-.27 2.73-1.27 3-3z"
        fill={GOLD}
      />
      <g className="service-icon__blade service-icon__blade--a">
        <path d="M19.8 33 31 11.5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="18" cy="36" r="3.8" fill="#fff" stroke={INK} strokeWidth="2.4" />
      </g>
      <g className="service-icon__blade service-icon__blade--b">
        <path d="M28.2 33 17 11.5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="30" cy="36" r="3.8" fill="#fff" stroke={INK} strokeWidth="2.4" />
      </g>
      <circle cx="24" cy="24.5" r="2" fill={INK} />
    </Svg>
  );
}

/** Sleeping pet in a basket under a little moon; Zzz float up on hover. */
export function HotelIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M43.6 12.6a5.4 5.4 0 1 1-6.9-6.4 6.6 6.6 0 0 0 6.9 6.4z"
        fill={GOLD}
        opacity="0.9"
      />
      <path
        className="service-icon__zzz service-icon__zzz--1"
        d="M29.5 20.5h4.4l-4.4 4.6h4.4"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="service-icon__zzz service-icon__zzz--2"
        d="M36.5 14.5h3.2l-3.2 3.4h3.2"
        stroke={ACCENT}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className="service-icon__bed">
        <ellipse cx="20.5" cy="25.5" rx="7.5" ry="6" fill="#fff" stroke={INK} strokeWidth="2.4" />
        <path
          d="M15.6 21.8 14 17.9l4.1 1.5"
          fill="#fff"
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M17.8 25.4q1.7 1.7 3.4 0" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M9.5 29.5h29v3.5a5 5 0 0 1-5 5h-19a5 5 0 0 1-5-5z"
          fill={TINT}
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </g>
    </Svg>
  );
}

/** Rounded cross with a calm expanding ring — serious, not playful. */
export function EmergencyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle
        className="service-icon__ring"
        cx="24"
        cy="24"
        r="15.5"
        stroke="#E11D48"
        strokeWidth="2"
      />
      <circle cx="24" cy="24" r="13.5" fill="#FFF1F4" stroke="#E11D48" strokeWidth="2.4" />
      <path
        d="M24 17.5v13M17.5 24h13"
        stroke="#C20E38"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** House with a heart — shelters and adoption. */
export function ShelterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M24 9.5 38 20.5V36a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V20.5z"
        fill="#fff"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        className="service-icon__soft"
        d="M24 33.2c-3.4-2.6-5.6-4.6-5.6-7a3.1 3.1 0 0 1 5.6-1.9 3.1 3.1 0 0 1 5.6 1.9c0 2.4-2.2 4.4-5.6 7z"
        fill={ACCENT}
      />
    </Svg>
  );
}

/** Graduation cap — dog training. */
export function TrainingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g className="service-icon__soft">
        <path
          d="M24 12 39 18.5 24 25 9 18.5z"
          fill="#fff"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M16.5 22.5v5.8c0 3 15 3 15 0v-5.8"
          fill={TINT}
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M39 18.5v7" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="39" cy="27.5" r="1.6" fill={INK} />
      </g>
    </Svg>
  );
}

/** Location pin with a paw — pet-friendly places. */
export function FriendlyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M24 8.5c-6.4 0-11.6 5-11.6 11.3 0 8.6 11.6 19.7 11.6 19.7s11.6-11.1 11.6-19.7C35.6 13.5 30.4 8.5 24 8.5z"
        fill="#fff"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <g className="service-icon__soft">
        <ellipse cx="24" cy="22" rx="3.1" ry="2.6" fill={ACCENT} />
        <circle cx="20.2" cy="18.6" r="1.5" fill={ACCENT} />
        <circle cx="24" cy="17.2" r="1.5" fill={ACCENT} />
        <circle cx="27.8" cy="18.6" r="1.5" fill={ACCENT} />
      </g>
    </Svg>
  );
}

/** Fallback for categories without a dedicated icon yet. */
export function PawIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="24" cy="24" r="14" fill={TINT} stroke={INK} strokeWidth="2.4" />
      <g className="service-icon__soft">
        <ellipse cx="24" cy="27" rx="4" ry="3.4" fill={ACCENT} />
        <circle cx="19" cy="22.6" r="1.9" fill={ACCENT} />
        <circle cx="24" cy="20.8" r="1.9" fill={ACCENT} />
        <circle cx="29" cy="22.6" r="1.9" fill={ACCENT} />
      </g>
    </Svg>
  );
}

/**
 * Compact white variant of the emergency icon for the rose hero CTA button.
 * Carries a light-sweep bar (clipped to the dome) that globals.css runs on
 * hover — a calm ambulance-beacon feel, red/white only.
 */
export function EmergencyCtaIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle className="service-icon__ring" cx="12" cy="12" r="10.5" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="8.4" fill="rgba(255,255,255,0.14)" stroke="#fff" strokeWidth="2" />
      <clipPath id="vn-emergency-dome">
        <circle cx="12" cy="12" r="7.4" />
      </clipPath>
      <g clipPath="url(#vn-emergency-dome)">
        <rect className="emergency-cta__sweep" x="10.6" y="3" width="2.8" height="18" fill="#fff" />
      </g>
      <path d="M12 8.4v7.2M8.4 12h7.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Partial<Record<PlaceCategory, (p: IconProps) => React.JSX.Element>> = {
  veterinary_clinic: ClinicIcon,
  emergency_vet: EmergencyIcon,
  pet_store: StoreIcon,
  vet_pharmacy: PharmacyIcon,
  grooming: GroomingIcon,
  pet_boarding: HotelIcon,
  shelter: ShelterIcon,
  dog_training: TrainingIcon,
  pet_friendly_place: FriendlyIcon,
};

export function ServiceIcon({
  category,
  className,
}: IconProps & { category: PlaceCategory }) {
  const Icon = ICONS[category] ?? PawIcon;
  return <Icon className={className} />;
}
