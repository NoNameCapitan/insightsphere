import { pageActor } from "@/server/auth";
import { standbyScreen } from "@/components/standby";
import { registryRoles } from "@/lib/domain";
import { Registration } from "@/components/registration";
export default async function NewPage() {
  const standby = await standbyScreen();
  if (standby) return standby;
  await pageActor(registryRoles);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">РЕЄСТРАТУРА</span>
          <h1>Новий прийом</h1>
          <p>Один запис пацієнта, окрема сесія кожного проходження.</p>
        </div>
      </div>
      <Registration
        commission={process.env.COMMISSION_NAME || "ВЛК установи"}
        revision={
          process.env.ORDER_402_REVISION ||
          "За редакцією, чинною на дату огляду"
        }
      />
    </>
  );
}
