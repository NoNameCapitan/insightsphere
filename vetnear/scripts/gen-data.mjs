// Generator for synthetic Kyiv place data (Module 14). Run: node scripts/gen-data.mjs
import { writeFileSync } from "node:fs";

const CENTROIDS = {
  podil: [50.4662, 30.5152], pechersk: [50.4253, 30.5403],
  obolon: [50.5151, 30.4983], pozniaky: [50.4022, 30.6294],
  osokorky: [50.3972, 30.6103], troieshchyna: [50.5122, 30.6013],
  holosiiv: [50.3782, 30.5103], solomianka: [50.4302, 30.4603],
  nyvky: [50.4582, 30.4183], sviatoshyn: [50.4582, 30.3553],
};
const DISTRICTS = Object.keys(CENTROIDS);
const STREETS = {
  podil: "вул. Сагайдачного", pechersk: "вул. Лаврська", obolon: "просп. Оболонський",
  pozniaky: "вул. Драгоманова", osokorky: "вул. Княжий Затон", troieshchyna: "вул. Закревського",
  holosiiv: "просп. Голосіївський", solomianka: "вул. Солом'янська", nyvky: "просп. Перемоги",
  sviatoshyn: "вул. Жмеринська",
};

// seeded PRNG for reproducibility
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const some = (a, min, max) => {
  const n = min + Math.floor(rnd() * (max - min + 1));
  const sh = [...a].sort(() => rnd() - 0.5);
  return sh.slice(0, n);
};
const jitter = (c) => [c[0] + (rnd() - 0.5) * 0.02, c[1] + (rnd() - 0.5) * 0.02];

const ANIMALS = ["cat", "dog", "bird", "rodent", "reptile", "exotic", "other"];
const full247 = Array.from({ length: 7 }, (_, day) => ({ day, open: "00:00", close: "23:59" }));
const everyday = (o, c) => Array.from({ length: 7 }, (_, day) => ({ day, open: o, close: c }));
const monToSat = (o, c) => Array.from({ length: 7 }, (_, day) => day === 0 ? { day, open: o, close: c, closed: true } : { day, open: o, close: c });

// Demo socials point at example.com so they can never match a real account.
const SOCIAL = (slug) => ({
  instagram: `https://example.com/demo/instagram/${slug}`,
  telegram: `https://example.com/demo/telegram/${slug}`,
});

const NAME_BANK = {
  veterinary_clinic: ["Айболить", "ЗооЛайф", "Друзі", "ВетПлюс", "Лапа Допомоги", "Здоровий Хвіст", "Доктор Вет", "Муркіт", "Цілитель", "ВетДім", "Гав-Мед", "Чотири Лапи"],
  emergency_vet: ["Ветмедик 24", "Швидка Лапа", "Нічний Вет", "ВетЕкстрений", "24 Здоров'я"],
  pet_store: ["ЗооМаркет", "Лапландія", "PetShop", "ЗооСвіт", "Корм і Ко", "Вусаті-Смугасті", "ЗооТочка", "Друг", "Аквамир", "Зоосфера"],
  vet_pharmacy: ["ВетФарм", "ЗооАптека", "Аптека для тварин", "ВетМед Аптека", "Фарма-Пет"],
  grooming: ["ГрумРум", "Стиль Хвоста", "КітСтиль", "Лапки-Царапки", "Барбершоп для собак", "Пухнастик"],
  shelter: ["Прихисток", "Дім Надії", "Сіріус", "Лапа в Лапі", "友 Друзі"],
  animal_volunteer_help: ["Зоодопомога", "Волонтери Києва", "Хвіст Надії"],
  pet_boarding: ["ПетГотель", "Перетримка Затишок", "Дім для Лапок"],
  dog_walking: ["ВигулПро", "Гав-Прогулянка"],
  dog_training: ["Кінологія Київ", "Слухняний Друг", "ДогТренінг"],
  pet_friendly_place: ["Кав'ярня Лапа", "Pet-friendly Парк Кафе", "Котокафе Муркіт", "Бар Два Хвости", "Ресторан Догма", "Антикафе Звірі"],
  other_pet_service: ["ЗооТаксі", "Фотограф Тварин"],
};

const SERVICES = {
  veterinary_clinic: ["огляд", "вакцинація", "стерилізація", "аналізи", "стоматологія", "чипування", "УЗД", "рентген"],
  emergency_vet: ["невідкладна допомога", "реанімація", "цілодобовий стаціонар", "екстрена хірургія"],
  pet_store: ["корми", "аксесуари", "іграшки", "наповнювачі", "переноски", "одяг"],
  vet_pharmacy: ["ветпрепарати", "вітаміни", "антипаразитарні", "догляд"],
  grooming: ["стрижка", "купання", "тримінг", "догляд за кігтями", "експрес-линька"],
  shelter: ["прихисток", "прилаштування", "стерилізація", "волонтерство"],
  animal_volunteer_help: ["порятунок", "перетримка", "збір допомоги"],
  pet_boarding: ["перетримка", "передержка", "готель", "догляд"],
  dog_walking: ["вигул", "групові прогулянки"],
  dog_training: ["дресирування", "корекція поведінки", "ОКД"],
  pet_friendly_place: ["pet-friendly зона", "миска з водою", "ласощі для гостей"],
  other_pet_service: ["зоотаксі", "фотосесія"],
};

const COUNTS = {
  veterinary_clinic: 25, emergency_vet: 8, pet_store: 18, vet_pharmacy: 8,
  grooming: 8, shelter: 3, animal_volunteer_help: 2, pet_boarding: 2,
  dog_walking: 1, dog_training: 2, pet_friendly_place: 6,
};

const TRANSLIT = {"а":"a","б":"b","в":"v","г":"h","ґ":"g","д":"d","е":"e","є":"ie","ж":"zh","з":"z","и":"y","і":"i","ї":"i","й":"i","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ь":"","ю":"iu","я":"ia","'":""};
const translitStr = (str) => str.toLowerCase().split("").map((ch) => TRANSLIT[ch] ?? ch).join("");
const slugify = (s, i) =>
  translitStr(s).replace(/[^a-z0-9]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + "-" + i;

const places = [];
let idx = 0;
const usedSlug = new Set();

for (const [category, count] of Object.entries(COUNTS)) {
  const bank = NAME_BANK[category];
  for (let i = 0; i < count; i++) {
    idx++;
    const district = DISTRICTS[idx % DISTRICTS.length];
    const baseName = bank[i % bank.length];
    const name = `${baseName} (${{podil:"Поділ",pechersk:"Печерськ",obolon:"Оболонь",pozniaky:"Позняки",osokorky:"Осокорки",troieshchyna:"Троєщина",holosiiv:"Голосіїв",solomianka:"Солом'янка",nyvky:"Нивки",sviatoshyn:"Святошин"}[district]})`;
    let slug = slugify(`${category}-${baseName}`, idx);
    while (usedSlug.has(slug)) slug = slug + "x";
    usedSlug.add(slug);
    const [lat, lng] = jitter(CENTROIDS[district]);
    const isEmergency = category === "emergency_vet";
    const is247 = isEmergency || rnd() < 0.12;
    const wh = is247 ? full247 : (rnd() < 0.5 ? everyday("09:00", "21:00") : monToSat("09:00", "20:00"));
    const isClinic = category === "veterinary_clinic" || isEmergency;
    const isStore = category === "pet_store" || category === "vet_pharmacy";
    const animals = category === "pet_friendly_place"
      ? ["dog", "cat"]
      : some(ANIMALS, 2, isClinic ? 6 : 4);
    const hasSocial = rnd() < 0.6;
    const verified = rnd() < 0.45;
    const claimed = verified ? rnd() < 0.7 : rnd() < 0.2;
    const daysAgo = Math.floor(rnd() * 180);
    const updatedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    places.push({
      id: slug,
      slug,
      name,
      category,
      description: `${baseName} — ${({veterinary_clinic:"ветеринарна клініка",emergency_vet:"цілодобова ветеринарна допомога",pet_store:"зоомагазин",vet_pharmacy:"ветеринарна аптека",grooming:"салон грумінгу",shelter:"притулок для тварин",animal_volunteer_help:"волонтерська ініціатива",pet_boarding:"перетримка та готель для тварин",dog_walking:"послуги вигулу",dog_training:"дресирування та кінологія",pet_friendly_place:"pet-friendly заклад",other_pet_service:"послуги для тварин"})[category]} у районі.`,
      address: `${STREETS[district]}, ${1 + Math.floor(rnd() * 120)}`,
      district,
      latitude: +lat.toFixed(5),
      longitude: +lng.toFixed(5),
      phone: `+38067${(1000000 + Math.floor(rnd() * 8999999))}`,
      email: hasSocial ? `${slug.split("-")[0]}@example.com` : undefined,
      website: rnd() < 0.5 ? `https://${slug.split("-").slice(0,2).join("")}.example.com` : undefined,
      socialLinks: hasSocial ? SOCIAL(slug) : undefined,
      workingHours: wh,
      isOpen24_7: is247,
      services: some(SERVICES[category], 2, Math.min(5, SERVICES[category].length)),
      animalTypes: animals,
      tags: [],
      hasSurgery: isClinic && rnd() < 0.6,
      hasUltrasound: isClinic && rnd() < 0.5,
      hasXray: isClinic && rnd() < 0.4,
      hasPharmacy: category === "vet_pharmacy" || (isClinic && rnd() < 0.5),
      emergencyAvailable: isEmergency || (isClinic && rnd() < 0.25),
      appointmentRequired: isClinic ? rnd() < 0.4 : false,
      deliveryAvailable: isStore ? rnd() < 0.6 : false,
      pickupAvailable: isStore ? rnd() < 0.8 : false,
      verified,
      claimed,
      status: "approved",
      rating: +(3.8 + rnd() * 1.2).toFixed(1),
      createdAt: new Date(Date.now() - (daysAgo + 120) * 86400000).toISOString(),
      updatedAt,
      // P0 data honesty: synthetic places are clearly DEMO and never "verified".
      dataSource: "demo",
      verificationStatus: "demo",
      lastVerifiedAt: null,
      verifiedBy: null,
      sourceLabel: "Synthetic demo data",
      dataWarning: "Демонстраційні дані — не реальний заклад. Телефонуйте, щоб підтвердити.",
    });
  }
}

const header = `// AUTO-GENERATED synthetic Kyiv dataset (Module 14) via scripts/gen-data.mjs.
// Synthetic data only — names are invented and do not describe real businesses.
import type { Place } from "@/lib/types";

export const PLACES: Place[] = ${JSON.stringify(places, null, 2)};

export default PLACES;
`;
writeFileSync("src/lib/data/places.ts", header);
console.log("generated", places.length, "places");
const byCat = {};
for (const p of places) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log(byCat);
