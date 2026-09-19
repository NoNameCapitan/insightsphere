"use client";
import { requestKey as newRequestKey } from "@/lib/request-key";
import { useState } from "react";
import { CheckCheck, Save } from "lucide-react";
import { transferAction } from "@/actions";
import { type CopyField as FieldType } from "@/lib/domain";
import { CopyField } from "./copy-field";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import { Field, ErrorBox, useTask, useUnsaved } from "./common";
export function Transfer({
  documentId,
  fields,
  initialKeys,
  initialNotes,
  confirmed,
}: {
  documentId: string;
  fields: FieldType[];
  initialKeys: string[];
  initialNotes: string;
  confirmed: boolean;
}) {
  const [checked, setChecked] = useState(new Set(initialKeys)),
    [notes, setNotes] = useState(initialNotes),
    [dirty, setDirty] = useState(false),
    [saved, setSaved] = useState(confirmed ? "Перенесення підтверджено" : ""),
    [requestKey, setRequestKey] = useState(() => newRequestKey()),
    t = useTask();
  useUnsaved(dirty);
  const groups = [...new Set(fields.map((f) => f.group))];
  const change = () => {
    setDirty(true);
    setRequestKey(newRequestKey());
    setSaved("");
  };
  function save(confirmed: boolean) {
    t.run(
      () =>
        transferAction({
          document_id: documentId,
          keys: fields.filter((f) => checked.has(f.key)).map((f) => f.key),
          confirmed,
          notes,
          request_key: requestKey,
        }),
      () => {
        setDirty(false);
        setSaved(
          confirmed
            ? "Перенесення підтверджено оператором"
            : "Прогрес збережено",
        );
        setRequestKey(newRequestKey());
      },
    );
  }
  return (
    <div className="transfer-layout">
      <div className="stack">
        {groups.map((g) => (
          <section key={g} className="card">
            <div className="card-header">
              <h2>{g}</h2>
            </div>
            <div className="card-content stack">
              <CopyField
                label={g + " — одним блоком"}
                value={fields
                  .filter((f) => f.group === g)
                  .map((f) => f.label + ":\n" + f.value)
                  .join("\n\n")}
              />
              {fields
                .filter((f) => f.group === g)
                .map((f) => (
                  <div className="transfer-row" key={f.key}>
                    <CopyField label={f.label} value={f.value} />
                    <label className="transferred">
                      <input
                        type="checkbox"
                        checked={checked.has(f.key)}
                        onChange={(e) => {
                          change();
                          setChecked((s) => {
                            const n = new Set(s);
                            e.target.checked ? n.add(f.key) : n.delete(f.key);
                            return n;
                          });
                        }}
                      />
                      Внесено й звірено в Helsi
                    </label>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
      <aside className="card transfer-summary">
        <div className="card-content stack">
          <span className="eyebrow">РУЧНЕ ПЕРЕНЕСЕННЯ</span>
          <h2>
            {checked.size} / {fields.length}
          </h2>
          <div className="progress">
            <span
              style={{ width: (checked.size / fields.length) * 100 + "%" }}
            />
          </div>
          <p>
            Скопіюйте поле, вставте в Helsi та позначте після звірки. Копіювання
            не підтверджує збереження в МІС.
          </p>
          <Field label="Примітка оператора">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                change();
                setNotes(e.target.value);
              }}
            />
          </Field>
          <ErrorBox message={t.error} />
          {saved ? (
            <div role="status" className="notice success">
              {saved}
            </div>
          ) : null}
          <Button
            variant="outline"
            disabled={t.pending}
            onClick={() => save(false)}
          >
            <Save size={16} />
            Зберегти прогрес
          </Button>
          <Button
            disabled={t.pending || checked.size !== fields.length}
            onClick={() => save(true)}
          >
            <CheckCheck size={16} />
            Підтвердити перенесення
          </Button>
        </div>
      </aside>
    </div>
  );
}
