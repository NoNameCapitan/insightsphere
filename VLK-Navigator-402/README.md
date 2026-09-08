# VLK Навігатор — 402 Assist

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

## Два робочі режими

- **Лікар** — швидка нормативна звірка, дослівні пункти, ТДВ, зведення та
  попередній найсуворіший орієнтир без автоматичної постанови ВЛК.
- **Громадянин** — пошук норми, зрозумілий маршрут підготовки та локальний
  чекліст документів без самодіагностики й визначення придатності.

Інтерфейс навмисно не містить окремого модуля перевірки процедури ВЛК.

## Візуальна система

Командна оболонка живе в шапці як ідентичність, а робоча зона побудована як
тихий документ: тепле паперове тло, білий центр із нормативним текстом,
волосяні межі замість контрастних рамок. Оригінальна емблема створена на
основі двох наданих військово-медичних логотипів; вона використовується в
шапці, паспорті норми та PWA-іконці. Під нормативним текстом водяного знака
немає, а радарна текстура є лише атмосферним шаром у шапці й не несе
медичного або нормативного значення.

Колір задається токенами в `app/globals.css`: у розмітці немає прямих
hex-значень (це перевіряє тест). Нескінченних декоративних анімацій немає;
`prefers-reduced-motion: reduce` вимикає решту переходів.

### Тема, щільність і друк

- **Тема** — «Як у системі» / «Світла» / «Нічна» в меню «Ще». Значення
  зберігається локально, а скрипт у `<head>` застосовує його до першого
  малювання, тому нічна тема не блимає білим.
- **Щільність** — «Комфортно» / «Щільно». Щільний режим стискає лише простір
  (рядок статті 84 → 76 px, рядок пункту 64 → 54 px), кегль медичного тексту
  не змінюється.
- **Друк і PDF** — «Друк / зберегти PDF» у зведенні використовує аркуш у DOM
  і таблицю стилів `@media print`, а не popup-вікно: на папір іде документ із
  редакцією, дослівними пунктами, результатами, чеклістом і джерелом.

### Один екран — одна панель на телефоні

До ширини `xl` три панелі не вміщуються поруч, тому показується одна:
«Список · Стаття · Зведення». Вибір статті одразу відкриває її текст, тому
на телефоні не потрібно прокручувати весь список. Вкладки — це `tablist` із
рухом стрілками ←/→, Home та End.

### Доступність

Контраст перевіряється фактичним обходом сторінки: 995 елементів з текстом у
світлій темі та 997 у нічній, усі не нижче WCAG AA (найнижчий 4.75 і 5.8).
Кількість знайдених статей озвучується через `role="status"`, `Esc` закриває
повноекранні таблиці й повертає фокус на кнопку відкриття.

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
`lib/vlk-report.ts` (копіювання та чернетка), `lib/vlk-session.ts`
(локальний кошик із сумісністю старих записів).

Дослівні нормативні тексти не скорочуються й не переказуються. Короткий
навігаційний опис завжди позначений окремо від офіційного тексту, а результат
аналізатора подається лише як попередній орієнтир, а не постанова ВЛК.

### Походження та контроль редакції

Кнопка **«Паспорт норми»** показує ідентифікатор корпусу, офіційне джерело,
дату редакції, автоматичні інваріанти, журнал редакцій і статус двох іменних
експертних перевірок. Статус подвійної перевірки лишається незавершеним, доки
немає підтверджень лікаря ВЛК та військово-медичного юриста.

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
   (`next build`); скрипт `vercel-build` у `package.json` дає той самий результат,
   якщо конфіг не читається.
3. Змінні середовища не потрібні: застосунок повністю клієнтський і не звертається
   до жодного бекенду.

Локальний еквівалент того, що робить Vercel:

```bash
npm ci
npm run build:next     # next build
npm run start:next     # next start
```

Файли `worker/`, `db/`, `drizzle/`, `examples/`, `vite.config.ts` потрібні лише
збірці для Cloudflare Workers: вони виключені з перевірки типів Next.js
(`tsconfig.json` → `exclude`) і з завантаження на Vercel (`.vercelignore`).
Без цього `next build` падав на `Cannot find module 'cloudflare:workers'`.

### Cloudflare Workers / Sites

Без змін: `npm run build` (vinext) і `npm run start`. Саме цей шлях описаний
нижче в розділі про Sites lifecycle.

Service worker містить правила кешування хешованих ресурсів обох збірок
(`/assets/…` для vinext і `/_next/static/…` для Next.js). Офлайн-доступ
залежить від попереднього завантаження ресурсів; його потрібно перевірити
в браузері після деплою, включно з поясненнями та оновленням кешу.

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
