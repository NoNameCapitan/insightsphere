// Short, sincere founder note. Kept understated on purpose.
export function FounderNote({ className = "" }: { className?: string }) {
  return (
    <section className={`container-px mx-auto max-w-3xl ${className}`}>
      <div className="rounded-3xl border border-brand-100 bg-surface p-5">
        <p className="text-sm leading-relaxed text-ink/75">
          <span className="font-semibold text-ink">Чому VetNear. </span>
          VetNear створюється як сервіс, яким засновник сам хоче користуватися для свого
          улюбленця: швидко знайти допомогу, не губитися в хаосі Google Maps, бачити
          перевірені контакти і розуміти, кому дзвонити.
        </p>
      </div>
    </section>
  );
}
