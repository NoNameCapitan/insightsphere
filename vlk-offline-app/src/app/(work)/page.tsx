import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { pageActor } from "@/server/auth";
import { standbyScreen } from "@/components/standby";
import { queue } from "@/server/records";
import { today, displayDate, hasRole, registryRoles } from "@/lib/domain";
import { Queue } from "@/components/queue";
import { Button } from "@/components/ui/button";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const standby = await standbyScreen();
  if (standby) return standby;
  const a = await pageActor(),
    date = today(),
    rows = await queue(a, date),
    params = await searchParams;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">РОБОЧИЙ ДЕНЬ · {displayDate(date)}</span>
          <h1>Черга пацієнтів</h1>
          <p>Від реєстрації до готового підсумку — в одному місці.</p>
        </div>
        {hasRole(a, registryRoles) ? (
          <Button asChild>
            <Link href="/registry/new">
              <Plus size={17} />
              Новий прийом
            </Link>
          </Button>
        ) : null}
      </div>
      {params.denied ? (
        <div className="notice">
          Для цього розділу потрібна інша роль доступу.
        </div>
      ) : null}
      <div className="metrics">
        {[
          ["Сьогодні", rows.length],
          [
            "Огляди тривають",
            rows.filter((r) => ["REGISTERED", "IN_PROGRESS"].includes(r.status))
              .length,
          ],
          [
            "На розгляді",
            rows.filter((r) => r.status === "READY_FOR_REVIEW").length,
          ],
          ["Завершено", rows.filter((r) => r.status === "FINALIZED").length],
        ].map(([label, n]) => (
          <section className="metric" key={label}>
            <small>{label}</small>
            <strong>{n}</strong>
          </section>
        ))}
      </div>
      {a.roles.length === 1 && a.role === "ADMIN" ? (
        <div className="notice">
          Створіть облікові записи реєстратора, лікарів, секретаря та голови
          комісії. Адміністративна роль сама по собі не відкриває клінічні
          записи.{" "}
          <Link href="/admin">
            Перейти до працівників <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <Queue initial={rows} date={date} />
      )}
      <div className="workflow-note">
        <strong>1. Реєстрація</strong>
        <span>2. Огляди спеціалістів</span>
        <span>3. Підсумок комісії</span>
        <span>4. Перенесення у МІС</span>
      </div>
    </>
  );
}
