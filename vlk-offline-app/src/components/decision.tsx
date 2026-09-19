"use client";
import { requestKey as newRequestKey } from "@/lib/request-key";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decisionAction, cancelAction, correctionAction } from "@/actions";
import { fitnessNames } from "@/lib/domain";
import { Input, Textarea, Select } from "./ui/input";
import { Button } from "./ui/button";
import { Field, ErrorBox, useTask, useUnsaved, RefreshButton } from "./common";
export function Decision({
  id,
  version,
  initial,
  canFinalize,
  complete,
}: {
  id: string;
  version: number;
  initial: {
    final_diagnosis: string;
    final_decision: string;
    order_402_article: string;
    protocol_number: string;
    decision_date: string;
    fitness_category: string;
  };
  canFinalize: boolean;
  complete: boolean;
}) {
  const router = useRouter(),
    task = useTask();
  const [v, setV] = useState(initial),
    [dirty, setDirty] = useState(false);
  useUnsaved(dirty);
  const change = (k: keyof typeof v, value: string) => {
    setDirty(true);
    setV((x) => ({ ...x, [k]: value }));
  };
  function save(finalize: boolean) {
    if (
      finalize &&
      !window.confirm(
        "Підтвердити підсумок і закрити сесію? Подальші виправлення потребуватимуть нового проходження.",
      )
    )
      return;
    task.run(
      () => decisionAction({ ...v, session_id: id, version, finalize }),
      () => {
        setDirty(false);
        router.refresh();
      },
    );
  }
  return (
    <section className="card">
      <div className="card-header section-heading">
        <div>
          <h2>Підсумок комісії</h2>
          <p>Постанова вводиться уповноваженим працівником повним текстом.</p>
        </div>
        <RefreshButton />
      </div>
      <div className="card-content stack">
        {!complete ? (
          <div className="notice">
            Для завершення потрібні всі обов’язкові підтверджені огляди.
          </div>
        ) : null}
        <Field label="Підсумковий діагноз">
          <Textarea
            rows={4}
            value={v.final_diagnosis}
            onChange={(e) => change("final_diagnosis", e.target.value)}
          />
        </Field>
        <Field label="Повний текст постанови">
          <Textarea
            rows={5}
            value={v.final_decision}
            onChange={(e) => change("final_decision", e.target.value)}
          />
        </Field>
        <div className="field-grid">
          <Field label="Статті та пункти наказу 402">
            <Input
              value={v.order_402_article}
              onChange={(e) => change("order_402_article", e.target.value)}
            />
          </Field>
          <Field label="Категорія для обліку">
            <Select
              value={v.fitness_category}
              onChange={(e) => change("fitness_category", e.target.value)}
            >
              <option value="">Оберіть категорію</option>
              {Object.entries(fitnessNames).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Номер протоколу / документа">
            <Input
              value={v.protocol_number}
              onChange={(e) => change("protocol_number", e.target.value)}
            />
          </Field>
          <Field label="Дата рішення">
            <Input
              type="date"
              value={v.decision_date}
              onChange={(e) => change("decision_date", e.target.value)}
            />
          </Field>
        </div>
        <ErrorBox message={task.error} />
        <div className="inline">
          <Button
            variant="outline"
            disabled={task.pending}
            onClick={() => save(false)}
          >
            Зберегти проєкт
          </Button>
          {canFinalize ? (
            <Button
              disabled={task.pending || !complete}
              onClick={() => save(true)}
            >
              Підтвердити та закрити сесію
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
export function CancelSession({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const t = useTask(),
    r = useRouter();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const reason = window.prompt(
            "Причина скасування проходження (запис залишиться в історії):",
          );
          if (reason)
            t.run(
              () => cancelAction({ id, version, reason }),
              () => r.refresh(),
            );
        }}
      >
        Скасувати проходження
      </Button>
      <ErrorBox message={t.error} />
    </>
  );
}

export function CorrectSession({ id }: { id: string }) {
  const t = useTask(),
    r = useRouter();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={t.pending}
        onClick={() => {
          const reason = window.prompt(
            "Причина виправлення: буде створено нову сесію з повторним підтвердженням лікарів.",
          );
          if (reason)
            t.run(
              () =>
                correctionAction({ id, reason, request_key: newRequestKey() }),
              (d) => {
                r.push("/sessions/" + d.id);
                r.refresh();
              },
            );
        }}
      >
        Створити виправлення
      </Button>
      <ErrorBox message={t.error} />
    </>
  );
}
