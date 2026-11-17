import Link from "next/link";
import { CinematicCompanions } from "@/components/CinematicCompanions";
import { ServiceIcon } from "@/components/icons/ServiceIcons";
import { ALL_ANIMALS, ANIMAL_LABELS } from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { localityOf } from "@/config/coverage";
import { SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";
import type { PlaceCategory } from "@/lib/types";
import styles from "./HomeHero.module.css";

const SERVICES: { category: PlaceCategory; label: string; description: string }[] = [
  { category: "veterinary_clinic", label: "Ветеринар", description: "Огляд і лікування" },
  { category: "vet_pharmacy", label: "Ветаптека", description: "Ліки та препарати" },
  { category: "pet_store", label: "Зоомагазин", description: "Корм і товари" },
  { category: "grooming", label: "Грумінг", description: "Догляд за улюбленцем" },
  { category: "pet_boarding", label: "Перетримка", description: "Турбота на час поїздки" },
];

const LOCALITIES = Array.from(new Set(PLACES.filter((place) => place.status === "approved").map(localityOf).filter(Boolean)))
  .sort((a, b) => a === "Київ" ? -1 : b === "Київ" ? 1 : a.localeCompare(b, "uk"));

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg aria-hidden className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={diagonal ? "M5 15 15 5M5 5h10v10" : "M3 10h14m-5-5 5 5-5 5"} /></svg>;
}

/** The search is a server-rendered GET form: the cinematic layer never gates it. */
export function HomeHero() {
  return (
    <section className={styles.hero} aria-labelledby="home-title" data-no-reveal>
      <div className={styles.stage} data-cinematic-stage>
        <div className={styles.intro}>
          <div className={styles.copy}>
            <p className={styles.context}>Ветеринарна допомога та догляд поруч</p>
            {/* Each line rises out of its own mask; the text itself is plain and static for assistive tech. */}
            <h1 id="home-title">
              <span className={styles.line}><span>Турбота про тих,</span></span>
              <span className={styles.line}><span>хто робить дім <em className={styles.gold}>домом.</em></span></span>
            </h1>
            <p className={styles.description}>Ветеринари, грумінг і ветаптеки у Києві та області. Знайдіть потрібне місце й зв’яжіться напряму.</p>
            <Link className={styles.coverage} href="/nearby?location=manual"><svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>Київ та Київська область <Arrow diagonal /></Link>
          </div>
          <CinematicCompanions />
        </div>
        <div className={styles.searchArea}>
          <form action="/nearby" method="get" className={styles.search} aria-label="Пошук допомоги для тварини">
            <div className={`${styles.field} ${styles.locationField}`}>
              <label htmlFor="home-locality">Де шукаємо?</label>
              <select name="locality" id="home-locality" defaultValue="">
                <option value="">Київ та область</option>
                {LOCALITIES.map((locality) => <option key={locality} value={locality}>{locality}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="home-animal">Для кого шукаємо?</label>
              <select name="animal" id="home-animal" defaultValue="all">
                <option value="all">Усі тварини</option>
                {ALL_ANIMALS.map((animal) => <option key={animal} value={animal}>{ANIMAL_LABELS[animal]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="home-service">Що потрібно?</label>
              <select name="category" id="home-service" defaultValue="veterinary_clinic">
                {SERVICES.map((service) => <option key={service.category} value={service.category}>{service.label}</option>)}
                <option value="all">Усі послуги</option>
              </select>
            </div>
            <button className={styles.searchButton} type="submit">Знайти поруч<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg></button>
          </form>
          <div className={styles.searchNotes}>
            <p>Без реєстрації. Зв’язок напряму із закладом.</p>
            <Link className={styles.urgentShortcut} href={SAFE_EMERGENCY_CTA_HREF}><span aria-hidden className={styles.urgentMark}>+</span>Тварині зле? Знайти клініку <Arrow diagonal /></Link>
          </div>
        </div>
      </div>
      <nav className={styles.services} aria-label="Послуги для тварин">
        {SERVICES.map((service) => <Link key={service.category} href={`/nearby?category=${service.category}`}><span className={styles.serviceIcon} aria-hidden><ServiceIcon category={service.category} /></span><span><strong>{service.label}</strong><small>{service.description}</small></span><span className={styles.serviceArrow}><Arrow diagonal /></span></Link>)}
      </nav>
      <nav className={styles.returnLinks} aria-label="Швидкий доступ">
        <Link href="/saved"><svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 5a5 5 0 0 0-7 0l-1 1-1-1a5 5 0 0 0-7 7l8 8 8-8a5 5 0 0 0 0-7Z" /></svg>Збережені місця <Arrow /></Link>
        <Link href="#district-explorer">Дослідити райони Києва <Arrow diagonal /></Link>
      </nav>
    </section>
  );
}
