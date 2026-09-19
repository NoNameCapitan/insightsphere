import { Cross, DatabaseZap, PlugZap, Wrench } from "lucide-react";
import type { DatabaseState } from "@/db";

// Серверний компонент без клієнтського коду: показується замість кабінету,
// коли база ще не налаштована або недоступна. Жодних даних пацієнтів тут
// немає, тому сторінка безпечна і для публічного розгортання.
const screens = {
  misconfigured: {
    icon: Wrench,
    title: "Базу даних не налаштовано",
    lead: "Застосунок запущено, але джерело даних ще не вказане. Медичні записи не втрачено — їх просто немає де читати.",
    steps: [
      "На сервері установи: npm run prepare:offline, далі npm start.",
      "У хмарному розгортанні: задайте DATABASE_URL і DATABASE_AUTH_TOKEN, після чого повторіть розгортання.",
      "Перевірка стану: /api/health.",
    ],
  },
  unreachable: {
    icon: PlugZap,
    title: "База даних недоступна",
    lead: "Налаштування є, але з'єднатися з базою не вдалося. Це не втрата даних: коли база відповість, кабінет відкриється без додаткових дій.",
    steps: [
      "Перевірте, чи працює сервер бази та чи правильна адреса в DATABASE_URL.",
      "Для віддаленої бази перевірте чинність DATABASE_AUTH_TOKEN.",
      "Після зміни змінних оточення потрібне повторне розгортання.",
    ],
  },
  "migrations-pending": {
    icon: DatabaseZap,
    title: "Схему бази ще не створено",
    lead: "З'єднання з базою є, але таблиць немає. Потрібно застосувати міграції.",
    steps: [
      "Локальна база: npm run db:migrate.",
      "Віддалена база: npm run db:migrate:remote з тими самими DATABASE_URL і DATABASE_AUTH_TOKEN.",
      "Далі npm run setup — він створює першого адміністратора та довідник.",
    ],
  },
} as const;

export function Standby({ state }: { state: DatabaseState }) {
  const screen = screens[state.status as keyof typeof screens];
  if (!screen) return null;
  const Icon = screen.icon;
  return (
    <main className="standby" data-vlk-standby>
      <div className="brand">
        <span className="brand-icon">
          <Cross size={22} />
        </span>
        <span>
          ВЛК <b>OFFLINE</b>
        </span>
      </div>
      <span className="eyebrow">РЕЖИМ ОЧІКУВАННЯ</span>
      <h1>
        <Icon size={22} aria-hidden />
        {screen.title}
      </h1>
      <p>{screen.lead}</p>
      <ol>
        {screen.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {state.detail ? (
        <details>
          <summary>Технічна деталь</summary>
          <p className="standby-detail">{state.detail}</p>
          <p className="standby-meta">
            Стан: {state.status}
            {state.driver ? " · драйвер: " + state.driver : ""}
          </p>
        </details>
      ) : null}
    </main>
  );
}

// Кожен серверний роут перевіряє стан сам: макет не рендерить children, але
// сторінка під ним усе одно виконується, і без цієї перевірки її звернення
// до бази лишало б у журналі необроблений виняток.
export async function standbyScreen() {
  const { databaseState } = await import("@/db");
  const state = await databaseState();
  return state.status === "ok" ? null : <Standby state={state} />;
}
