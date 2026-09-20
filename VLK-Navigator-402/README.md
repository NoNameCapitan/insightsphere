# VLK Навігатор — 402 Assist

## v32.1 — фінальне полірування, 20.09.2026

Один режим — робоче місце лікаря ВЛК. Двоколонкова сітка «реєстр + аркуш»,
дослівний нормативний текст у мірі читання 82 ch, узгоджений текст завершення
сесії, коректна поведінка планшетних ширин 1024–1279 px.

Запуск: Node.js >=22.13.0, `npm ci`, `npm run dev`.
Production для Next/Vercel: `npm run build:next`, `npm run start:next`
(Root Directory для Vercel — `VLK-Navigator-402`).
Production для vinext/Cloudflare: `npm run build`, `npm start`.
Перевірки: `npm run lint`, `npx tsc --noEmit`, `npm test` (147/147).

Актуальний звіт: [QA-V32.1-FINAL-POLISH.md](QA-V32.1-FINAL-POLISH.md).
Проміжні випуски v30–v32 (місце для тексту, іконки, прибрані режим громадянина
та зведення): [QA-V30-READING-SPACE.md](QA-V30-READING-SPACE.md).
Нижче — історія попередніх випусків.

## v29 — Робоча панель та векторна емблема

На основі актуального коду v28. Закріплена дія вибраного пункту, компактніша
шапка, контекстні пояснення граф ТДВ та одноразова SVG-анімація змії (3,2 с).
Нормативні дані, дати, локальні ключі й алгоритми збережено.
Звіт випуску: [QA-V29-UA.md](QA-V29-UA.md).

## v27.1 — Clinical Polish, 16.09.2026

Допрацьовано specialty SVG, розміри плашок без зміни геометрії карток,
стрічку редакції на головній та lifecycle одноразових анімацій.
Нормативний і функціональний шар не змінено; 146 захищених файлів звірено SHA-256.

**Стан перевірки цього випуску:** 127/127 тестів у source-only підмножині;
63/63 перевірки ізольованих компонентів у Chromium; 16/16 viewport/theme
комбінацій. Це НЕ production-збірка і НЕ end-to-end перевірка всього застосунку.
`npm ci` заблоковано доступом до npm registry; lint, обидві збірки та повний
`npm test` не пройдені. Попередні QA-документи нижче описують історичні випуски,
а не підтверджують готовність v27.1.

Повні результати, змінені файли, motion-таблиця та залишені обмеження:
[QA-V27.1-CLINICAL-POLISH.md](QA-V27.1-CLINICAL-POLISH.md).

---

Випуск v23.1: компактні офіційні посилання в друкованому зведенні; 110 тестів.
Перевірки production-збірки та межі офлайн/друку: [QA-V23-1.md](QA-V23-1.md).

Випуск v23 на основі прикріпленого v22: оновлені поверхні та типографіка,
мобільні вкладки, навігація між статтями, Ctrl/⌘K і резервне ручне копіювання.
Нормативні тексти незмінні. Перевірки та межі: [QA-V23.md](QA-V23.md).

Випуск v22 (на основі прикріпленого v19): додано явний вибір графи I / II / III,
збереження цього контексту в локальній сесії та окремий згорнутий витяг лише
з тих офіційних пояснень, де обрану графу названо прямо. Дослівний результат
пункту не переобчислюється і не підміняється автоматичним висновком. У кожній
розгорнутій картці пункту доступне точне копіювання формулювання з джерелом,
редакцією та обраною графою. Результати: [QA-V22.md](QA-V22.md).

Випуск v21 (на основі прикріпленого v19): точніший пошук МКХ із винятками,
запити «стаття №47», «47б», «МКХ-10: J45.0», переставлені літери й діапазони
з пробілами. Вибір результату з явно заданим пунктом одразу розгортає цей
пункт. Таблиці читабельніші й розгортаються також із повних пояснень.
Оформлення спокійніше; нормативні тексти незмінні.
Результати та обмеження перевірки: [QA-V21.md](QA-V21.md).

Випуск v19: простіший головний екран, чернетка та друк приховані в додатковому
розділі кошика, завершення локальної сесії для спільних комп’ютерів, повний
офлайн-маніфест обох збірок і оновлення за дією користувача. Результати:
[QA-V19.md](QA-V19.md), план експертної та польової перевірки:
[review/RELEASE-REVIEW.md](review/RELEASE-REVIEW.md).

Випуск v18: усунено горизонтальне зсування під час відкриття меню,
пояснення відкриваються по центру, ТДВ — на весь екран. Виправлено
позиціонування після оптимізації CSS у Next.js/Vercel, повернення фокусу
та змішування пояснень при швидкому переході між статтями.
Результати перевірки та її межі: [QA-V18.md](QA-V18.md).

Випуск v17: повернуто світлу / темну / системну тему (кнопка «Тема» у шапці),
ущільнено навігацію й кошик, виправлено висоту списку статей та геометрію
повноекранних пояснень. Повні пояснення v16 і нормативні дані збережено.
Зміни й межі перевірки: [QA-V17.md](QA-V17.md).

Випуск v15: оформлення v14 з повноекранними таблицями та підсвічуванням пошуку.
Інструкція — [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md); перелік змін, перевірки
та обмеження — [QA-V15.md](QA-V15.md).

Усі 19 пронумерованих таблиць пояснень відображаються таблично й мають
кнопку «Розгорнути». ТДВ відкривається на весь екран. На вузьких екранах
широкі таблиці прокручуються всередині свого блоку, а не всією сторінкою.
Нормативні фрагменти не змінені; сітку відновлено за корпусом архіву.
Це не підтвердження тотожності макету живому офіційному документу або
актуальності редакції на сьогодні.

Навігатор по Наказу МОУ №402 (Розклад хвороб) для лікарів — членів ВЛК,
військових юристів та військовослужбовців. Застосунок працює повністю в
браузері: жодні персональні чи медичні дані не надсилаються на сервер.

## Один робочий режим

Навігатор працює як робоче місце **лікаря ВЛК**: швидка нормативна звірка,
дослівні пункти, графа обліку та ТДВ без автоматичної постанови ВЛК.
Окремого режиму для громадянина більше немає.

Немає й локального зведення (кошика) — навігатор показує норму, а не збирає
її в перелік. Сформульований текст пункту або статті копіюється просто з
відкритої картки; копія містить стан, дослівний результат, обрану графу,
редакцію та посилання на першоджерело.

Інтерфейс навмисно не містить окремого модуля перевірки процедури ВЛК.

## Візуальна система

Поєднано світлу медичну робочу площину з темною командною оболонкою воєнного
часу. Оригінальна емблема створена на основі двох наданих військово-медичних
логотипів; вона використовується в шапці, паспорті норми, PWA-іконці та як
делікатний водяний знак. Радарна текстура є лише атмосферним шаром і не несе
медичного або нормативного значення.

Анімації обмежені повільним рухом фонового радара та підсвічуванням вибраного
пункту. При `prefers-reduced-motion: reduce` вони вимикаються автоматично.

## Нормативний шар

База звірена за редакцією Наказу №402 від **22.08.2025**
(https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822#Text) і містить
87 статей, точні переліки МКХ-10, дослівний текст третьої графи Розкладу
хвороб, пункти з дослівними результатами, офіційні пояснення Додатка 2
(для статті 87 окремого пояснення немає) та ТДВ.

| Файл | Вміст |
| --- | --- |
| `lib/vlk-official-articles.ts` | точні коди МКХ-10 і дослівний рядок «Включено» |
| `lib/vlk-rules.ts` | пункти статей і дослівні результати |
| `lib/explanations/article-*.ts` | дослівні офіційні пояснення, по модулю на статтю |
| `lib/vlk-explanations.ts` | реєстр, контрольна сума й ліниве завантаження пояснень |
| `lib/vlk-anchors.ts` | якорі для переходу до конкретної статті |
| `lib/vlk-tdv.ts` | таблиця додаткових вимог |
| `lib/vlk-sample-data.ts` | навігаційні назви, спеціальності, короткі описи |

Похідні модулі: `lib/vlk-outcomes.ts` (класифікація дослівного результату),
`lib/vlk-search.ts` (пошук за МКХ, статтею, діагнозом, пунктом і лікарем),
`lib/vlk-links.ts` (посилання з підсвічуванням формулювання),
`lib/vlk-graphs.ts` (безпечний відбір прямих згадок граф I–III),
`lib/vlk-report.ts` (тексти для копіювання), `lib/vlk-session.ts`
(локальні налаштування перегляду із сумісністю старих записів).

Дослівні нормативні тексти не скорочуються й не переказуються. Короткий
навігаційний опис завжди позначений окремо від офіційного тексту, а результат
аналізатора подається лише як попередній орієнтир, а не постанова ВЛК.

### Походження та контроль редакції

Окремого вікна «Паспорт норми» в інтерфейсі більше немає. Метадані корпусу
видно на робочому екрані постійно: смуга під шапкою показує редакцію Наказу
№402 і дату останньої перевірки джерела та веде на офіційний текст. Дані
паспорта лишаються в `lib/vlk-provenance.ts` як джерело інваріантів для
автоматичної перевірки корпусу (`tests/vlk-provenance.test.mjs`).

Команда `npm run check:edition` читає живу сторінку Верховної Ради та порівнює
її дату з датою корпусу. Workflow `.github/workflows/vlk-edition-monitor.yml`
налаштовано на щоденний запуск у GitHub Actions. Він запрацює після розміщення
workflow в основній гілці репозиторію з увімкненими Actions; сам деплой на
Vercel моніторинг не активує. Розбіжність або неможливість однозначної перевірки
завершує CI з помилкою; нормативні дані автоматично не переписуються.

## Деплой

Проєкт збирається двома шляхами; обидва працюють з одного коду.

### Vercel

1. У налаштуваннях проєкту Vercel вкажіть **Root Directory** — папку, у якій
   лежать `package.json` і `vercel.json`. Якщо вміст ZIP завантажено в корінь
   репозиторію, залиште корінь; якщо в папку `VLK-Navigator-402`, виберіть її.
2. Framework Preset — **Next.js**. Команда збірки береться з `vercel.json`
   (`npm run build:next`); скрипт `vercel-build` у `package.json` дає той самий результат,
   якщо конфіг не читається.
3. Змінні середовища не потрібні: застосунок повністю клієнтський і не звертається
   до жодного бекенду.

Локальний еквівалент того, що робить Vercel:

```bash
npm ci
npm run build:next     # Next.js + повний офлайн-маніфест
npm run start:next     # next start
```

Файли `worker/`, `db/`, `drizzle/`, `examples/`, `vite.config.ts` потрібні лише
збірці для Cloudflare Workers: вони виключені з перевірки типів Next.js
(`tsconfig.json` → `exclude`) і з завантаження на Vercel (`.vercelignore`).
Без цього `next build` падав на `Cannot find module 'cloudflare:workers'`.

### Cloudflare Workers / Sites

Без змін: `npm run build` (vinext) і `npm run start`. Саме цей шлях описаний
нижче в розділі про Sites lifecycle.

Після збірки генерується `offline-manifest.json` з усіма JS/CSS/шрифтами,
включно з поясненнями ще не відкритих статей. Не запускайте для деплою голий
`next build`: він пропускає генерацію маніфесту. Маніфест не зберігається в Git.
Після повідомлення «Офлайн-копія готова» оболонка та ресурси кешовані; закриття
першого запуску до завершення кешування не гарантує офлайн-доступ. Браузер
може видаляти кеш при нестачі місця. Зовнішній сайт Верховної Ради потребує мережі.

Оновлення отримує власний кеш; неповне завантаження відхиляється. Кнопка
«Оновити» активує нову версію; під час роботи сторінка самостійно не перезавантажується.
Зберігається попередній кеш для вкладок зі старими ресурсами. Сторонні кеші не
видаляються. У режимі розробки service worker не реєструється: його слід перевіряти
на production-збірці в HTTPS або localhost, зокрема перехід v18 → v19.

У v21 перенесено виправлення v20: вже кешована головна відкривається без
очікування мережі, з HTML свого встановленого релізу. Нова версія активується
наявною кнопкою оновлення. Це не гарантує офлайн-роботу, якщо початкове
кешування не завершилося або браузер видалив кеш.

Для спільного комп’ютера: «Ще» → «Завершити сесію» → «Очистити та завершити».
Очищаються історія пошуку, останні статті, довідник лікарів і старі
формати сесій. Оформлення та кеш нормативної бази зберігаються. Інші відкриті
вкладки v19 отримують сигнал очищення. Вкладки попередніх версій перед завершенням
сесії потрібно закрити, щоб вони не перезаписали дані старою копією.

Зведення, чернетку та друк/PDF прибрано разом із кошиком. Формулювання пункту
копіюється безпосередньо з його розгорнутої картки; до тексту входять стан,
дослівний результат, обрана графа, редакція та посилання на першоджерело.

## Перевірка

```bash
npm ci
npm run lint
node --test tests/vlk-data.test.mjs
npm run check:edition # потребує доступу до zakon.rada.gov.ua
npm run build
node --test tests/*.test.mjs
```

`tests/vlk-data.test.mjs` перевіряє повноту нормативної бази (87 статей,
87 записів третьої графи, 29 точних наборів МКХ, спеціальності, пункти,
якорі, статуси пояснень і контрольну суму дослівного тексту).

---

# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with
  `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper
  module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can
  prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned
  `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build and verify the rendered development-preview metadata
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
