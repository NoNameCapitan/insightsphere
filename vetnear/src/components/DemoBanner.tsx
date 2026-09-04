// Honest "this is a browser-only demo, not production security" banner (P1.11).
// Presented as a calm amber info chip (always visible) with the full
// explanation in a native <details> disclosure — informative, not alarming.
export function DemoAdminBanner() {
  return (
    <details className="group w-fit max-w-full">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-semibold text-amber transition hover:border-amber/50 hover:bg-amber/15 [&::-webkit-details-marker]:hidden">
        <span aria-hidden>ⓘ</span>
        Адмін-демо · дані лише у браузері
        <span aria-hidden className="text-amber/70 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-2 max-w-md rounded-2xl border border-amber/25 bg-surface px-4 py-3 text-xs leading-relaxed text-ink/70 shadow-card">
        Це не справжня автентифікація. Модерація та права тут не захищені сервером.
        Перед публічною модерацією потрібні Supabase / Auth / RLS (див. SECURITY.md,
        ROADMAP.md).
      </div>
    </details>
  );
}
