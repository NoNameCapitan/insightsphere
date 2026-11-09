"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Головна",
    match: (p: string) => p === "/",
    icon: <path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.2H9v5.2H5.5A1.5 1.5 0 0 1 4 19v-7.8Z" />,
  },
  {
    href: "/nearby",
    label: "Поруч",
    match: (p: string) => p.startsWith("/nearby") || p.startsWith("/place"),
    icon: (
      <>
        <path d="M12 21s6.5-5.6 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.4 6.5 11 6.5 11Z" />
        <circle cx="12" cy="10" r="2.3" />
      </>
    ),
  },
  {
    href: "/help",
    label: "Терміново",
    urgent: true,
    match: (p: string) => p.startsWith("/help"),
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
  },
  {
    href: "/my-pets",
    label: "Мої тварини",
    match: (p: string) => p.startsWith("/my-pets"),
    icon: (
      <>
        <circle cx="7" cy="10" r="1.6" />
        <circle cx="10.5" cy="6.5" r="1.6" />
        <circle cx="14.5" cy="6.5" r="1.6" />
        <circle cx="17.5" cy="10" r="1.6" />
        <path d="M12 12.200c-2.4 0-4.5 2.3-4.5 4.4 0 1.5 1.2 2.2 2.5 2.2.8 0 1.3-.3 2-.300s1.2.3 2 .300c1.3 0 2.5-.7 2.5-2.2 0-2.1-2.1-4.4-4.5-4.400Z" />
      </>
    ),
  },
];

/** Mobile-only bottom navigation. Hidden from sm up, where the header nav shows. */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  // Admin and partner tools keep their own full-height layouts.
  if (pathname.startsWith("/admin") || pathname.startsWith("/partner")) return null;
  return (
    <nav className="tabbar" aria-label="Основна навігація">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.match(pathname) ? "page" : undefined}
          className={tab.urgent ? "tabbar__urgent" : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {tab.icon}
          </svg>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
