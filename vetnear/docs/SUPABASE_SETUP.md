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
   - `supabase/migrations/005_auth_pets.sql` (акаунти + картки тварин, v1.31);
   - `supabase/migrations/006_billing_foundation.sql` (основа під оплати, v1.31).
   Це створює `partner_submissions`, `moderation_events`, `place_reports`
   з увімкненим RLS **без публічних політик** — таблиці доступні лише
   service-ролі (тобто лише нашим API-роутам).

## 2. Змінні середовища
Скопіюй `.env.example` → `.env.local` і заповни:

| Змінна | Звідки | Де живе |
| --- | --- | --- |
| `SUPABASE_URL` | Settings → API → Project URL | тільки сервер |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role | **тільки сервер, ніколи в браузер** |
| `SUPABASE_ANON_KEY` | Settings → API → anon / publishable | тільки сервер (вхід і картки тварин під JWT користувача) |
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

## 7. Акаунти та картки тварин (v1.31)

**Як це влаштовано.** Вхід — за одноразовим посиланням на пошту (Supabase Auth),
без пароля. Браузер ніколи не звертається до Supabase напряму й не бачить
жодного ключа: сесія живе у двох httpOnly-cookie (`vn_at`, `vn_rt`), а всі
запити йдуть через `/api/auth/*` та `/api/pets/*`. Картки тварин читаються й
пишуться **під JWT користувача**, тож доступ обмежує RLS
(`owner_id = auth.uid()`), а не довіра до нашого коду. Service-role для
акаунтів використовується лише в одному місці — видалення власного акаунта.

### 7.1. Налаштувати Supabase Auth (5 хвилин)
1. **Authentication → Providers → Email**: увімкнено; «Confirm email» — увімкнено.
2. **Authentication → URL Configuration**:
   - Site URL: `https://ваш-домен`;
   - Redirect URLs: додати `https://ваш-домен/auth/callback`
     (і `http://localhost:3000/auth/callback` для локальної розробки).
3. **Authentication → Email Templates → Magic Link** (рекомендовано — тоді
   посилання працює і на іншому пристрої, а токени не потрапляють в адресу):
   ```html
   <h2>Вхід до VetNear</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Увійти</a></p>
   <p>Посилання діє одну годину й спрацьовує один раз.</p>
   ```
   Той самий шаблон поставте для **Confirm signup**.
   Якщо шаблон не міняти, стандартний лист Supabase теж працює (через
   `/auth/callback`), але лише в тому браузері, де відкрито посилання.
4. **Власний SMTP** (Authentication → SMTP Settings). Вбудована пошта Supabase
   має дуже малий ліміт листів на годину й годиться лише для перевірки. Перед
   відкриттям доступу підключіть свій SMTP (Resend, Postmark, SES тощо) і
   підніміть ліміт у Authentication → Rate Limits.
5. Додайте `SUPABASE_ANON_KEY` у змінні середовища (Vercel → Settings →
   Environment Variables) і перезапустіть деплой.

### 7.2. Що працює після цього
- `/auth` — вхід / реєстрація однією формою; `/account` — пошта, вихід,
  видалення акаунта з усіма картками.
- `/my-pets` — для гостя показує спокійне запрошення увійти; пошук клінік
  (`/nearby`, `/help`) лишається відкритим без акаунта.
- Картки, створені на пристрої до входу, не завантажуються мовчки: після
  входу користувач бачить пропозицію «Перенести в акаунт».
- Файли, прикріплені до записів, на сервер не передаються (лишаються на пристрої).
- Якщо `SUPABASE_ANON_KEY` не задано, сайт працює як раніше: картки лише на
  пристрої, посилання «Увійти» приховане.

### 7.3. Обмеження, про які варто знати
- До 20 карток на акаунт і до 256 КБ на картку (перевіряє база).
- Соцлогін (Google / Apple) і пароль не підключені.
- Синхронізація «останній запис перемагає»: якщо одну картку одночасно
  редагувати на двох пристроях, збережеться пізніша версія.

## 8. Тарифи та оплата (v1.31)

**Оплата поки вручну.** Платіжний провайдер не підключений. Шлях такий:
1. Партнер лишає запит на `/for-partners` → рядок у `partner_interest`
   (видно в `/admin/leads` → «Запити на платні тарифи»).
2. Ви звʼязуєтесь, узгоджуєте умови, виставляєте рахунок поза сайтом.
3. В `/admin/leads` ставите тариф: `free` / `verified` / `promoted`
   (для `promoted` обовʼязкова кількість днів).

Кожна зміна дописується в `place_tier_events` (хто, з якого на який тариф, до
якої дати) — таблиця лише на додавання. У `published_places` зʼявились поля
`subscription_status` (`none | active | past_due | canceled`),
`billing_provider`, `billing_customer_id`, `billing_subscription_id`: зараз
їх заповнює адмін-зміна (`manual`), пізніше — вебхук LiqPay / Fondy / Stripe,
без зміни моделі.

Тариф **ніколи** не дає позначку 24/7 чи «термінова допомога»: вона ставиться
лише після телефонного підтвердження.

## 9. Smoke-тест після деплою
```bash
npm run release:gate                       # змінні середовища для продакшну
npm run smoke -- https://ваш-домен         # нічого не створює
```
Потім вручну (2 хвилини):
1. Відкрити `/my-pets` як гість → запрошення увійти; `/nearby` відкривається без входу.
2. `/auth` → ввести пошту → лист → перейти за посиланням → ви на `/my-pets`.
3. Створити картку → оновити сторінку → картка на місці.
4. Відкрити сайт в іншому браузері, увійти тією ж поштою → та сама картка.
5. `/account` → «Вийти» → `/my-pets` знову просить увійти.
6. Supabase → Table Editor → `pets`: рядок має ваш `owner_id`.
7. `/admin/leads` з токеном адміністратора → поставити закладу `verified`,
   потім `promoted` на 30 днів → у `place_tier_events` два рядки.
