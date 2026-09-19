import Link from "next/link";
import {
  Cross,
  ClipboardList,
  UserRoundPlus,
  ArrowRightLeft,
  Download,
  Users,
  ShieldCheck,
} from "lucide-react";
import { pageActor } from "@/server/auth";
import { standbyScreen } from "@/components/standby";
import {
  hasRole,
  registryRoles,
  coordinatorRoles,
  roleNames,
} from "@/lib/domain";
import { LogoutButton } from "@/components/common";
export default async function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Стан бази перевіряється до автентифікації: без неї кабінет усе одно
  // не відкрити, а екран очікування пояснює причину замість помилки 500.
  const standby = await standbyScreen();
  if (standby) return standby;
  const a = await pageActor();
  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Cross size={22} />
          </span>
          <span>
            ВЛК <b>OFFLINE</b>
            <small>STANDBY WORKSPACE</small>
          </span>
        </Link>
        <div className="local-indicator">
          <span />
          Локальний сервер
        </div>
        <span className="nav-caption">РОБОЧИЙ ПРОСТІР</span>
        <nav>
          <Link href="/">
            <ClipboardList size={19} />
            Черга пацієнтів
          </Link>
          {hasRole(a, registryRoles) ? (
            <Link href="/registry/new">
              <UserRoundPlus size={19} />
              Новий прийом
            </Link>
          ) : null}
          {hasRole(a, coordinatorRoles) ? (
            <>
              <Link href="/transfers">
                <ArrowRightLeft size={19} />
                Перенесення в Helsi
              </Link>
              <Link href="/exports">
                <Download size={19} />
                Експорт за день
              </Link>
            </>
          ) : null}
          {hasRole(a, ["ADMIN"]) ? (
            <Link href="/admin">
              <Users size={19} />
              Працівники
            </Link>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={19} />
          <p>
            Дані залишаються
            <br />
            на сервері установи
          </p>
          <small>ВЛК Standby · 1.0</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar no-print">
          <span className="topbar-title">Медичні огляди / резервний режим</span>
          <div className="user-chip">
            <span className="avatar">{a.full_name.slice(0, 1)}</span>
            <div>
              <strong>{a.full_name}</strong>
              <small>{a.roles.map((r) => roleNames[r]).join(" · ")}</small>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
