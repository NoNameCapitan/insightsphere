// Template-based outreach. Works without any AI key.
// Each message mentions the business by name and one concrete, detected observation.

import type {
  LangCode,
  LeadSignal,
  OfferType,
  OutreachMessages,
  OutreachTone,
} from "./types";

type ObsKey =
  | "no_website"
  | "site_unreachable"
  | "no_booking"
  | "no_form"
  | "rating"
  | "weak_reputation"
  | "few_reviews"
  | "generic";

function pickObservation(signals: LeadSignal[]): ObsKey {
  const has = (t: string) => signals.some((s) => s.type === t);
  if (has("missing_website")) return "no_website";
  if (has("website_unreachable")) return "site_unreachable";
  if (has("no_online_booking_detected") || has("website_no_booking_detected"))
    return "no_booking";
  if (has("weak_website")) return "no_form";
  if (has("many_reviews")) return "weak_reputation";
  if (has("weak_rating") || has("reputation_gap")) return "rating";
  if (has("low_review_count")) return "few_reviews";
  return "generic";
}

const OBSERVATION: Record<LangCode, Record<ObsKey, string>> = {
  uk: {
    no_website:
      "у профілі не вказано сайт — чи маєте ви окрему сторінку для заявок",
    site_unreachable:
      "автоматична перевірка не змогла відкрити ваш сайт; можливо, потрібна ручна перевірка",
    no_booking:
      "клієнтам буває зручніше записатись онлайн, а не лише телефоном",
    no_form: "на сайті не видно зручної форми для заявки",
    rating: "рейтинг можна підтягнути системною роботою з відгуками",
    weak_reputation: "відгуків багато, але рейтинг нижчий за потенціал ніші",
    few_reviews:
      "відгуків поки небагато, і це впливає на довіру нових клієнтів",
    generic: "ви маєте профіль у Google Maps",
  },
  ru: {
    no_website:
      "в профиле не указан сайт — есть ли у вас отдельная страница для заявок",
    site_unreachable:
      "автоматическая проверка не смогла открыть ваш сайт; возможно, нужна ручная проверка",
    no_booking:
      "клиентам бывает удобнее записаться онлайн, а не только по телефону",
    no_form: "на сайте не видно удобной формы для заявки",
    rating: "рейтинг можно подтянуть системной работой с отзывами",
    weak_reputation: "отзывов много, но рейтинг ниже потенциала ниши",
    few_reviews: "отзывов пока немного, и это влияет на доверие новых клиентов",
    generic: "у вас есть профиль в Google Maps",
  },
  en: {
    no_website:
      "no website is listed on your profile; do you have a separate page for inquiries",
    site_unreachable:
      "an automated check could not load your website; it may need a manual check",
    no_booking: "clients often prefer booking online rather than only by phone",
    no_form: "there's no clear inquiry form on the site",
    rating: "your rating could be improved with a steady review workflow",
    weak_reputation:
      "you have many reviews but the rating is below the niche's potential",
    few_reviews:
      "there aren't many reviews yet, which affects new-customer trust",
    generic: "you have a Google Maps profile",
  },
};

const PITCH: Record<LangCode, Record<OfferType, string>> = {
  uk: {
    website: "простий сайт, що перетворює перегляди в Google Maps на заявки",
    landing: "лендинг, який конвертує відвідувачів у звернення",
    seo: "покращення локальної видимості та оптимізацію Google Business Profile",
    chatbot:
      "AI-асистента, який відповідає на типові питання й збирає заявки 24/7",
    booking: "онлайн-запис, щоб не втрачати клієнтів через пропущені дзвінки",
    crm: "просту CRM, щоб не губити звернення",
    smm: "контент і ведення локальних соцмереж",
    reputation: "систему роботи з відгуками та покращення репутації",
    automation: "автоматизацію рутинних задач",
    custom: "рішення під вашу задачу",
  },
  ru: {
    website: "простой сайт, превращающий просмотры в Google Maps в заявки",
    landing: "лендинг, который конвертирует посетителей в обращения",
    seo: "улучшение локальной видимости и оптимизацию Google Business Profile",
    chatbot:
      "AI-ассистента, который отвечает на типовые вопросы и собирает заявки 24/7",
    booking:
      "онлайн-запись, чтобы не терять клиентов из-за пропущенных звонков",
    crm: "простую CRM, чтобы не терять обращения",
    smm: "контент и ведение локальных соцсетей",
    reputation: "систему работы с отзывами и улучшение репутации",
    automation: "автоматизацию рутинных задач",
    custom: "решение под вашу задачу",
  },
  en: {
    website: "a simple website that turns Google Maps views into inquiries",
    landing: "a landing page that converts visitors into inquiries",
    seo: "better local visibility and Google Business Profile optimization",
    chatbot:
      "an AI assistant that answers common questions and collects requests 24/7",
    booking: "online booking so you stop losing clients to missed calls",
    crm: "a simple CRM so inquiries don't slip through",
    smm: "content and local social media management",
    reputation: "a review workflow and reputation improvement plan",
    automation: "automation of routine tasks",
    custom: "a solution tailored to your needs",
  },
};

const GREETING: Record<LangCode, string> = {
  uk: "Доброго дня",
  ru: "Добрый день",
  en: "Hello",
};

// Tone-flavored call-to-action per language. The observation + pitch stay the
// same; only the framing/CTA shift so messages never feel spammy.
const CTA: Record<LangCode, Record<OutreachTone, string>> = {
  uk: {
    soft: "Якщо актуально — можу показати коротке демо, без зобов'язань.",
    direct: "Можу скинути коротке демо під вашу нішу. Цікаво?",
    professional:
      "Можу підготувати короткий розбір саме для вас — зручно поспілкуватись 10 хвилин?",
  },
  ru: {
    soft: "Если актуально — могу показать короткое демо, без обязательств.",
    direct: "Могу скинуть короткое демо под вашу нишу. Интересно?",
    professional:
      "Могу подготовить короткий разбор именно для вас — удобно созвониться на 10 минут?",
  },
  en: {
    soft: "If it's relevant, I can show a short demo — no obligation.",
    direct: "I can send a short demo for your niche. Interested?",
    professional:
      "I can prepare a short audit specifically for you — would a 10-minute call work?",
  },
};

export function generateOutreach(
  name: string,
  offer: OfferType,
  signals: LeadSignal[],
  lang: LangCode,
  opts: { tone?: OutreachTone } = {},
): OutreachMessages {
  const tone: OutreachTone = opts.tone ?? "professional";
  const obs = OBSERVATION[lang][pickObservation(signals)];
  const pitch = PITCH[lang][offer];
  const greet = GREETING[lang];
  const cta = CTA[lang][tone];

  if (lang === "ru") {
    return {
      shortMessage: `${greet}! Смотрел профиль «${name}» в Google Maps и заметил, что ${obs}. Я делаю ${pitch} для локального бизнеса. ${cta}`,
      instagramMessage: `${greet}! Нашёл вас в Google Maps 🙌 Заметил, что ${obs}. Помогаю с этим — делаю ${pitch}. ${cta}`,
      emailMessage: `${greet}!\n\nМеня заинтересовал профиль «${name}» в Google Maps. Обратил внимание, что ${obs}. Хотел бы уточнить, актуальна ли для вас эта задача.\n\nЯ помогаю локальному бизнесу: делаю ${pitch}. Объём и сроки можно определить после короткого обсуждения.\n\n${cta}\n\nС уважением`,
      callScript: `${greet}! Это [Имя]. Звоню по поводу «${name}» — увидел вас в Google Maps. Заметил, что ${obs}. Я делаю ${pitch} для бизнеса вроде вашего, без сложностей и долгого запуска. Подскажите, кто у вас отвечает за привлечение клиентов?`,
    };
  }

  if (lang === "en") {
    return {
      shortMessage: `${greet}! I came across "${name}" on Google Maps and noticed ${obs}. I build ${pitch} for local businesses. ${cta}`,
      instagramMessage: `${greet}! Found you on Google Maps 🙌 I noticed ${obs}. I help with exactly that — ${pitch}. ${cta}`,
      emailMessage: `${greet},\n\nI was looking at "${name}" on Google Maps and noticed ${obs}. Is this something you are currently looking to improve?\n\nI help local businesses with exactly this: ${pitch}. We can discuss scope and timing if this is relevant.\n\n${cta}\n\nBest regards`,
      callScript: `${greet}, this is [Name]. I'm calling about "${name}" — I found you on Google Maps. I noticed ${obs}. I build ${pitch} for businesses like yours, no heavy setup. Who handles getting new customers for you?`,
    };
  }

  // Ukrainian (default)
  return {
    shortMessage: `${greet}! Дивився профіль «${name}» в Google Maps і звернув увагу, що ${obs}. Я роблю ${pitch} для локальних бізнесів. ${cta}`,
    instagramMessage: `${greet}! Знайшов вас у Google Maps 🙌 Звернув увагу, що ${obs}. Допомагаю саме з цим — роблю ${pitch}. ${cta}`,
    emailMessage: `${greet}!\n\nЗацікавив профіль «${name}» в Google Maps. Звернув увагу, що ${obs}. Хотів би уточнити, чи актуальна для вас ця задача.\n\nЯ допомагаю локальному бізнесу саме з цим: роблю ${pitch}. Обсяг і строки можна визначити після короткого обговорення.\n\n${cta}\n\nЗ повагою`,
    callScript: `${greet}! Це [Ім'я]. Телефоную щодо «${name}» — побачив вас у Google Maps. Звернув увагу, що ${obs}. Я роблю ${pitch} для бізнесів як ваш, без складнощів і довгого запуску. Підкажіть, хто у вас відповідає за залучення клієнтів?`,
  };
}
