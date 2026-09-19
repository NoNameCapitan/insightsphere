"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userAction } from "@/actions";
import { roleNames, specialties, type Role } from "@/lib/domain";
import { Input, Select } from "./ui/input";
import { Button } from "./ui/button";
import { Field, ErrorBox, useTask } from "./common";
type User = {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  specialty: string | null;
  is_active: boolean;
  extra_roles: { role: Role }[];
};
export function Users({ users }: { users: User[] }) {
  const t = useTask(),
    r = useRouter(),
    [selected, setSelected] = useState<User | null>(null),
    [formKey, setFormKey] = useState(0);
  return (
    <div className="two-columns">
      <section className="card card-content">
        <h2>Працівники</h2>
        <div className="stack">
          {users.map((u) => (
            <button
              className="search-result"
              key={u.id}
              onClick={() => {
                setSelected(u);
                setFormKey((k) => k + 1);
              }}
            >
              <strong>{u.full_name}</strong>
              <small>
                {u.username} ·{" "}
                {[u.role, ...u.extra_roles.map((x) => x.role)]
                  .map((x) => roleNames[x])
                  .join(", ")}
                {!u.is_active ? " · Вимкнено" : ""}
              </small>
            </button>
          ))}
        </div>
      </section>
      <form
        key={formKey}
        className="card card-content stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          t.run(
            () =>
              userAction({
                id: selected?.id,
                username: f.get("username"),
                full_name: f.get("full_name"),
                password: f.get("password"),
                roles: f.getAll("roles"),
                specialty: f.get("specialty"),
                is_active: f.get("is_active") === "on",
              }),
            () => {
              setSelected(null);
              setFormKey((k) => k + 1);
              r.refresh();
            },
          );
        }}
      >
        <div className="section-heading">
          <h2>{selected ? "Редагувати доступ" : "Новий працівник"}</h2>
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(null);
                setFormKey((k) => k + 1);
              }}
            >
              Новий
            </Button>
          ) : null}
        </div>
        <Field label="ПІБ працівника">
          <Input name="full_name" required defaultValue={selected?.full_name} />
        </Field>
        <Field label="Логін">
          <Input
            name="username"
            required
            pattern="[a-z0-9._-]{3,50}"
            autoComplete="off"
            defaultValue={selected?.username}
          />
        </Field>
        <Field
          label={
            selected
              ? "Новий пароль (порожньо — залишити)"
              : "Пароль: щонайменше 12 символів"
          }
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required={!selected}
            minLength={12}
          />
        </Field>
        <fieldset className="stack">
          <legend>Ролі доступу</legend>
          {Object.entries(roleNames).map(([key, label]) => (
            <label key={key} className="check-line">
              <input
                name="roles"
                type="checkbox"
                value={key}
                defaultChecked={
                  selected
                    ? selected.role === key ||
                      selected.extra_roles.some((r) => r.role === key)
                    : key === "REGISTRAR"
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Field label="Спеціальність лікаря">
          <Select name="specialty" defaultValue={selected?.specialty || ""}>
            <option value="">Не лікар</option>
            {Object.entries(specialties).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="check-line">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={selected?.is_active ?? true}
          />
          Доступ активний
        </label>
        <p className="muted">
          Зміна доступу відкликає активні сеанси працівника. Клінічні записи
          залишаються.
        </p>
        <ErrorBox message={t.error} />
        <Button disabled={t.pending}>Зберегти працівника</Button>
      </form>
    </div>
  );
}
