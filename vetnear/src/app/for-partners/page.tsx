import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/seo";
import { getPublicPlaces } from "@/lib/server/placesFeed";
import { PartnerPlaceFinder } from "@/components/PartnerPlaceFinder";
import { ServiceIcon } from "@/components/icons/ServiceIcons";
import { CATEGORY_LABELS } from "@/lib/labels";
import styles from "./partners.module.css";

export const metadata: Metadata = {
  title: "VetNear для партнерів — ваш заклад поруч",
  description: "Безкоштовний профіль клініки, грумінгу чи іншої послуги для тварин у Києві та області. Уточніть свою картку або долучіться до партнерського пілоту.",
  alternates: { canonical: "/for-partners" },
  openGraph: { title: "VetNear для партнерів", url: `${SITE.url}/for-partners`, type: "website" },
};

export default async function ForPartnersPage() {
  const { places } = await getPublicPlaces();
  const publicPlaces = places.filter(place => place.status === "approved");
  const example = publicPlaces.find(place => place.slug === "genesis-hospital-kyiv") ?? publicPlaces[0];
  return <div className={styles.page}>
    <section className={styles.intro}>
      <div className={styles.introCopy}>
        <h1>Ваша турбота.<br /><span>Ближче до своїх.</span></h1>
        <p>Допоможіть власникам тварин знайти ваш заклад у Києві та області. Послуги, адреса й прямий контакт — у безкоштовному профілі VetNear.</p>
        <div className={styles.actions}><a href="#find-your-place" className="btn btn-brand">Знайти свій заклад</a><Link href="/add-place" className="btn btn-ghost">Додати новий</Link></div>
        <p className={styles.heroNote}>Базове розміщення без оплати · Публікація після перевірки</p>
      </div>
      {/* "How clients see you": the real catalogue card, framed the way an owner sees it on a phone.
          Everything shown comes from the example place; the call/route buttons are an illustration. */}
      <aside className={styles.preview} aria-label="Приклад наявного профілю">
        <p className={styles.previewLabel}>Так вас бачать власники тварин</p>
        <div className={styles.phone}>
          <div className={styles.phoneBar} aria-hidden><span /></div>
          {example && <div className={styles.mockCard}>
            <div className={styles.mockHead}>
              <span className={styles.mockIcon} aria-hidden><ServiceIcon category={example.category} /></span>
              <div className={styles.mockTitle}>
                <h2>{example.name}</h2>
                <p>{CATEGORY_LABELS[example.category]} · {example.locality ?? "Київ"}</p>
              </div>
            </div>
            <p className={styles.previewAddress}>{example.address}</p>
            <div className={styles.serviceList}>{example.services.slice(0, 3).map(service => <span key={service}>{service}</span>)}</div>
            <div className={styles.previewContact}><span>Контакт закладу</span><strong>{example.phone}</strong></div>
            <div className={styles.mockActions} aria-hidden><span className={styles.mockCall}>Зателефонувати</span><span className={styles.mockRoute}>Маршрут</span></div>
          </div>}
        </div>
        {example && <Link href={`/place/${example.slug}`} className={styles.previewLink}>Переглянути реальну картку <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 19 19 5M5 5h14v14" /></svg></Link>}
        <p className={styles.previewFootnote}>Приклад із відкритого каталогу. Не означає участі закладу в партнерській програмі.</p>
      </aside>
    </section>
    <PartnerPlaceFinder places={publicPlaces.map(({ id, slug, name, address, phone, locality, category }) => ({ id, slug, name, address, phone, locality, category }))} />
    <section className={styles.section} id="pricing">
      <div className={styles.sectionHeading}><h2>Почнімо з того,<br />що потрібно людям.</h2><p>Точна картка допомагає зрозуміти ваші послуги до першого дзвінка. Базова інформація залишається безкоштовною.</p></div>
      <div className={styles.plans}>
      <div className={styles.offer}>
        <div><p className={styles.eyebrow}>Основа для кожного закладу</p><h3>Ваш профіль</h3><p className={styles.price}>Безкоштовно</p><p className={styles.note}>Для клінік, аптек, грумерів, перетримок і притулків.</p></div>
        <ul><li>Адреса, офіційний контакт і графік</li><li>Послуги, види тварин та умови прийому</li><li>Уточнення даних через модерацію</li><li>Прямий перехід до вашого каналу зв’язку</li></ul>
        <Link href="/add-place" className="btn btn-brand">Підготувати профіль</Link>
      </div>
      <div className={styles.pilot}><div><p className={styles.eyebrow}>Разом із командою VetNear</p><h3>Пілот для перших партнерів</h3><p>Обговоримо, як вам зручніше оновлювати інформацію, показувати послуги й оцінювати звернення. Окремо можна запропонувати допомогу з оформленням профілю або даними кількох філій.</p></div><div className={styles.pilotFoot}><p className={styles.terms}>Платні послуги, ціни й умови погоджуються окремо. Онлайн-оплата та підписки поки не підключені; заявка не створює зобов’язання купувати.</p><Link href="/partner-interest?founding=1" className="btn btn-ghost">Обговорити пілот</Link></div></div>
      </div>
    </section>
    <section className={`${styles.section} ${styles.process}`}>
      <h2>Зрозумілий шлях до профілю</h2>
      <ol className={styles.steps}><li><h3>Знайдіть або додайте заклад</h3><p>Почніть із назви, адреси й контакту. Деталі можна підготувати окремо.</p></li><li><h3>Підтвердьте представника</h3><p>Команда звіряє заявку з офіційним каналом закладу. Самої позначки у формі недостатньо.</p></li><li><h3>Уточнюйте інформацію</h3><p>Передавайте зміни графіка, послуг і умов. Публічні оновлення проходять модерацію.</p></li></ol>
      <div className={styles.principles}><div><span className={styles.principleIcon} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg></span><h3>Довіра не продається</h3><p>Оплата не підтверджує медичну кваліфікацію, прийом зараз або роботу 24/7. Термінова видача не залежить від рекламного плану.</p></div><div><span className={styles.principleIcon} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></svg></span><h3>Звернення називаємо точно</h3><p>Клік телефону — це контактна дія, а не завершений дзвінок чи новий клієнт. Обсяг звернень не гарантується.</p></div></div>
    </section>
  </div>;
}
