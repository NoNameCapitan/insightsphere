// Responsible, non-manipulative social-impact commitment. Applies to PAID
// partner/subscription/sponsor revenue — NOT automatically to investment capital.
export function SocialImpact({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <section className={`container-px mx-auto max-w-3xl ${className}`}>
      <div className="overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-b from-brand-50/60 to-surface shadow-card">
        <div className={`flex items-start gap-4 ${compact ? "p-4" : "p-5 sm:gap-6"}`}>
          <p
            aria-hidden
            className={`font-display font-extrabold leading-none text-brand ${
              compact ? "text-4xl" : "text-5xl sm:text-6xl"
            }`}
          >
            10%
          </p>
          <div className="min-w-0">
            <h2 className={`font-display font-bold text-ink ${compact ? "text-base" : "text-lg"}`}>
              Соціальний внесок VetNear
            </h2>
            <p className={`mt-1.5 text-ink/75 ${compact ? "text-xs" : "text-sm"}`}>
              10% від платних партнерських підписок, рекламних розміщень та
              спонсорських доходів VetNear буде спрямовано на реабілітацію та
              протезування людей, які постраждали внаслідок російсько-української
              війни.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                Прозорий партнер
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                Квартальний звіт
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                Після запуску платних планів
              </span>
            </div>
          </div>
        </div>
        {!compact && (
          <ul className="space-y-1.5 border-t border-brand-100/70 px-5 py-4 text-xs text-ink/60">
            <li>
              • Для інвестиційних або грантових коштів соціальний внесок визначається
              окремо відповідно до юридичних та фінансових умов.
            </li>
            <li>• Фонд/партнер буде обраний прозоро перед запуском платних планів.</li>
            <li>
              • Щоквартально VetNear публікуватиме короткий звіт: отримано, передано,
              куди спрямовано.
            </li>
          </ul>
        )}
      </div>
    </section>
  );
}
