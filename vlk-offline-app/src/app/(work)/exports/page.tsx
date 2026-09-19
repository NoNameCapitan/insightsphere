import { pageActor } from "@/server/auth";
import { standbyScreen } from "@/components/standby";
import { coordinatorRoles } from "@/lib/domain";
import { Export } from "@/components/export";
export default async function Exports() {
  const standby = await standbyScreen();
  if (standby) return standby;
  await pageActor(coordinatorRoles);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЗАПИСИ ЗА ДЕНЬ</span>
          <h1>Експорт даних</h1>
          <p>Завантаження на цей комп’ютер, без зовнішніх сервісів.</p>
        </div>
      </div>
      <Export />
    </>
  );
}
