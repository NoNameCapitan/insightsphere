"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Kanban,
  Settings2,
  Radar,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
const links = [
  { href: "/", label: "Огляд", icon: LayoutDashboard },
  { href: "/search", label: "Пошук лідів", icon: Search },
  { href: "/campaigns", label: "Кампанії", icon: Kanban },
  { href: "/settings", label: "Налаштування", icon: Settings2 },
];
export default function Nav() {
  const pathname = usePathname();
  return (
    <>
      <a href="#main-content" className="skip-link">
        До основного вмісту
      </a>
      <aside className="app-sidebar">
        <Link
          href="/"
          className="flex items-center gap-3 px-2 py-2"
          aria-label="AI Lead Hunter — огляд"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[#c2f2d5] text-[#123f34]">
            <Radar size={24} />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Lead Hunter
            <span className="ml-1.5 text-[10px] text-emerald-200">AI</span>
          </span>
        </Link>
        <p className="mb-3 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Робочий простір
        </p>
        <nav aria-label="Головна навігація" className="space-y-1.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn("sidebar-link", pathname === href && "active")}
            >
              <Icon size={19} />
              {label}
              {pathname === href && (
                <span className="ml-auto size-1.5 rounded-full bg-emerald-200" />
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <span className="mb-3 grid size-8 place-items-center rounded-lg bg-white/10">
            <ShieldCheck size={18} />
          </span>
          <p className="text-sm font-semibold text-white">
            Ваші кампанії — у вас
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Дані зберігаються в цьому браузері. Резервна копія допоможе
            перенести їх.
          </p>
          <Link
            href="/settings"
            className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-200"
          >
            Керувати даними <ArrowUpRight size={14} />
          </Link>
        </div>
        <p className="mt-5 px-3 text-[10px] text-slate-500">
          LOCAL PROSPECTING · v0.3
        </p>
      </aside>
      <header className="mobile-header">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Radar size={23} className="text-brand-600" />
          Lead Hunter <span className="text-xs text-brand-600">AI</span>
        </Link>
        <span className="chip bg-brand-50 text-brand-700">Робочий простір</span>
      </header>
      <nav className="mobile-nav" aria-label="Мобільна навігація">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium",
              pathname === href
                ? "bg-brand-50 text-brand-700"
                : "text-slate-500",
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
