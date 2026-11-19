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
        <p>Власники тварин у Києві та області шукають не просто адресу, а місце, якому можна довіряти. Безкоштовний профіль показує ваші послуги, адресу й прямий контакт — і проходить перевірку перед публікацією.</p>
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
    {/* An invitation, not a price list: what VetNear is, what your place gets, one next step. */}
    <section className={styles.section} id="pricing" aria-labelledby="partners-offer-title">
      <div className={styles.invite}>
        <h2 id="partners-offer-title">Ми збираємо мапу турботи Києва — разом із тими, хто її робить.</h2>
        <div className={styles.inviteBody}>
          <p>Коли тварині зле або просто час на огляд, людина відкриває VetNear, щоб зрозуміти, куди звернутися. Ваш заклад там — з адресою, графіком, послугами, видами тварин і прямим контактом.</p>
          <p className={styles.inviteFree}><strong>Безкоштовно.</strong> Після перевірки, з уточненнями через модерацію.</p>
          <div className={styles.inviteActions}>
            <Link href="/add-place" className="btn btn-brand">Підготувати профіль</Link>
            <Link href="/partner-interest?founding=1" className={styles.pilotLink}>Пілот для перших партнерів <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 19 19 5M5 5h14v14" /></svg></Link>
          </div>
          <p className={styles.terms}>Пілот — розмова про зручне оновлення даних, показ послуг і облік звернень. Платні послуги, ціни й умови погоджуються окремо. Онлайн-оплата та підписки поки не підключені; заявка не створює зобов’язання купувати.</p>
        </div>
      </div>
    </section>
    {/* Three steps you can scan in seconds; the two trust rules close the page as a quiet footnote. */}
    <section className={`${styles.section} ${styles.process}`} aria-labelledby="partners-steps-title">
      <h2 id="partners-steps-title">Як ви з’являєтеся у VetNear</h2>
      <ol className={styles.steps}>
        <li><h3>Знайдіть або додайте заклад</h3><p>Назва, адреса й контакт. Деталі — пізніше.</p></li>
        <li><h3>Підтвердьте представника</h3><p>Звіряємо з офіційним каналом закладу.</p></li>
        <li><h3>Оновлюйте інформацію</h3><p>Зміни графіка й послуг проходять модерацію.</p></li>
      </ol>
      <div className={styles.principles}>
        <p><span className={styles.principleIcon} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg></span><span><strong>Довіра не продається.</strong> Оплата не підтверджує кваліфікацію, прийом зараз чи роботу 24/7 і не впливає на термінову видачу.</span></p>
        <p><span className={styles.principleIcon} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></svg></span><span><strong>Звернення називаємо точно.</strong> Клік телефону — це контактна дія, а не дзвінок чи новий клієнт. Обсяг звернень не гарантується.</span></p>
      </div>
    </section>
  </div>;
}
