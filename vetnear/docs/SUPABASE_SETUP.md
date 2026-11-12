# VetNear — Supabase backend setup (Phase 2)

Живий цикл даних: заявки партнерів і репорти «невірна інформація» тепер
зберігаються на сервері, тож модератор бачить їх з будь-якого пристрою.
localStorage залишається offline-копією — без бекенду застосунок працює як demo.

## 1. Створити проєкт Supabase
1. https://supabase.com → New project (регіон EU).
2. SQL Editor → послідовно виконати:
   - `supabase/migrations/001_init.sql`;
   - `supabase/migrations/002_publishing_leads_moderators.sql`;
   - `supabase/migrations/003_security_hardening.sql`.
   - `supabase/migrations/004_lead_retention_schedule.sql`.
   Це створює `partner_submissions`, `moderation_events`, `place_reports`
   з увімкненим RLS **без публічних політик** — таблиці доступні лише
   service-ролі (тобто лише нашим API-роутам).

## 2. Змінні середовища
Скопіюй `.env.example` → `.env.local` і заповни:

| Змінна | Звідки | Де живе |
| --- | --- | --- |
| `SUPABASE_URL` | Settings → API → Project URL | тільки сервер |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role | **тільки сервер, ніколи в браузер** |
| `LEAD_HASH_SALT` | 32+ випадкових символи | тільки сервер |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST | тільки сервер |
| `NEXT_PUBLIC_BACKEND_ENABLED` | постав `1` | публічний прапорець |

На Vercel ті самі змінні додаються у Project → Settings → Environment Variables.

## 3. Що вмикається
- `POST /api/submissions` — публічна подача заявки партнера
  (rate limit 5/10 хв/IP; сервер примусово ставить `status=pending_review`,
  `emergencyAvailable=false`, provenance `partner_submitted`).
- `POST /api/reports` — публічний репорт «невірна інформація» (10/10 хв/IP).
- `GET/POST /api/admin/submissions`, `GET /api/admin/reports` — черга модерації;
  захищені заголовком `x-admin-token` (порівняння constant-time).
- `/admin/moderation` — зверху зʼявляється «Серверна черга модерації»:
  вводиш токен (зберігається лише у sessionStorage), бачиш заявки з усіх
  пристроїв, схвалюєш/відхиляєш — рішення пишеться в `moderation_events`.

## 4. Правила чесності, які ГАРАНТУЄ сервер
Незалежно від того, що надіслав клієнт (`src/lib/server/submissionValidation.ts`,
покрито тестами):
- `emergencyAvailable` завжди `false`; категорію `emergency_vet` подати не можна.
- `status` завжди `pending_review`; `verificationStatus` — `needs_review`
  (з координатами) або `needs_geocoding` (без них).
- `phoneConfirmedAt/By` завжди `null` — телефонне підтвердження робить лише модератор.
- URL проходять safe-URL фільтр, рядки обрізаються за лімітами.

## 5. Відомі обмеження (чесно)
- Модератор-авторизація використовує персональні хешовані токени. Спільний
  `ADMIN_TOKEN` у production не задавати; `npm run release:gate` це перевіряє.
- Партнерський кабінет поки читає локальну копію (свої заявки з цього браузера);
  серверний партнер-логін — наступна фаза.
- Rate limiter і brute-force lockout розподілені між інстансами, коли задані
  Upstash REST credentials; без них використовується локальний fallback.

## 6. Перевірка
```bash
npm run verify   # lint + tsc + unit/security tests + production build
```

Після міграції `003` виконайте post-check спочатку на staging. Потрібні
`psql` і прямий PostgreSQL URL користувача, який може виконати
`SET ROLE service_role`:

```bash
# значення не виводиться і не передається в аргументах процесу psql
DB_URL='postgresql://…' npm run db:postcheck
```

Перевірка читає каталоги PostgreSQL та створює тестові записи тільки всередині
транзакцій із `ROLLBACK`. Вона зупиняється при порушенні RLS, привілеїв,
CHECK-обмежень, UTC-дедуплікації або append-only аудиту. Очищення старих лідів
навмисно не запускається.

```bash
# локально:
curl -X POST localhost:3000/api/submissions -H 'Content-Type: application/json' \
  -d '{"name":"Тест","category":"veterinary_clinic","district":"obolonskyi","address":"вул. Тестова, 1","phone":"+380441234567","services":[],"animalTypes":["cat"],"tags":[],"emergencyAvailable":true}'
# у відповіді заявка створена, а в БД emergencyAvailable=false — сервер переміг.
```
