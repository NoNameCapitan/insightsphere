import Link from "next/link";
import { pageActor } from "@/server/auth";
import {
  coordinatorRoles,
  personName,
  type DocumentPayload,
  displayDate,
  statusNames,
} from "@/lib/domain";
import { db } from "@/db";
export default async function Transfers() {
  await pageActor(coordinatorRoles);
  const docs = await db.vlkDocument.findMany({
    where: { session: { replaced_by: null } },
    orderBy: { created_at: "desc" },
    take: 200,
    include: { sync_logs: { orderBy: { created_at: "desc" }, take: 1 } },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ПІСЛЯ ВІДНОВЛЕННЯ МІС</span>
          <h1>Перенесення в Helsi</h1>
          <p>Завершені сесії та збережений прогрес оператора.</p>
        </div>
      </div>
      <section className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Пацієнт</th>
              <th>Дата</th>
              <th>Прогрес</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const p = d.payload as DocumentPayload,
                l = d.sync_logs[0];
              return (
                <tr key={d.id}>
                  <td>
                    <strong>{personName(p.patient)}</strong>
                    <small>{p.ticket}</small>
                  </td>
                  <td>{displayDate(p.date)}</td>
                  <td>
                    <span
                      className={
                        "badge " + (l?.status === "CONFIRMED" ? "success" : "")
                      }
                    >
                      {l ? statusNames[l.status] : "Очікує перенесення"}
                    </span>
                  </td>
                  <td>
                    <Link href={"/sessions/" + d.session_id + "/transfer"}>
                      Відкрити →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!docs.length ? (
          <div className="empty">
            <h3>Ще немає завершених сесій</h3>
            <p>
              Після підтвердження підсумку комісією тут з’явиться готовий буфер.
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}
