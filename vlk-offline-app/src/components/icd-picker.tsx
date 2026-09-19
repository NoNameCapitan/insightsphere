"use client";
import { useState, useRef } from "react";
import { icdSearchAction } from "@/actions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useTask, ErrorBox } from "./common";
export function IcdPicker({
  code,
  onChange,
}: {
  code: string;
  onChange: (code: string, version: string, title?: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<
      { code: string; catalog_version: string; title_uk: string }[]
    >([]),
    t = useTask();
  return (
    <div className="icd-picker">
      <p className="muted">
        Вбудовано допоміжний довідник eHealth 2019. Звіряйте код з актуальним
        довідником вашої МІС; адміністратор може імпортувати нову версію.
      </p>
      <div className="inline">
        <Input
          aria-label="Пошук МКХ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Код або назва захворювання"
        />
        <Button
          type="button"
          variant="outline"
          disabled={t.pending || !query}
          onClick={() => t.run(() => icdSearchAction(query), setRows)}
        >
          Знайти МКХ
        </Button>
      </div>
      <ErrorBox message={t.error} />
      {rows.length ? (
        <div className="icd-results">
          {rows.map((r) => (
            <button
              type="button"
              key={r.catalog_version + r.code}
              onClick={() => {
                onChange(r.code, r.catalog_version, r.title_uk);
                setRows([]);
              }}
            >
              <strong>{r.code}</strong> {r.title_uk}
              <small>
                {r.catalog_version === "USER-ENTERED"
                  ? "Внесено лікарем"
                  : r.catalog_version}
              </small>
            </button>
          ))}
        </div>
      ) : null}
      <label className="field">
        <span>Код МКХ</span>
        <Input
          aria-label="Код МКХ"
          value={code}
          onChange={(e) =>
            onChange(e.target.value.toUpperCase(), "USER-ENTERED")
          }
          placeholder="Наприклад, I10"
          maxLength={15}
        />
        <small>
          Можна ввести код із медичного документа. Ручне введення не означає
          перевірку за класифікатором.
        </small>
      </label>
    </div>
  );
}
