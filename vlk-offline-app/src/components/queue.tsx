"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, ClipboardList } from "lucide-react";
import { queueAction } from "@/actions";
import { statusNames, displayDate } from "@/lib/domain";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useTask, ErrorBox } from "./common";
type Row = {
  id: string;
  ticket: string;
  name: string;
  birth: string;
  status: string;
  completed: number;
  total: number;
  transfer: string | null;
};
export function Queue({
  initial,
  date: initialDate,
}: {
  initial: Row[];
  date: string;
}) {
  const [rows, setRows] = useState(initial),
    [date, setDate] = useState(initialDate),
    [query, setQuery] = useState(""),
    t = useTask();
  return (
    <section className="card">
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          t.run(() => queueAction({ date, query }), setRows);
        }}
      >
        <div className="search-wrap">
          <Search size={18} />
          <Input
            aria-label="Пошук у черзі"
            placeholder="Прізвище, РНОКПП або номер талона"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Input
          aria-label="Дата черги"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button variant="outline" disabled={t.pending}>
          Знайти
        </Button>
      </form>
      <ErrorBox message={t.error} />
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Пацієнт / талон</th>
                <th>Народження</th>
                <th>Огляди</th>
                <th>Стан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link className="table-title" href={"/sessions/" + r.id}>
                      {r.name}
                    </Link>
                    <small className="mono">{r.ticket}</small>
                  </td>
                  <td>{displayDate(r.birth)}</td>
                  <td>
                    <div className="progress">
                      <span
                        style={{ width: (r.completed / r.total) * 100 + "%" }}
                      />
                    </div>
                    <small>
                      {r.completed} з {r.total}
                    </small>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " + (r.status === "FINALIZED" ? "success" : "")
                      }
                    >
                      {statusNames[r.status]}
                    </span>
                    {r.transfer ? (
                      <small>{statusNames[r.transfer]}</small>
                    ) : null}
                  </td>
                  <td>
                    <Link
                      className="icon-link"
                      aria-label={"Відкрити " + r.name}
                      href={"/sessions/" + r.id}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <ClipboardList size={30} />
          <h3>Черга порожня</h3>
          <p>На обрану дату ще немає записів за вашими умовами пошуку.</p>
        </div>
      )}
      <div className="card-footer">
        Показано {rows.length} записів · до 300 за запитом
      </div>
    </section>
  );
}
