import { useId, type ReactNode } from "react";
import type { PlaceCategory } from "@/lib/types";

/** Original VetNear soft-3D icon family: one matte material, one light source. */
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
          <stop stopColor={coral ? "#F58B83" : "#39B5A7"} /><stop offset="1" stopColor={coral ? "#C84B52" : "#0F766E"} />
        </linearGradient>
        <linearGradient id={`${id}-mint`} x1="11" y1="9" x2="35" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" /><stop offset=".56" stopColor="#E8F6F1" /><stop offset="1" stopColor="#C7E8DF" />
        </linearGradient>
        <linearGradient id={`${id}-sand`} x1="12" y1="8" x2="37" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF6E8" /><stop offset="1" stopColor="#E8CDA9" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-45%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="3.2" stdDeviation="2.8" floodColor="#123E3A" floodOpacity=".19" />
        </filter>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>
      <ellipse cx="24" cy="41" rx="12.5" ry="2.8" fill={coral ? "#D55B61" : "#0F766E"} opacity=".1" filter={`url(#${id}-glow)`} />
      <g className="premium-icon__object" filter={`url(#${id}-shadow)`}>{children(id)}</g>
    </svg>
  );
}

export function ClinicIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M10.5 20.5 24 10l13.5 10.5v15.2a3.8 3.8 0 0 1-3.8 3.8H14.3a3.8 3.8 0 0 1-3.8-3.8V20.5Z" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M20.2 39.3v-8.1a3.8 3.8 0 0 1 7.6 0v8.1" fill="#fff" stroke="#0B665F" strokeWidth="1.7" />
    <rect x="18" y="15" width="12" height="12" rx="4" fill={`url(#${id}-teal)`} />
    <path d="M24 18.2v5.6M21.2 21h5.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M13.2 21.1 24 12.7l10.8 8.4" stroke="#fff" strokeOpacity=".54" strokeWidth="1.4" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function PharmacyIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <rect x="10.5" y="13" width="21" height="27" rx="6" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.7" />
    <rect x="14" y="8.5" width="14" height="6.5" rx="2.5" fill={`url(#${id}-teal)`} />
    <path d="M21 21v10M16 26h10" stroke="#0F766E" strokeWidth="2.8" strokeLinecap="round" />
    <g transform="rotate(-34 35 31)"><rect x="31.5" y="23" width="7" height="16" rx="3.5" fill="#fff" stroke="#0B665F" strokeWidth="1.6" /><path d="M31.5 31h7v4.4a3.5 3.5 0 0 1-7 0V31Z" fill={`url(#${id}-sand)`} /></g>
  </>}</SoftIcon>;
}

export function HotelIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M8.5 22.5 24 9.5l15.5 13v14a3.5 3.5 0 0 1-3.5 3.5H12a3.5 3.5 0 0 1-3.5-3.5v-14Z" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14.5 20.6 24 12.7l9.5 7.9" stroke="#fff" strokeOpacity=".62" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17 39v-9a7 7 0 0 1 14 0v9" fill={`url(#${id}-teal)`} />
    <ellipse cx="24" cy="32.5" rx="3" ry="2.5" fill="#fff" /><circle cx="20.2" cy="29.2" r="1.35" fill="#fff" /><circle cx="24" cy="27.8" r="1.35" fill="#fff" /><circle cx="27.8" cy="29.2" r="1.35" fill="#fff" />
  </>}</SoftIcon>;
}

export function GroomingIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <circle cx="14.5" cy="34" r="5.3" fill={`url(#${id}-sand)`} stroke="#805C3F" strokeWidth="1.5" /><circle cx="33.5" cy="34" r="5.3" fill={`url(#${id}-sand)`} stroke="#805C3F" strokeWidth="1.5" />
    <path d="M18.7 30.7 33.7 10.5M29.3 30.7 14.3 10.5" stroke="#0F766E" strokeWidth="3.3" strokeLinecap="round" /><circle cx="24" cy="24.5" r="3.2" fill={`url(#${id}-teal)`} stroke="#fff" strokeWidth="1" />
    <path d="m35 11 1.1 2.4 2.4 1.1-2.4 1.1L35 18l-1.1-2.4-2.4-1.1 2.4-1.1L35 11Z" fill="#E8C58E" />
  </>}</SoftIcon>;
}

export function StoreIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M11 18h26l-2 21H13L11 18Z" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.7" strokeLinejoin="round" /><path d="M17 18v-3a7 7 0 0 1 14 0v3" stroke="#0B665F" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="24" cy="31" rx="3.5" ry="3" fill={`url(#${id}-teal)`} /><circle cx="19.6" cy="27.3" r="1.6" fill="#1A9186" /><circle cx="24" cy="25.8" r="1.6" fill="#1A9186" /><circle cx="28.4" cy="27.3" r="1.6" fill="#1A9186" /><path d="M13 20h22" stroke="#fff" strokeOpacity=".72" strokeWidth="1.4" />
  </>}</SoftIcon>;
}

export function EmergencyIcon(props: IconProps) {
  return <SoftIcon {...props} coral>{(id) => <>
    <circle cx="24" cy="24" r="16" fill={`url(#${id}-mint)`} stroke="#C84B52" strokeWidth="1.8" /><circle cx="24" cy="24" r="12" fill={`url(#${id}-teal)`} /><path d="M24 17.5v13M17.5 24h13" stroke="#fff" strokeWidth="3.8" strokeLinecap="round" /><path d="M17 14.5a13.5 13.5 0 0 1 7-2" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function ShelterIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M24 7.5 40 20.2v15.3a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V20.2L24 7.5Z" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.7" strokeLinejoin="round" /><path d="M13.2 20.8 24 12.2l10.8 8.6" stroke="#fff" strokeOpacity=".65" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M24 34.7c-4.3-3.1-6.6-5.2-6.6-8a3.6 3.6 0 0 1 6.6-2.2 3.6 3.6 0 0 1 6.6 2.2c0 2.8-2.3 4.9-6.6 8Z" fill={`url(#${id}-teal)`} />
  </>}</SoftIcon>;
}

export function LocationIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M24 6.5c-8 0-14 5.8-14 13.5 0 10.4 14 21.5 14 21.5S38 30.4 38 20C38 12.3 32 6.5 24 6.5Z" fill={`url(#${id}-teal)`} stroke="#0B665F" strokeWidth="1.5" /><circle cx="24" cy="20" r="6" fill={`url(#${id}-mint)`} /><circle cx="22" cy="17.8" r="1.2" fill="#0F766E" /><circle cx="26" cy="17.8" r="1.2" fill="#0F766E" /><path d="M20.8 21.5c1.9 2 4.5 2 6.4 0" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function PhoneIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <path d="M14 8.8c1.7-1 5.3 4.8 5.4 6.6.1 1.2-2.6 2.7-2.9 3.8 1.7 4.2 5.9 8.5 10.2 10.2 1.1-.3 2.6-3 3.8-2.9 1.8.1 7.6 3.7 6.6 5.4-1.7 2.9-4 6.8-8.3 5.4C20 34.5 10.4 25 7.6 16.2 6.2 11.9 11.1 10.5 14 8.8Z" fill={`url(#${id}-teal)`} stroke="#0B665F" strokeWidth="1.4" />}</SoftIcon>;
}

export function RouteIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <><path d="m8 24 31-15-12.3 31-4.2-12.5L8 24Z" fill={`url(#${id}-teal)`} stroke="#0B665F" strokeWidth="1.6" strokeLinejoin="round" /><path d="m22.5 27.5 16.5-18" stroke="#fff" strokeOpacity=".72" strokeWidth="1.7" strokeLinecap="round" /></>}</SoftIcon>;
}

export function VerifiedIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <><path d="m24 6 5 3.2 6-.1 1.7 5.8 4.2 4.3-2.1 5.6.1 6-5.8 1.7-4.3 4.2-5.6-2.1-6 .1-1.7-5.8-4.2-4.3 2.1-5.6-.1-6 5.8-1.7L19.2 8 24 6Z" fill={`url(#${id}-teal)`} stroke="#0B665F" strokeWidth="1.4" strokeLinejoin="round" /><path d="m16.8 23.7 4.6 4.5 9.8-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}</SoftIcon>;
}

export function FilterIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>{[14, 24, 34].map((y, index) => <g key={y}><rect x="8" y={y - 2} width="32" height="4" rx="2" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.2" /><circle cx={[18, 31, 22][index]} cy={y} r="5" fill={`url(#${id}-teal)`} stroke="#fff" strokeWidth="1.5" /></g>)}</>}</SoftIcon>;
}

export function PetProfileIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <>
    <path d="M8.5 25c0-7.5 4.5-13 10.5-13s10.5 5.5 10.5 13-4.5 13-10.5 13S8.5 32.5 8.5 25Z" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.5" /><path d="m10.5 19-1.2-9 7.4 4.3M27.5 18l3.2-8 5.8 6.5" fill={`url(#${id}-sand)`} stroke="#805C3F" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="16" cy="24" r="1.2" fill="#0F766E" /><circle cx="22" cy="24" r="1.2" fill="#0F766E" /><path d="M16.8 29c1.5 1.4 3 1.4 4.5 0" stroke="#0F766E" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="33.5" cy="28" r="7.5" fill={`url(#${id}-teal)`} stroke="#fff" strokeWidth="1.5" /><path d="M30.4 29c1.4 1.8 4.8 1.8 6.2 0M31.2 25.7h.1M35.8 25.7h.1" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
  </>}</SoftIcon>;
}

export function TrainingIcon(props: IconProps) {
  return <SoftIcon {...props}>{(id) => <><path d="m24 9 16 7-16 7-16-7 16-7Z" fill={`url(#${id}-teal)`} stroke="#0B665F" strokeWidth="1.5" strokeLinejoin="round" /><path d="M15.5 20.5v8c0 5 17 5 17 0v-8" fill={`url(#${id}-mint)`} stroke="#0B665F" strokeWidth="1.5" /><path d="M40 16v11" stroke="#0B665F" strokeWidth="1.7" strokeLinecap="round" /><circle cx="40" cy="30" r="2.2" fill={`url(#${id}-sand)`} /></>}</SoftIcon>;
}

export const FriendlyIcon = LocationIcon;
export const PawIcon = PetProfileIcon;

export function EmergencyCtaIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".12" /><path d="M12 7.8v8.4M7.8 12h8.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
}

const ICONS: Partial<Record<PlaceCategory, (props: IconProps) => React.JSX.Element>> = {
  veterinary_clinic: ClinicIcon, emergency_vet: EmergencyIcon, pet_store: StoreIcon,
  vet_pharmacy: PharmacyIcon, grooming: GroomingIcon, pet_boarding: HotelIcon,
  shelter: ShelterIcon, dog_training: TrainingIcon, pet_friendly_place: FriendlyIcon,
};

export function ServiceIcon({ category, className }: IconProps & { category: PlaceCategory }) {
  const Icon = ICONS[category] ?? PawIcon;
  return <Icon className={className} />;
}
