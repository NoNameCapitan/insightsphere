import { pageActor } from "@/server/auth";
import { standbyScreen } from "@/components/standby";
import { db } from "@/db";
import { Users } from "@/components/users";
export default async function Admin() {
  const standby = await standbyScreen();
  if (standby) return standby;
  await pageActor(["ADMIN"]);
  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      full_name: true,
      role: true,
      specialty: true,
      is_active: true,
      extra_roles: { select: { role: true } },
    },
    orderBy: { full_name: "asc" },
  });
  const catalogs = await db.icd10Entry.groupBy({
    by: ["catalog_version"],
    _count: true,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">АДМІНІСТРУВАННЯ</span>
          <h1>Працівники й доступ</h1>
          <p>Персональні облікові записи замість спільних паролів.</p>
        </div>
      </div>
      <Users users={users} />
      <section className="card card-content catalog-info">
        <h3>Локальні довідники МКХ</h3>
        {catalogs.map((c) => (
          <p key={c.catalog_version}>
            {c.catalog_version} · {c._count} кодів
          </p>
        ))}
        {!catalogs.length ? (
          <p>
            Довідник ще не імпортовано. Лікар може ввести код із документа
            вручну.
          </p>
        ) : null}
        <p className="muted">
          Оновлення довідника: npm run import:icd -- шлях/до/каталогу.json.
          Вхідний файл має містити версію та джерело. Старі версії зберігаються.
        </p>
      </section>
    </>
  );
}
