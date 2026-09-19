"use client";
import { requestKey as newRequestKey } from "@/lib/request-key";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRoundPlus, Search } from "lucide-react";
import { registerAction, patientSearchAction } from "@/actions";
import { specialties, today, personName, displayDate } from "@/lib/domain";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field, ErrorBox, useTask, useUnsaved } from "./common";
export function Registration({
  commission,
  revision,
}: {
  commission: string;
  revision: string;
}) {
  const router = useRouter(),
    task = useTask(),
    search = useTask();
  const [key] = useState(() => newRequestKey()),
    [dirty, setDirty] = useState(false),
    [query, setQuery] = useState(""),
    [found, setFound] = useState<
      Extract<
        Awaited<ReturnType<typeof patientSearchAction>>,
        { ok: true }
      >["data"]
    >([]),
    [patientId, setPatientId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({
    rnokpp: "",
    rnokpp_absence_reason: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    birth_date: "",
    rank: "",
    military_unit_or_tck: "",
    referral_number: "",
    referral_date: today(),
    referral_issuer: "",
    session_date: today(),
    commission_name: commission,
    order_402_revision: revision,
  });
  useUnsaved(dirty);
  const change = (k: string, v: string) => {
    setDirty(true);
    setValues((s) => ({ ...s, [k]: v }));
  };
  const input = (
    key: string,
    label: string,
    required = false,
    type = "text",
  ) => (
    <Field key={key} label={label}>
      <Input
        name={key}
        value={values[key]}
        onChange={(e) => change(key, e.target.value)}
        type={type}
        required={required}
        maxLength={key === "rnokpp" ? 10 : 500}
        inputMode={key === "rnokpp" ? "numeric" : undefined}
      />
    </Field>
  );
  return (
    <div className="stack">
      <section className="card card-content">
        <h3>Пацієнт уже був у нас?</h3>
        <div className="inline">
          <Input
            aria-label="Знайти пацієнта"
            placeholder="РНОКПП або прізвище"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={search.pending || query.length < 2}
            onClick={() =>
              search.run(() => patientSearchAction(query), setFound)
            }
          >
            <Search size={16} />
            Пошук
          </Button>
        </div>
        <ErrorBox message={search.error} />
        {found.map((p) => (
          <button
            key={p.id}
            className="search-result"
            onClick={() => {
              setPatientId(p.id);
              setDirty(true);
              setValues((v) => ({
                ...v,
                ...Object.fromEntries(
                  Object.entries(p)
                    .filter(([k]) => k !== "id")
                    .map(([k, value]) => [k, value || ""]),
                ),
              }));
              setFound([]);
            }}
          >
            {personName(p)} · {displayDate(p.birth_date)} ·{" "}
            {p.rnokpp || "Без РНОКПП"}
          </button>
        ))}
        {patientId ? (
          <div className="notice">
            Обрано наявного пацієнта. Створюється нове проходження ВЛК.{" "}
            <button
              className="text-button"
              onClick={() => {
                setPatientId("");
                setValues((v) => ({
                  ...v,
                  rnokpp: "",
                  last_name: "",
                  first_name: "",
                  middle_name: "",
                  birth_date: "",
                }));
              }}
            >
              Скасувати вибір
            </button>
          </div>
        ) : null}
      </section>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(
            () =>
              registerAction({
                ...values,
                patient_id: patientId || undefined,
                creation_key: key,
                required_specialties: f.getAll("required_specialties"),
              }),
            (r) => {
              setDirty(false);
              router.push("/sessions/" + r.id);
              router.refresh();
            },
          );
        }}
      >
        <div className="two-columns">
          <section className="card">
            <div className="card-header">
              <h2>Особові дані</h2>
              <p>Заповніть за документом, що посвідчує особу.</p>
            </div>
            <div className="card-content field-grid">
              {input("last_name", "Прізвище", true)}
              {input("first_name", "Ім’я", true)}
              {input("middle_name", "По батькові")}
              {input("birth_date", "Дата народження", true, "date")}
              {input("rnokpp", "РНОКПП (10 цифр)")}
              {!values.rnokpp
                ? input(
                    "rnokpp_absence_reason",
                    "Причина відсутності РНОКПП",
                    true,
                  )
                : null}
              {input("rank", "Військове звання")}
              {input(
                "military_unit_or_tck",
                "ТЦК та СП / військова частина",
                true,
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-header">
              <h2>Направлення та прийом</h2>
              <p>Реквізити зберігаються саме для цього проходження.</p>
            </div>
            <div className="card-content field-grid">
              {input("referral_number", "Номер направлення", true)}
              {input("referral_date", "Дата направлення", true, "date")}
              {input("referral_issuer", "Орган, що направив", true)}
              {input("session_date", "Дата прийому", true, "date")}
              {input("commission_name", "Комісія / заклад", true)}
              {input(
                "order_402_revision",
                "Редакція наказу 402 за документами установи",
                true,
              )}
            </div>
          </section>
        </div>
        <section className="card">
          <div className="card-header">
            <h2>Маршрут огляду</h2>
            <p>Оберіть потрібних спеціалістів для цього проходження.</p>
          </div>
          <div className="card-content specialties">
            {Object.entries(specialties).map(([key, label]) => (
              <label className="check-tile" key={key}>
                <input
                  type="checkbox"
                  name="required_specialties"
                  value={key}
                  defaultChecked
                />
                {label}
              </label>
            ))}
          </div>
        </section>
        <ErrorBox message={task.error} />
        <div className="save-bar">
          <span>Талон буде створено після збереження.</span>
          <Button disabled={task.pending}>
            <UserRoundPlus size={17} />
            {task.pending ? "Збереження…" : "Зареєструвати пацієнта"}
          </Button>
        </div>
      </form>
    </div>
  );
}
