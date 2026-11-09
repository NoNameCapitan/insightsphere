import { useId, type ReactNode } from "react";

type Props = { className?: string };

function MedicalIcon({ className, children, sand = false }: Props & { children: (id: string) => ReactNode; sand?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`medical-icon ${className ?? ""}`} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-main`} x1="12" y1="8" x2="37" y2="40">
          <stop stopColor={sand ? "#FFF4E5" : "#55C1B2"} />
          <stop offset="1" stopColor={sand ? "#D8B890" : "#126E66"} />
        </linearGradient>
        <linearGradient id={`${id}-soft`} x1="10" y1="8" x2="38" y2="41">
          <stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#DDEFE9" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#123E3A" floodOpacity=".18" />
        </filter>
      </defs>
      <ellipse cx="24" cy="41" rx="12" ry="2.5" fill="#126E66" opacity=".09" />
      <g className="premium-icon__object" filter={`url(#${id}-shadow)`}>{children(id)}</g>
    </svg>
  );
}

export function VaccinationIcon(props: Props) {
  return <MedicalIcon {...props}>{(id) => <>
    <g transform="rotate(-38 24 24)"><rect x="20" y="10" width="9" height="25" rx="3" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.6" /><rect x="20" y="23" width="9" height="12" rx="2" fill={`url(#${id}-main)`} /><path d="M17 10h15M24.5 6v4M24.5 35v7" stroke="#0B5752" strokeWidth="1.8" strokeLinecap="round" /></g>
    <path d="M35 11.5v7M31.5 15h7" stroke="#126E66" strokeWidth="2.4" strokeLinecap="round" />
  </>}</MedicalIcon>;
}

export function TreatmentIcon(props: Props) {
  return <MedicalIcon {...props} sand>{(id) => <>
    <rect x="10" y="17" width="28" height="17" rx="8.5" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.6" transform="rotate(-22 24 25.5)" />
    <path d="m14 31 20-11" stroke="#0B5752" strokeWidth="1.5" /><path d="M14 27c4 5 8 7 12 8" stroke={`url(#${id}-main)`} strokeWidth="8" strokeLinecap="round" opacity=".85" />
  </>}</MedicalIcon>;
}

export function VisitIcon(props: Props) {
  return <MedicalIcon {...props}>{(id) => <>
    <rect x="10" y="11" width="28" height="29" rx="6" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.6" /><rect x="17" y="7" width="14" height="8" rx="3" fill={`url(#${id}-main)`} />
    <path d="M24 20v10M19 25h10" stroke="#126E66" strokeWidth="2.7" strokeLinecap="round" /><path d="M16 35h16" stroke="#0B5752" strokeOpacity=".35" strokeWidth="1.5" />
  </>}</MedicalIcon>;
}

export function WeightIcon(props: Props) {
  return <MedicalIcon {...props}>{(id) => <>
    <rect x="8" y="12" width="32" height="27" rx="8" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.6" /><path d="M17 23a7 7 0 0 1 14 0" stroke={`url(#${id}-main)`} strokeWidth="5" strokeLinecap="round" /><path d="m24 23 4-5" stroke="#0B5752" strokeWidth="1.8" strokeLinecap="round" /><path d="M15 32h18" stroke="#0B5752" strokeOpacity=".28" strokeWidth="1.5" />
  </>}</MedicalIcon>;
}

export function DocumentIcon(props: Props) {
  return <MedicalIcon {...props} sand>{(id) => <>
    <path d="M12 7h17l8 8v25H12V7Z" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.6" strokeLinejoin="round" /><path d="M29 7v9h8" fill={`url(#${id}-main)`} stroke="#0B5752" strokeWidth="1.4" /><path d="M18 24h13M18 29h13M18 34h8" stroke="#126E66" strokeWidth="1.7" strokeLinecap="round" />
  </>}</MedicalIcon>;
}

export function ReminderIcon(props: Props) {
  return <MedicalIcon {...props} sand>{(id) => <>
    <path d="M13 32h22l-3-5v-7a8 8 0 0 0-16 0v7l-3 5Z" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.6" strokeLinejoin="round" /><path d="M20 35a4 4 0 0 0 8 0" stroke="#0B5752" strokeWidth="1.8" /><circle cx="32" cy="12" r="5" fill={`url(#${id}-main)`} /><path d="M32 9.5v3l2 1" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
  </>}</MedicalIcon>;
}

export function MicrochipIcon(props: Props) {
  return <MedicalIcon {...props}>{(id) => <>
    <rect x="12" y="12" width="24" height="24" rx="6" fill={`url(#${id}-soft)`} stroke="#0B5752" strokeWidth="1.7" /><rect x="18" y="18" width="12" height="12" rx="3" fill={`url(#${id}-main)`} />
    {[16,24,32].map((n) => <g key={n}><path d={`M${n} 7v5M${n} 36v5M7 ${n}h5M36 ${n}h5`} stroke="#0B5752" strokeWidth="1.4" strokeLinecap="round" /></g>)}
  </>}</MedicalIcon>;
}
