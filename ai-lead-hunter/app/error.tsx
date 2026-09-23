"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="container-app py-16">
      <div className="card p-8">
        <h1 className="page-title">Не вдалося відкрити цей розділ</h1>
        <p className="mt-3 text-sm text-slate-500">
          Спробуйте ще раз. Збережені кампанії залишаються у браузері.
        </p>
        <button onClick={reset} className="btn-primary mt-5">
          Спробувати ще раз
        </button>
      </div>
    </div>
  );
}
