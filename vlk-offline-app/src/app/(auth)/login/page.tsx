import { redirect } from "next/navigation";
import { Cross, ShieldCheck, WifiOff } from "lucide-react";
import { currentActor } from "@/server/auth";
import { Login } from "@/components/login";
export default async function LoginPage() {
  if (await currentActor()) redirect("/");
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand">
          <span className="brand-icon">
            <Cross size={25} />
          </span>
          <span>
            ВЛК <b>OFFLINE</b>
          </span>
        </div>
        <span className="eyebrow">STANDBY / ЛОКАЛЬНИЙ КАБІНЕТ</span>
        <h1>
          Робота триває.
          <br />
          Навіть без інтернету.
        </h1>
        <p>
          Реєстрація, огляди та підсумки комісії в одному локальному просторі.
          Готові поля для перенесення у вашу МІС.
        </p>
        <div className="login-features">
          <span>
            <WifiOff size={18} />
            Автономно в локальній мережі
          </span>
          <span>
            <ShieldCheck size={18} />
            Персональний доступ працівників
          </span>
        </div>
      </section>
      <section className="login-card card">
        <div className="card-header">
          <span className="eyebrow">ДОБРОГО ДНЯ</span>
          <h2>Увійдіть до кабінету</h2>
          <p>
            Використайте обліковий запис, який створив адміністратор установи.
          </p>
        </div>
        <div className="card-content">
          <Login />
        </div>
        <div className="card-footer">
          Перший запуск? Адміністратор має виконати npm run setup на сервері.
        </div>
      </section>
    </main>
  );
}
