"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; urgent?: boolean; match: (p: string) => boolean }[] = [
  { href: "/help", label: "Терміново", urgent: true, match: (p) => p.startsWith("/help") },
  { href: "/nearby", label: "Поруч", match: (p) => p.startsWith("/nearby") || p.startsWith("/place") },
  { href: "/my-pets", label: "Мої тварини", match: (p) => p.startsWith("/my-pets") },
  { href: "/kyiv-updates", label: "Актуальне", match: (p) => p.startsWith("/kyiv-updates") },
  { href: "/for-partners", label: "Партнерам", match: (p) => p.startsWith("/for-partners") },
];

/** Desktop header links with a current-page indicator. Same routes as before. */
export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  return (
    <div className="hidden min-w-0 items-center gap-0.5 text-sm sm:flex">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`site-nav__link ${link.urgent ? "site-nav__link--urgent" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
