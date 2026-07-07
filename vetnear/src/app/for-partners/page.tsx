import type { Metadata } from "next";
import Link from "next/link";
import { SocialImpact } from "@/components/SocialImpact";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Для партнерів — приводимо власників тварин до вас",
  description:
    "Додайте свою ветклініку, зоомагазин, ветаптеку, грумінг чи притулок у VetNear. Базове розміщення безкоштовне. Пілотні тарифи: Verified, Pro, Network.",
  alternates: { canonical: "/for-partners" },
  openGraph: { title: "VetNear для партнерів", url: `${SITE.url}/for-partners`, type: "website" },
};

const PLANS = [
  {
    name: "Free",
    price: "0 ₴/міс",
    current: true,
    features: [
      "Базове розміщення у пошуку поруч",
      "Кнопки дзвінка / сайту / маршруту",
      "Перевірка за публічними джерелами",
      "Кнопка «Повідомити про неточність»",
    ],
  },
  {
    name: "Verified Partner",
    price: "449 ₴/міс",
    features: [
      "Все з Free",
      "Значок «Перевірено»",
      "Розширений профіль + фото",
      "Послуги та ціни",
      "Вища видимість у релевантних пошуках",
      "Базова аналітика",
    ],
  },
  {
    name: "Pro Partner",
    price: "1349 ₴/міс",
    features: [
      "Все з Verified",
      "Пріоритет у категорії/районі",
      "Акції та пропозиції",
      "Збір запитів/лідів",
      "Розширена аналітика",
    ],
  },
  {
    name: "Network / Multi-location",
    price: "від 2699 ₴/міс",
    features: [
      "Кілька філій",
      "Масовий імпорт",
      "Кабінет менеджера",
      "Аналітика по філіях",
    ],
  },
];

const SEGMENTS = [
  ["🩺 Для клінік", "Власники, які шукають ветеринара поруч, бачать ваш профіль, графік і кнопку дзвінка."],
  ["✂️ Для грумінгу", "Запис і дзвінки від клієнтів вашого району, які шукають догляд за твариною."],
  ["🛒 Для зоомагазинів", "Покупці кормів і товарів поруч знаходять вас на карті за один клік."],
  ["💊 Для ветаптек", "Люди, яким терміново потрібні ветпрепарати, бачать найближчу аптеку."],
  ["🐾 Для притулків / волонтерів", "Безкоштовне розміщення для зоозахисних організацій — назавжди в базовому плані."],
];

const BENEFITS = [
  "Видимість на локальній пет-карті",
  "Дзвінки та кліки на маршрут",
  "Перевірений профіль",
  "Підбір за категорією/типом тварини",
  "Аналітика (надалі)",
  "Пілотні ціни для перших партнерів",
];

export default function ForPartnersPage() {
  return (
    <div className="container-px mx-auto max-w-3xl py-8">
      <h1 className="font-display text-3xl font-extrabold text-ink">VetNear для партнерів</h1>
      <p className="mt-2 max-w-xl text-ink/75">
        VetNear приводить до вас власників тварин, які вже шукають клініку, аптеку,
        грумінг, магазин або послугу поруч.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/add-place" className="btn btn-brand">Додайте свій зообізнес безкоштовно</Link>
        <Link href="/partner/dashboard" className="btn btn-ghost">Кабінет партнера (демо)</Link>
      </div>

      <section className="mt-8 grid gap-2 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b} className="rounded-2xl border border-brand-100 bg-surface px-4 py-3 text-sm text-ink/80">
            ✓ {b}
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink">Кому це корисно</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SEGMENTS.map(([title, desc]) => (
            <div key={title} className="card p-4">
              <p className="font-display font-bold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink/65">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-brand-200 bg-brand-50/50 p-5">
        <h2 className="font-display text-xl font-bold text-ink">Чому варто додатися зараз</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink/80 sm:grid-cols-2">
          <li className="rounded-2xl bg-surface/80 px-4 py-3">🚀 Безкоштовний старт у Kyiv pilot</li>
          <li className="rounded-2xl bg-surface/80 px-4 py-3">📞 Клієнти бачать ваш телефон, сайт і маршрут</li>
          <li className="rounded-2xl bg-surface/80 px-4 py-3">🛡️ Профіль проходить модерацію і виглядає надійніше</li>
          <li className="rounded-2xl bg-surface/80 px-4 py-3">🤝 Перші партнери можуть вплинути на формат платних функцій</li>
        </ul>
      </section>

      <section id="pricing" className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink">Тарифи (пілотні ціни)</h2>
        <p className="mt-1 text-sm text-ink/60">
          Оплата зараз не стягується — це структура планів для перших партнерів Києва.
          Платіжна система не підключена (пілотні ціни, а не активний білінг). Базове
          розміщення безкоштовне завжди.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div key={p.name} className={`card p-5 ${p.current ? "ring-2 ring-brand" : ""}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-bold text-ink">{p.name}</h3>
                <span className="text-sm font-semibold text-brand">{p.price}</span>
              </div>
              {p.current && <p className="mt-1 text-xs text-brand">Доступно зараз</p>}
              <ul className="mt-3 space-y-1.5 text-sm text-ink/70">
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink/60">
          Притулки та зоозахисні організації розміщуються безкоштовно і не входять у платні плани.
        </p>
        <p className="mt-3 text-xs text-ink/45">
          У майбутньому (roadmap, не зараз): можлива модель оплати за кваліфіковані ліди —
          лише після підтвердження реального попиту разом із першими партнерами.
        </p>
      </section>

      <SocialImpact className="mt-10 px-0" />

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink">Як проходить перевірка</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink/70">
          <li>Заповніть коротку форму закладу — це кілька хвилин.</li>
          <li>Модератор перевіряє назву, категорію, адресу й контакти; за потреби додає координати.</li>
          <li>Після схвалення профіль зʼявляється у пошуку поруч і на карті.</li>
          <li>
            Статус «Невідкладна / 24⁄7» ми вмикаємо лише після ручного підтвердження
            дзвінком — щоб користувачі могли довіряти цій позначці.
          </li>
        </ol>
      </section>

      <section className="mt-8 rounded-3xl border border-brand-100 bg-surface p-5">
        <h2 className="font-display text-xl font-bold text-ink">Що буде далі</h2>
        <p className="mt-2 text-sm text-ink/70">
          Після схвалення ви зможете повідомляти про зміни графіка чи контактів, а в
          майбутньому — керувати профілем через кабінет партнера. Перші партнери
          пілота впливають на формат платних інструментів.
        </p>
        <Link href="/add-place" className="btn btn-brand mt-4">Подати заявку</Link>
      </section>
    </div>
  );
}
