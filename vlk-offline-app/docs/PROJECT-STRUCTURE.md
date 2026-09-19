# Структура реалізованого застосунку

```text
vlk-offline-app/
  src/
    app/
      (auth)/login/page.tsx
      (work)/
        layout.tsx
        page.tsx                     — черга й показники дня
        registry/new/page.tsx         — реєстрація
        sessions/[id]/page.tsx        — рольова картка та огляди
        sessions/[id]/transfer/page.tsx
        transfers/page.tsx
        exports/page.tsx
        admin/page.tsx
      print/[id]/page.tsx             — талон або зведення / PDF
      api/export/route.ts             — захищений JSON / CSV / XLSX
      api/health/route.ts
      layout.tsx
      globals.css
    actions.ts                       — Server Actions, origin та автентифікація
    db.ts                            — Prisma + SQLite (WAL, foreign keys)
                                       або libSQL для хмарного режиму
    server/
      auth.ts                        — серверні сесії, права, ліміт входів
      records.ts                     — транзакції клінічного процесу
      validation.ts                  — Zod, дати, поля й дозволені значення
      export-data.ts                 — табличне представлення та безпечний CSV
      errors.ts
    lib/
      domain.ts                      — ролі, спеціальності, знімки, поля копіювання
      passwords.ts                   — scrypt, випадкова сіль, хеш токена входу
      request-key.ts                 — ключ повторного запиту для HTTP/LAN
      utils.ts
    components/
      ui/                            — локальна база shadcn/ui
      registration.tsx
      examination.tsx
      decision.tsx
      transfer.tsx
      copy-field.tsx                 — Clipboard API + резервний спосіб
      icd-picker.tsx
      queue.tsx, users.tsx, export.tsx, login.tsx, common.tsx
    generated/prisma/                — створюється командою prisma generate
  prisma/
    schema.prisma                    — моделі, enums, зв'язки та індекси
    migrations/
      202609180001_initial/
      202609180002_runtime/
      202609180003_integrity/
  scripts/
    setup.ts, start.mjs, serve.mjs, next.mjs, finalize-build.mjs
    backup.ts, restore.ts, import-icd.ts, prompt.ts
    offline.mjs                       — стан автономної готовності й відбитки
    prepare.mjs                       — єдиний крок, якому потрібен інтернет
    migrate.mjs                       — вибір рушія міграцій за DATABASE_URL
    migrate-offline.mjs               — міграції без Prisma CLI та мережі
    migrate-remote.mjs                — міграції для libSQL / Turso (хмара)
    offline-check.mjs                 — діагностика автономності
    pack-offline.mjs                  — портативний пакет для машини без мережі
    make-icons.mjs                    — локальна генерація значків PWA
  tests/
    workflow.test.ts                  — перевірка реальних SQL-транзакцій
    offline.test.ts                   — автономність, кеш оболонки, значки
  reference-data/                     — версійований допоміжний довідник
  docs/                              — інструкції й фактичні перевірки
  public/
    icon.svg, icon-192.png, icon-512.png
    manifest.webmanifest              — PWA: окреме вікно застосунку
    sw.js                             — кеш лише статичної оболонки
  START-WINDOWS.cmd, start-local.sh
  Dockerfile, compose.yaml
  .env.example, prisma.config.ts, next.config.ts
  vercel.json, .vercelignore          — необов'язкове хмарне розгортання
  package.json, package-lock.json, tsconfig.json, components.json
```

`data/`, `backups/`, `.env`, `node_modules/`, `.next/`, `.offline-ready.json`
і `dist-offline/` створюються локально й не входять до архіву. Персональних даних і тестових паролів у пакеті немає.

UI не звертається до SQLite напряму. Зміна проходить origin-перевірку,
серверну автентифікацію, перевірку ролі та валідацію; транзакція зберігає
зміст і запис аудиту разом. Client Components отримують лише дані, потрібні
для дозволеного інтерфейсу. Для реєстратора клінічні тексти не серіалізуються.
