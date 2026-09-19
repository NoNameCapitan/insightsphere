"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Не вдалося відкрити кабінет</h1>
      <p>
        Перевірте, чи працює локальний сервер і виконано початкове налаштування.
        Збережені записи залишаються в базі.
      </p>
      <Button onClick={reset}>Повторити</Button>
    </main>
  );
}
