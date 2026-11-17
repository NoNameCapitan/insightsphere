import Image from "next/image";

/** A personal, species-neutral fallback; the adjacent heading supplies the name. */
export function PetPortrait({ name, photoUrl, size = 64 }: { name: string; photoUrl?: string; size?: 64 | 72 }) {
  if (photoUrl) return <Image unoptimized src={photoUrl} alt="" width={size} height={size} className="h-full w-full object-cover" />;

  const initial = name.trim().normalize("NFC").match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase("uk-UA");
  return <span aria-hidden="true" className="grid h-full w-full place-items-center bg-[#f4ebd9] text-[28px] font-medium leading-none text-[#355a43]">
    {initial ?? <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.6 13.3c1.2-2.5 2.2-3.5 4.4-3.5s3.2 1 4.4 3.5c.8 1.6 2.4 2.5 2.1 4.3-.2 1.5-1.5 2.2-3 1.7-2.5-.8-4.5-.8-7 0-1.5.5-2.8-.2-3-1.7-.3-1.8 1.3-2.7 2.1-4.3Z"/><ellipse cx="4.6" cy="9" rx="1.7" ry="2.2"/><ellipse cx="9" cy="4.8" rx="1.7" ry="2.2"/><ellipse cx="15" cy="4.8" rx="1.7" ry="2.2"/><ellipse cx="19.4" cy="9" rx="1.7" ry="2.2"/></svg>}
  </span>;
}
