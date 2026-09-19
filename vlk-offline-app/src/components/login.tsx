"use client";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useTask, ErrorBox, Field } from "./common";
export function Login() {
  const router = useRouter(),
    t = useTask();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        t.run(
          () => loginAction(Object.fromEntries(f)),
          () => {
            router.push("/");
            router.refresh();
          },
        );
      }}
    >
      <Field label="Логін">
        <Input name="username" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Пароль">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <ErrorBox message={t.error} />
      <Button disabled={t.pending}>
        {t.pending ? "Вхід…" : "Увійти до робочого кабінету"}
      </Button>
    </form>
  );
}
