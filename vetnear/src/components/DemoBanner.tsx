// Honest "this is a browser-only demo, not production security" banner (P1.11).
export function DemoAdminBanner() {
  return (
    <div className="rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-ink/80">
      <p className="font-semibold text-amber">Адмін-демо · дані лише у браузері</p>
      <p className="mt-1">
        Це не справжня автентифікація. Модерація та права тут не захищені сервером.
        Перед публічною модерацією потрібні Supabase / Auth / RLS (див. SECURITY.md, ROADMAP.md).
      </p>
    </div>
  );
}
