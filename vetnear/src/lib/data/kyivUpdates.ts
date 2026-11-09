export type KyivUpdateStatus = "confirmed" | "source_checked" | "needs_phone_check" | "coming_soon";
export type KyivInfoKind = "event" | "vaccination" | "safety" | "campaign" | "service";

export interface KyivUpdateSource { label: string; url: string; }
export interface KyivOperationalUpdate {
  id: string; date: string; status: KyivUpdateStatus; title: string; area: string;
  summary: string; whyItMatters: string; action: string; sources: KyivUpdateSource[];
}
export interface KyivInfoItem {
  id: string; kind: KyivInfoKind; dateLabel: string; title: string; summary: string;
  href: string; linkLabel: string; activeUntil?: string;
}

export const KYIV_UPDATES_AS_OF = "2026-11-09";

/** Current operational changes. Finished one-off September events were removed. */
export const KYIV_OPERATIONAL_UPDATES: KyivOperationalUpdate[] = [
  {
    id: "alert-load-november", date: "2026-11-09", status: "confirmed",
    title: "49 тривог за неповний тиждень: маршрут до укриття став основним safety-сценарієм",
    area: "Київ; особливо Солом’янський, Деснянський та Оболонський райони",
    summary: "Від 2 листопада після 14:00 до 9 листопада 01:54 офіційна історія зафіксувала 49 інтервалів тривоги загальною тривалістю близько 46 годин. 7 листопада пошкодження цивільної інфраструктури зафіксували у трьох районах.",
    whyItMatters: "Користувачу потрібен свіжий статус, найближче офіційне укриття і можливість одним натисканням продовжити свій маршрут.",
    action: "Кнопка «Укриття» працює лише за свіжої підтвердженої тривоги; при помилці показується причина, ручне оновлення і офіційна карта.",
    sources: [
      { label: "Київ Цифровий — історія тривог", url: "https://kyiv.digital/storage/air-alert/stats.html" },
      { label: "Поліція Києва — наслідки 7 листопада", url: "https://kyiv.npu.gov.ua/news/u-kyievi-vnaslidok-vorozhoi-ataky-postrazhdalo-piatero-liudei-politsiia-fiksuie-naslidky-rosiiskoho-udaru" },
    ],
  },
  {
    id: "a-vet-source-check", date: "2026-11-06", status: "source_checked",
    title: "А-Вет уточнила повноцінний нічний формат на Оболоні",
    area: "Оболонський район, просп. Володимира Івасюка, 8, корп. 8",
    summary: "Офіційний сайт заявляє лікаря й асистента вночі, невідкладний прийом 24/7, автономне живлення, операційну, лабораторію, рентген, УЗД і стаціонар на 16 боксів, із яких шість кисневі. Амбулаторія на Івасюка, 4 працює 09:00–21:00.",
    whyItMatters: "Це корисна резервна точка півночі Києва, але стаціонарну адресу не можна змішувати з амбулаторною.",
    action: "Картки клініки й ветаптеки оновлено; перед нічним виїздом та під час тривоги VetNear радить телефонувати.",
    sources: [
      { label: "Офіційний сайт А-Вет", url: "https://avet.kiev.ua/" },
      { label: "Контакти та розподіл відділень", url: "https://avet.kiev.ua/kontakti/" },
    ],
  },
  {
    id: "mini-pig-vaccination", date: "2026-11-06", status: "confirmed",
    title: "Міська ветслужба вакцинувала свиней і мініпігів",
    area: "Дніпровський район, зокрема тварини Piggy Cafe",
    summary: "5 листопада фахівці ОВМ провели профілактичну вакцинацію проти класичної чуми свиней. Це завершений захід, а не постійний пункт вакцинації.",
    whyItMatters: "Мініпіги та інші нетипові тварини потребують окремої спеціалізації в каталозі.",
    action: "Додано інформаційний сигнал «мініпіги / екзотичні тварини»; кафе не публікується як ветзаклад.",
    sources: [{ label: "ОВМ — офіційне повідомлення", url: "https://ovm.gov.ua/index.php/1483-profilaktychna-vaktsynatsiia-svynei-u-kyievi" }],
  },
  {
    id: "city-lost-found", date: "2026-11-05", status: "confirmed",
    title: "Міський реєстр загублених і знайдених тварин отримує нові записи",
    area: "Київ, зокрема Виноградар",
    summary: "На початку листопада в офіційному реєстрі з’явилися свіжі оголошення про загублених і знайдених тварин.",
    whyItMatters: "VetNear не повинен створювати ізольований дубль міської бази або копіювати персональні контакти без згоди.",
    action: "Сторінка VetNear тепер веде до офіційних списків і окремо пропонує знайти клініку для перевірки чипа.",
    sources: [
      { label: "Загублені тварини", url: "https://pets.kyivcity.gov.ua/lost-animals" },
      { label: "Знайдені тварини", url: "https://pets.kyivcity.gov.ua/lost-animals/found" },
    ],
  },
  {
    id: "municipal-clinics-alert-policy", date: "2026-09-17", status: "confirmed",
    title: "Комунальні ветклініки залежать від рівня повітряної загрози",
    area: "Героїв Енергетиків, 5-А; Ярославська, 13-А; Вірменська, 29",
    summary: "За жовтого рівня клініки продовжують роботу з рекомендацією перейти в укриття. За червоного рівня три комунальні клініки припиняють прийом і зачиняються.",
    whyItMatters: "Статичний статус «відкрито» не гарантує доступність маршруту під час тривоги.",
    action: "VetNear позначає жовтий режим як call-first, а за підтвердженого червоного рівня блокує маршрут до цих клінік.",
    sources: [{ label: "КМДА — офіційні правила", url: "https://kyivcity.gov.ua/news/komunalni_veterinarni_kliniki_kiyeva_zminili_rezhim_roboti_pid_chas_povitryanikh_trivog/" }],
  },
  {
    id: "empetico-coming-soon", date: "2026-11-09", status: "coming_soon",
    title: "Empetico на Ревуцького, 12 ще не підтверджено як відкритий заклад",
    area: "Позняки, Дарницький район",
    summary: "Публічно доступна вакансія говорить про підготовку нового зоомагазину з грумінгом, але немає надійного підтвердження фактичного відкриття.",
    whyItMatters: "Передчасна активна картка може привести користувача до закритих дверей.",
    action: "Тримати статус coming_soon і не показувати маршрут або години до підтвердження відкриття.",
    sources: [{ label: "Вакансія нового магазину", url: "https://www.work.ua/jobs/7823847/" }],
  },
];

/** Small owner-facing news strip. No newsletters or push notifications. */
export const KYIV_INFO_ITEMS: KyivInfoItem[] = [
  {
    id: "power-coins-2026", kind: "campaign", dateLabel: "до 30 листопада",
    title: "#PowerCoins на допомогу тваринам",
    summary: "Кошти спрямовують на корм, лікування та облаштування притулків для евакуйованих тварин.",
    href: "https://kyivcity.gov.ua/news/do_30_listopada_trivaye_aktsiya_PowerCoins_zi_zboru_koshtiv_na_dopomogu_tvarinam/",
    linkLabel: "Умови кампанії", activeUntil: "2026-11-30",
  },
  {
    id: "rabies-human-help", kind: "safety", dateLabel: "важливо завжди",
    title: "Укус, подряпина або ослинення твариною",
    summary: "Промийте місце контакту водою з милом 10–15 хвилин і якнайшвидше зверніться по безоплатну антирабічну допомогу. Рішення про вакцинацію приймає лікар.",
    href: "https://kyiv.cdc.gov.ua/article/ukus-podryapyna-chy-oslynennya-tvarynoyu-kudy-zvertatysya-u-kyyevi-za-antyrabichnoyu-dopomogoyu/",
    linkLabel: "Пункти допомоги в Києві",
  },
  {
    id: "dog-shows-november", kind: "event", dateLabel: "28–29 листопада",
    title: "Кінологічні заходи у Києві",
    summary: "У календарі заявлені заходи для цвергпінчерів 28 листопада і лабрадорів 29 листопада. Перед поїздкою підтвердьте адресу та проведення в організатора.",
    href: "https://ukc.org.ua/vistavki/", linkLabel: "Календар організатора", activeUntil: "2026-11-29",
  },
  {
    id: "mini-pig-vaccination-info", kind: "vaccination", dateLabel: "5 листопада · завершено",
    title: "Профілактична вакцинація мініпігів",
    summary: "Міська ветслужба провела вакцинацію тварин у Дніпровському районі. Це новина, а не чинний пункт прийому.",
    href: "https://ovm.gov.ua/index.php/1483-profilaktychna-vaktsynatsiia-svynei-u-kyievi",
    linkLabel: "Офіційне повідомлення",
  },
];

export const EMERGENCY_VERIFICATION_FIELDS = [
  "Чи приймає лікар просто зараз, а не лише чергує асистент?",
  "Walk-in, call-first чи тільки за записом?",
  "Який режим за жовтої та червоної повітряної загрози?",
  "Чи доступні вночі лабораторія, рентген або УЗД?",
  "Чи є стаціонар, резервне живлення та окремий нічний вхід?",
  "Коли й ким інформацію підтверджено телефоном?",
] as const;

export const PARTNERSHIP_OPPORTUNITIES = [
  { name: "UAnimals / #PowerCoins", timing: "до 30 листопада", action: "Запропонувати клінікам і зоомагазинам QR-перехід лише на офіційні реквізити кампанії.", url: "https://kyivcity.gov.ua/news/do_30_listopada_trivaye_aktsiya_PowerCoins_zi_zboru_koshtiv_na_dopomogu_tvarinam/" },
  { name: "Міський реєстр тварин", timing: "актуально зараз", action: "Використовувати офіційні сторінки як основний канал lost/found і додати маршрут до сканера чипа.", url: "https://pets.kyivcity.gov.ua/lost-animals" },
  { name: "ОВМ — нетипові тварини", timing: "після листопадової вакцинації", action: "Запросити перелік лікарів, які реально приймають мініпігів та екзотичних тварин.", url: "https://ovm.gov.ua/" },
] as const;
