"use client";
import {
  useState,
  useEffect,
  useId,
  cloneElement,
  isValidElement,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { RefreshCw, Printer, LogOut } from "lucide-react";
import { logoutAction } from "@/actions";
export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div className="notice danger" role="alert">
      {message}
    </div>
  ) : null;
}
export function useTask() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function run<T>(
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    done?: (data: T) => void,
  ) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const r = await fn();
      if (r.ok) done?.(r.data);
      else setError(r.error);
    } catch {
      setError(
        "Немає відповіді локального сервера. Текст залишився на екрані — відновіть зв’язок і повторіть збереження.",
      );
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
export function RefreshButton() {
  const r = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => r.refresh()}
    >
      <RefreshCw size={15} />
      Оновити стан
    </Button>
  );
}
export function PrintButton() {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      <Printer size={16} />
      Друк / зберегти PDF
    </Button>
  );
}
export function LogoutButton() {
  const r = useRouter(),
    t = useTask();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={t.pending}
        onClick={() =>
          t.run(logoutAction, () => {
            r.push("/login");
            r.refresh();
          })
        }
      >
        <LogOut size={15} />
        Вийти
      </Button>
      <ErrorBox message={t.error} />
    </>
  );
}
// Окремий label не включає в доступну назву поточний текст textarea.
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const generated = useId();
  const child = isValidElement<{ id?: string; "aria-describedby"?: string }>(
    children,
  )
    ? children
    : null;
  const id = child?.props.id || generated;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {child
        ? cloneElement(child, {
            id,
            "aria-describedby": hint
              ? id + "-hint"
              : child.props["aria-describedby"],
          })
        : children}
      {hint ? <small id={id + "-hint"}>{hint}</small> : null}
    </div>
  );
}
