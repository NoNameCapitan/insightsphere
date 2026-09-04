// Centralized UI text. Default locale is Ukrainian (uk); English (en) is
// included to prove the structure is localization-ready. Add more locales by
// extending `dictionaries`. Application code references `t` only.

import type { AnimalType } from "./types";

export type Locale = "uk" | "en";
export const DEFAULT_LOCALE: Locale = "uk";

export interface Dict {
  brand: string;
  tagline: string;
  nav: { home: string; nearby: string; questionnaire: string; admin: string };
  disclaimer: string;
  disclaimerShort: string;
  units: { m: string; km: string };

  hero: {
    title: string;
    subtitle: string;
    useLocation: string;
    locating: string;
    orChoose: string;
    emergencyCta: string;
  };

  services: Record<string, string>;
  serviceEmergencyAny: string;
  animals: Record<AnimalType, string>;

  chooseService: string;
  chooseAnimal: string;
  anyAnimal: string;
  allServices: string;

  radius: { label: string; m500: string; km1: string; km3: string; km5: string };

  filters: {
    title: string;
    openNow: string;
    open247: string;
    emergency: string;
    surgery: string;
    ultrasound: string;
    xray: string;
    pharmacy: string;
    reset: string;
    apply: string;
  };

  sort: { label: string } & Record<string, string>;

  card: {
    call: string;
    website: string;
    route: string;
    details: string;
    openNow: string;
    closed: string;
    open247: string;
    emergencyBadge: string;
    services: string;
    animals: string;
    hours: string;
    rating: string;
  };

  nearby: {
    title: string;
    foundOne: string;
    foundMany: string;
    none: string;
    noneHint: string;
    map: string;
    list: string;
    locationDenied: string;
    manualTitle: string;
    manualPlaceholder: string;
    manualApply: string;
    retryLocation: string;
    yourLocation: string;
    showingNearest: string;
  };

  questionnaire: {
    title: string;
    intro: string;
    skip: string;
    next: string;
    back: string;
    seeResults: string;
    notDiagnosis: string;
    q_what: string;
    intents: {
      emergency: string;
      general: string;
      vaccination: string;
      food: string;
      medicine: string;
      grooming: string;
    };
    q_urgency: string;
    q_duration: string;
    q_eating: string;
    q_symptoms: string;
    urgency: { low: string; medium: string; high: string; critical: string };
    duration: { hours: string; day: string; days: string; week: string };
    eating: { yes: string; reduced: string; no: string };
    symptoms: {
      bleeding: string;
      trauma: string;
      vomiting: string;
      weakness: string;
      breathing: string;
      none: string;
    };
    recommendation: string;
    recoEmergency: string;
    recoClinic: string;
    recoStore: string;
    recoPharmacy: string;
    recoGrooming: string;
  };

  emergencyBanner: { title: string; body: string };

  city: { kyivVet: string; kyivStores: string; seeAll: string };

  admin: {
    title: string;
    note: string;
    add: string;
    edit: string;
    save: string;
    cancel: string;
    delete: string;
    exportJson: string;
    fields: { name: string; type: string; address: string; phone: string };
    localOnly: string;
  };

  footer: { rights: string; disclaimerLink: string; madeWith: string };
  back: string;
}

const uk: Dict = {
  brand: "VetNear",
  tagline: "Ветеринарна допомога поруч",
  nav: { home: "Головна", nearby: "Поруч", questionnaire: "Опитник", admin: "Адмін" },
  disclaimer:
    "Цей сервіс не замінює консультацію ветеринара. VetNear лише допомагає знайти найближчі заклади та прокласти маршрут і не надає медичних діагнозів чи призначень.",
  disclaimerShort: "Сервіс не замінює консультацію ветеринара.",
  units: { m: "м", km: "км" },

  hero: {
    title: "Знайдіть ветеринарну допомогу поруч",
    subtitle:
      "Найближчі ветклініки, зоомагазини, аптеки та грумінг — у радіусі 0.5, 1, 3 та 5 км від вас. Перед візитом зателефонуйте.",
    useLocation: "Визначити моє місцезнаходження",
    locating: "Визначаємо…",
    orChoose: "Або оберіть, що вам потрібно",
    emergencyCta: "Потрібна термінова допомога",
  },

  services: {
    clinic: "Ветеринарна клініка",
    emergency_clinic: "Цілодобова / невідкладна",
    pet_store: "Зоомагазин",
    pharmacy: "Ветаптека",
    grooming: "Грумінг",
    shelter: "Притулок / допомога тваринам",
  },
  serviceEmergencyAny: "Будь-яка термінова допомога",
  animals: {
    cat: "Кіт",
    dog: "Собака",
    bird: "Птах",
    rodent: "Гризун",
    reptile: "Рептилія",
    exotic: "Екзотична тварина",
    other: "Інше",
  },

  chooseService: "Що вам потрібно?",
  chooseAnimal: "Яка тварина?",
  anyAnimal: "Будь-яка тварина",
  allServices: "Усі заклади",

  radius: { label: "Радіус пошуку", m500: "0.5 км", km1: "1 км", km3: "3 км", km5: "5 км" },

  filters: {
    title: "Фільтри",
    openNow: "Відкрито зараз",
    open247: "Цілодобово",
    emergency: "Термінова ситуація",
    surgery: "Хірургія",
    ultrasound: "УЗД",
    xray: "Рентген",
    pharmacy: "Аптека",
    reset: "Скинути",
    apply: "Застосувати",
  },

  sort: {
    label: "Сортувати",
    distance: "За відстанню",
    open_now: "Спершу відкриті",
    emergency: "Спершу невідкладні",
    rating: "За рейтингом",
  },

  card: {
    call: "Зателефонувати",
    website: "Сайт",
    route: "Маршрут",
    details: "Детальніше",
    openNow: "Відкрито",
    closed: "Зачинено",
    open247: "24/7",
    emergencyBadge: "Невідкладна",
    services: "Послуги",
    animals: "Тварини",
    hours: "Графік роботи",
    rating: "Рейтинг",
  },

  nearby: {
    title: "Заклади поруч",
    foundOne: "Знайдено 1 заклад",
    foundMany: "Знайдено закладів:",
    none: "Поруч нічого не знайдено",
    noneHint: "Спробуйте збільшити радіус або змінити фільтри.",
    map: "Карта",
    list: "Список",
    locationDenied:
      "Доступ до місцезнаходження вимкнено. Введіть місто або адресу вручну.",
    manualTitle: "Вкажіть місцезнаходження",
    manualPlaceholder: "Місто або адреса (напр. Київ, Хрещатик 1)",
    manualApply: "Знайти",
    retryLocation: "Спробувати визначити знову",
    yourLocation: "Ви тут",
    showingNearest: "Спершу найближчі",
  },

  questionnaire: {
    title: "Коротке опитування перед візитом",
    intro:
      "Кілька запитань допоможуть підібрати потрібний тип закладу. Це не діагноз.",
    skip: "Пропустити",
    next: "Далі",
    back: "Назад",
    seeResults: "Показати заклади",
    notDiagnosis:
      "Важливо: відповіді не є медичним діагнозом. Ми лише підкажемо, який тип допомоги може бути доречним.",
    q_what: "Що сталося?",
    intents: {
      emergency: "Гострий стан / травма",
      general: "Нездужає, потрібен огляд",
      vaccination: "Вакцинація / чипування",
      food: "Корм / аксесуари",
      medicine: "Потрібні ліки",
      grooming: "Грумінг / догляд",
    },
    q_urgency: "Наскільки це терміново?",
    q_duration: "Як довго це триває?",
    q_eating: "Тварина їсть і п'є?",
    q_symptoms: "Чи є щось із цього?",
    urgency: {
      low: "Планово / профілактика",
      medium: "Турбує, але не критично",
      high: "Терміново",
      critical: "Критично, потрібно негайно",
    },
    duration: { hours: "Кілька годин", day: "Близько доби", days: "Кілька днів", week: "Тиждень і більше" },
    eating: { yes: "Так, як зазвичай", reduced: "Менше ніж зазвичай", no: "Ні" },
    symptoms: {
      bleeding: "Кровотеча",
      trauma: "Травма",
      vomiting: "Блювання",
      weakness: "Слабкість",
      breathing: "Утруднене дихання",
      none: "Нічого з переліченого",
    },
    recommendation: "Що варто шукати",
    recoEmergency:
      "Ознаки можуть потребувати невідкладної допомоги — телефонуйте у клініку напряму; показуємо найближчі ветклініки.",
    recoClinic: "Підійде звичайна ветеринарна клініка (вакцинація, огляд, чипування).",
    recoStore: "Шукайте зоомагазин (корм, аксесуари).",
    recoPharmacy: "Шукайте ветеринарну аптеку (ліки).",
    recoGrooming: "Шукайте салон грумінгу.",
  },

  emergencyBanner: {
    title: "Режим невідкладної допомоги",
    body: "Показуємо найближчі ветклініки. Цілодобові/термінові провайдери додаються тільки після підтвердження дзвінком. У разі загрози життю телефонуйте напряму.",
  },

  city: {
    kyivVet: "Ветклініки Києва",
    kyivStores: "Зоомагазини Києва",
    seeAll: "Дивитися всі",
  },

  admin: {
    title: "Демо-адмінка (локально)",
    note: "Зміни зберігаються лише у вашому браузері й не впливають на інших користувачів. Без реальної авторизації — лише для демо.",
    add: "Додати заклад",
    edit: "Редагувати",
    save: "Зберегти",
    cancel: "Скасувати",
    delete: "Видалити",
    exportJson: "Експорт JSON",
    fields: { name: "Назва", type: "Тип", address: "Адреса", phone: "Телефон" },
    localOnly: "Локальний режим",
  },

  footer: {
    rights: "Пілотний MVP. Дані частково перевірені за публічними джерелами; перед візитом зателефонуйте.",
    disclaimerLink: "Дисклеймер",
    madeWith: "VetNear — пошук ветеринарної допомоги поруч",
  },
  back: "Назад",
};

const en: Dict = {
  brand: "VetNear",
  tagline: "Veterinary help near you",
  nav: { home: "Home", nearby: "Nearby", questionnaire: "Questionnaire", admin: "Admin" },
  disclaimer:
    "This service does not replace a veterinarian consultation. VetNear only helps you find nearby places and route to them; it does not provide medical diagnoses or treatment instructions.",
  disclaimerShort: "This service does not replace a veterinarian consultation.",
  units: { m: "m", km: "km" },

  hero: {
    title: "Find veterinary help near you",
    subtitle:
      "Nearest vet clinics, pet stores, pharmacies and grooming — within 0.5, 1, 3 and 5 km of you. Call before visiting.",
    useLocation: "Use my location",
    locating: "Locating…",
    orChoose: "Or choose what you need",
    emergencyCta: "I need emergency help",
  },

  services: {
    clinic: "Veterinary clinic",
    emergency_clinic: "24/7 / emergency",
    pet_store: "Pet store",
    pharmacy: "Vet pharmacy",
    grooming: "Grooming",
    shelter: "Shelter / animal help",
  },
  serviceEmergencyAny: "Any emergency help",
  animals: {
    cat: "Cat",
    dog: "Dog",
    bird: "Bird",
    rodent: "Rodent",
    reptile: "Reptile",
    exotic: "Exotic animal",
    other: "Other",
  },

  chooseService: "What do you need?",
  chooseAnimal: "Which animal?",
  anyAnimal: "Any animal",
  allServices: "All places",

  radius: { label: "Search radius", m500: "0.5 km", km1: "1 km", km3: "3 km", km5: "5 km" },

  filters: {
    title: "Filters",
    openNow: "Open now",
    open247: "24/7",
    emergency: "Emergency",
    surgery: "Surgery",
    ultrasound: "Ultrasound",
    xray: "X-ray",
    pharmacy: "Pharmacy",
    reset: "Reset",
    apply: "Apply",
  },

  sort: {
    label: "Sort",
    distance: "By distance",
    open_now: "Open first",
    emergency: "Emergency first",
    rating: "By rating",
  },

  card: {
    call: "Call",
    website: "Website",
    route: "Route",
    details: "Details",
    openNow: "Open",
    closed: "Closed",
    open247: "24/7",
    emergencyBadge: "Emergency",
    services: "Services",
    animals: "Animals",
    hours: "Hours",
    rating: "Rating",
  },

  nearby: {
    title: "Places near you",
    foundOne: "1 place found",
    foundMany: "Places found:",
    none: "Nothing found nearby",
    noneHint: "Try a larger radius or different filters.",
    map: "Map",
    list: "List",
    locationDenied: "Location access is off. Enter a city or address manually.",
    manualTitle: "Set your location",
    manualPlaceholder: "City or address (e.g. Kyiv, Khreshchatyk 1)",
    manualApply: "Search",
    retryLocation: "Try locating again",
    yourLocation: "You are here",
    showingNearest: "Nearest first",
  },

  questionnaire: {
    title: "Short pre-visit questionnaire",
    intro:
      "A few questions help pick the right type of place. This is not a diagnosis.",
    skip: "Skip",
    next: "Next",
    back: "Back",
    seeResults: "Show places",
    notDiagnosis:
      "Note: answers are not a medical diagnosis. We only suggest what type of help may be relevant.",
    q_what: "What happened?",
    intents: {
      emergency: "Acute condition / trauma",
      general: "Unwell, needs a check-up",
      vaccination: "Vaccination / microchipping",
      food: "Food / accessories",
      medicine: "Need medicine",
      grooming: "Grooming / care",
    },
    q_urgency: "How urgent is it?",
    q_duration: "How long has it been happening?",
    q_eating: "Is the animal eating and drinking?",
    q_symptoms: "Any of these?",
    urgency: {
      low: "Routine / prevention",
      medium: "Concerning but not critical",
      high: "Urgent",
      critical: "Critical, needs help now",
    },
    duration: { hours: "A few hours", day: "About a day", days: "A few days", week: "A week or more" },
    eating: { yes: "Yes, as usual", reduced: "Less than usual", no: "No" },
    symptoms: {
      bleeding: "Bleeding",
      trauma: "Trauma",
      vomiting: "Vomiting",
      weakness: "Weakness",
      breathing: "Breathing difficulty",
      none: "None of these",
    },
    recommendation: "What to look for",
    recoEmergency:
      "Signs may need emergency care — call a clinic directly; we show the nearest vet clinics.",
    recoClinic: "A regular vet clinic fits (vaccination, check-up, microchipping).",
    recoStore: "Look for a pet store (food, accessories).",
    recoPharmacy: "Look for a vet pharmacy (medicine).",
    recoGrooming: "Look for a grooming salon.",
  },

  emergencyBanner: {
    title: "Emergency mode",
    body: "Showing the nearest vet clinics. 24/7 / urgent providers are added only after phone confirmation. If life is at risk, call directly.",
  },

  city: { kyivVet: "Kyiv vet clinics", kyivStores: "Kyiv pet stores", seeAll: "See all" },

  admin: {
    title: "Demo admin (local)",
    note: "Changes are stored only in your browser and do not affect other users. No real auth — demo only.",
    add: "Add place",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    exportJson: "Export JSON",
    fields: { name: "Name", type: "Type", address: "Address", phone: "Phone" },
    localOnly: "Local mode",
  },

  footer: {
    rights: "Pilot MVP. Data is partly verified from public sources; please call before visiting.",
    disclaimerLink: "Disclaimer",
    madeWith: "VetNear — find veterinary help near you",
  },
  back: "Back",
};

export const dictionaries: Record<Locale, Dict> = { uk, en };

/** The active dictionary. Swap DEFAULT_LOCALE (or wire to a context) later. */
export const t: Dict = dictionaries[DEFAULT_LOCALE];
