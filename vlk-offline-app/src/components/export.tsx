"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { today } from "@/lib/domain";
import { Input, Select } from "./ui/input";
import { Button } from "./ui/button";
import { Field, ErrorBox } from "./common";
export function Export() {
  const [date, setDate] = useState(today()),
    [scope, setScope] = useState("all"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function download(format: string) {
    setBusy(format);
    setError("");
    try {
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, format, scope }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Помилка експорту");
      }
      const blob = await r.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "VLK-" + date + "." + format;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Немає зв’язку з сервером");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="card card-content stack">
      <div className="field-grid">
        <Field label="Дата проходжень">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Які записи включити">
          <Select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">Усі, крім скасованих</option>
            <option value="finalized">Тільки завершені</option>
          </Select>
        </Field>
      </div>
      <div className="inline">
        {["json", "xlsx", "csv"].map((f) => (
          <Button
            key={f}
            variant={f === "xlsx" ? "default" : "outline"}
            disabled={!!busy}
            onClick={() => download(f)}
          >
            <Download size={16} />
            {busy === f ? "Формування…" : f.toUpperCase()}
          </Button>
        ))}
      </div>
      <p className="muted">
        XLSX зберігає РНОКПП як текст. JSON містить повну структуру. Файл для
        ручної роботи не є форматом автоматичного імпорту Helsi.
      </p>
      <ErrorBox message={error} />
    </section>
  );
}
