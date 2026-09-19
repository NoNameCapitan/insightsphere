"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, FilePenLine, Plus, Trash2 } from "lucide-react";
import { examAction } from "@/actions";
import { fitnessNames } from "@/lib/domain";
import { Textarea, Input, Select } from "./ui/input";
import { Button } from "./ui/button";
import { Field, ErrorBox, useTask, useUnsaved, RefreshButton } from "./common";
import { IcdPicker } from "./icd-picker";
import { CopyField } from "./copy-field";
type Extra = {
  icd10_code: string;
  icd10_version: string;
  diagnosis_text: string;
  order_402_article: string;
};
export type ExamInitial = {
  id: string;
  version: number;
  status: string;
  doctor_id: string;
  revision: number;
  complaints: string;
  anamnesis: string;
  objective_data: string;
  icd10_code: string | null;
  icd10_version: string | null;
  diagnosis_text: string;
  no_icd_reason: string | null;
  order_402_article: string | null;
  doctor_conclusion: string;
  recommendations: string;
  fitness_category: string | null;
  additional_diagnoses: {
    icd10_code: string;
    icd10_version: string;
    diagnosis_text: string;
    order_402_article: string | null;
  }[];
};
const labels: Record<string, string> = {
  complaints: "Скарги",
  anamnesis: "Анамнез",
  objective_data: "Об’єктивні дані",
  diagnosis_text: "Клінічний діагноз",
  doctor_conclusion: "Висновок спеціаліста",
  recommendations: "Рекомендації",
};
export function Examination({
  sessionId,
  sessionVersion,
  initial,
  prefill,
  actorId,
  closed,
}: {
  sessionId: string;
  sessionVersion: number;
  initial: ExamInitial | null;
  prefill?: ExamInitial | null;
  actorId: string;
  closed: boolean;
}) {
  const router = useRouter(),
    task = useTask();
  const [amending, setAmending] = useState(false),
    [dirty, setDirty] = useState(false),
    [saved, setSaved] = useState("");
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [
        ...Object.keys(labels),
        "icd10_code",
        "icd10_version",
        "no_icd_reason",
        "order_402_article",
        "fitness_category",
      ].map((k) => [
        k,
        String(
          ((initial || prefill) as unknown as Record<string, unknown>)?.[k] ||
            "",
        ),
      ]),
    ),
  );
  const [reason, setReason] = useState(""),
    [extras, setExtras] = useState<Extra[]>(
      () =>
        (initial || prefill)?.additional_diagnoses.map((d) => ({
          ...d,
          order_402_article: d.order_402_article || "",
        })) || [],
    );
  const locked =
    closed ||
    (initial?.status === "COMPLETED" && !amending) ||
    (initial?.status === "DRAFT" && initial.doctor_id !== actorId);
  useUnsaved(dirty);
  const change = (k: string, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    setDirty(true);
  };
  async function save(complete: boolean) {
    await task.run(
      () =>
        examAction({
          ...v,
          session_id: sessionId,
          session_version: sessionVersion,
          exam_id: initial?.id,
          version: initial?.version,
          amendment_reason: reason,
          additional_diagnoses: extras,
          complete,
        }),
      () => {
        setDirty(false);
        setAmending(false);
        setSaved(complete ? "Огляд підтверджено" : "Чернетку збережено");
        router.refresh();
      },
    );
  }
  return (
    <div className="stack">
      {prefill && !initial ? (
        <div className="notice">
          Поля скопійовано з попередньої сесії. Перевірте дані та підтвердьте
          новий огляд.
        </div>
      ) : null}
      <div className="section-heading">
        <div>
          <h2>Ваш огляд</h2>
          <p>
            {initial ? "Версія " + initial.revision : "Новий висновок"} ·{" "}
            {dirty
              ? "Є незбережені зміни"
              : saved || "Дані зберігаються на локальному сервері"}
          </p>
        </div>
        <RefreshButton />
      </div>
      {initial?.status === "COMPLETED" && !closed && !amending ? (
        <div className="notice success">
          Огляд підтверджено.
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAmending(true);
              setDirty(true);
            }}
          >
            <FilePenLine size={15} />
            Створити виправлення
          </Button>
        </div>
      ) : null}
      {initial?.status === "DRAFT" && initial.doctor_id !== actorId ? (
        <div className="notice">
          Цю чернетку веде інший лікар вашої спеціальності.
        </div>
      ) : null}
      {amending ? (
        <Field label="Причина нової версії">
          <Input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      ) : null}
      <fieldset disabled={locked || task.pending} className="stack">
        <div className="two-columns">
          {["complaints", "anamnesis"].map((k) => (
            <section className="card card-content" key={k}>
              <Field label={labels[k]}>
                <Textarea
                  rows={4}
                  value={v[k]}
                  onChange={(e) => change(k, e.target.value)}
                />
              </Field>
            </section>
          ))}
        </div>
        <section className="card card-content">
          <Field label={labels.objective_data}>
            <Textarea
              rows={6}
              value={v.objective_data}
              onChange={(e) => change("objective_data", e.target.value)}
            />
          </Field>
        </section>
        <section className="card">
          <div className="card-header">
            <h3>Діагноз і нормативна підстава</h3>
          </div>
          <div className="card-content stack">
            <IcdPicker
              code={v.icd10_code}
              onChange={(code, version, title) => {
                change("icd10_code", code);
                change("icd10_version", version);
                if (title && !v.diagnosis_text) change("diagnosis_text", title);
              }}
            />
            <Field label="Клінічний діагноз">
              <Textarea
                rows={3}
                value={v.diagnosis_text}
                onChange={(e) => change("diagnosis_text", e.target.value)}
              />
            </Field>
            {!v.icd10_code ? (
              <Field label="Пояснення, якщо код МКХ не застосовано">
                <Input
                  value={v.no_icd_reason}
                  onChange={(e) => change("no_icd_reason", e.target.value)}
                />
              </Field>
            ) : null}
            <div className="field-grid">
              <Field label="Стаття та пункт наказу 402">
                <Input
                  placeholder="Наприклад, 39-б"
                  value={v.order_402_article}
                  onChange={(e) => change("order_402_article", e.target.value)}
                />
              </Field>
              <Field label="Категорія для обліку">
                <Select
                  value={v.fitness_category}
                  onChange={(e) => change("fitness_category", e.target.value)}
                >
                  <option value="">Оберіть за потреби</option>
                  {Object.entries(fitnessNames).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {extras.map((d, i) => (
              <div className="extra-diagnosis" key={i}>
                <div className="field-grid">
                  <Field label={"Додатковий МКХ " + (i + 1)}>
                    <Input
                      value={d.icd10_code}
                      onChange={(e) => {
                        setDirty(true);
                        setExtras((a) =>
                          a.map((x, j) =>
                            i === j
                              ? {
                                  ...x,
                                  icd10_code: e.target.value.toUpperCase(),
                                  icd10_version: "USER-ENTERED",
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </Field>
                  <Field label="Стаття 402">
                    <Input
                      value={d.order_402_article}
                      onChange={(e) => {
                        setDirty(true);
                        setExtras((a) =>
                          a.map((x, j) =>
                            i === j
                              ? { ...x, order_402_article: e.target.value }
                              : x,
                          ),
                        );
                      }}
                    />
                  </Field>
                </div>
                <Field label="Формулювання додаткового діагнозу">
                  <Textarea
                    value={d.diagnosis_text}
                    onChange={(e) => {
                      setDirty(true);
                      setExtras((a) =>
                        a.map((x, j) =>
                          i === j
                            ? { ...x, diagnosis_text: e.target.value }
                            : x,
                        ),
                      );
                    }}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDirty(true);
                    setExtras((a) => a.filter((_, j) => i !== j));
                  }}
                >
                  <Trash2 size={14} />
                  Прибрати діагноз
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                setDirty(true);
                setExtras((a) => [
                  ...a,
                  {
                    icd10_code: "",
                    icd10_version: "USER-ENTERED",
                    diagnosis_text: "",
                    order_402_article: "",
                  },
                ]);
              }}
            >
              <Plus size={15} />
              Супутній діагноз / ускладнення
            </Button>
          </div>
        </section>
        <section className="card card-content stack">
          {["doctor_conclusion", "recommendations"].map((k) => (
            <Field key={k} label={labels[k]}>
              <Textarea
                rows={3}
                value={v[k]}
                onChange={(e) => change(k, e.target.value)}
              />
            </Field>
          ))}
        </section>
      </fieldset>
      <ErrorBox message={task.error} />
      {!locked ? (
        <div className="save-bar">
          <span>{dirty ? "Зміни ще не збережено" : saved}</span>
          <div className="inline">
            <Button
              variant="outline"
              disabled={task.pending}
              onClick={() => save(false)}
            >
              <Save size={16} />
              Зберегти чернетку
            </Button>
            <Button disabled={task.pending} onClick={() => save(true)}>
              <CheckCircle2 size={16} />
              Підтвердити огляд
            </Button>
          </div>
        </div>
      ) : null}
      {initial ? (
        <details className="card card-content">
          <summary>Копіювати збережений огляд у МІС</summary>
          <div className="stack">
            <CopyField
              label="Огляд одним блоком"
              value={
                Object.entries(labels)
                  .map(
                    ([k, l]) =>
                      l +
                      ":\n" +
                      String(
                        (initial as unknown as Record<string, unknown>)[k] ||
                          "—",
                      ),
                  )
                  .join("\n\n") +
                "\n\nМКХ: " +
                (initial.icd10_code || "—") +
                "\nСтаття 402: " +
                (initial.order_402_article || "—")
              }
            />
            {Object.entries(labels).map(([k, l]) => (
              <CopyField
                key={k}
                label={l}
                value={String(
                  (initial as unknown as Record<string, unknown>)[k] || "",
                )}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
