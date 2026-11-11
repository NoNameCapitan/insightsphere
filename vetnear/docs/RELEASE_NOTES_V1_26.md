# VetNear v1.26 — security hardening

> Superseded by the focused database-integrity patch in
> `RELEASE_NOTES_V1_26_1.md`. Deploy v1.26.1, not the original v1.26 archive.

Перевірено: `tsc --noEmit` OK, `eslint .` OK, `vitest` 280/280 (24 файли), `next build` OK,
`npm audit --omit=dev` = 0 вразливостей, димовий тест `next start` (сторінки + API через curl).

## Закриті діри

| # | Рівень | Проблема | Виправлення |
|---|--------|----------|-------------|
| 1 | Critical | `next@16.3.4` — відомі advisories (RCE в `use cache` / `next/og`, cache poisoning) | `next` і `eslint-config-next` → 16.4.6; `npm audit fix` для транзитивних (sharp, source-map-js тощо) |
| 2 | High | Обхід rate limit: ключ брався з першого хопа `X-Forwarded-For`, який клієнт підробляє → необмежені виклики платного LLM і спам форм | `clientKeyFromRequest`: спершу `x-vercel-forwarded-for` / `x-real-ip` (ставить платформа), XFF — останнім; ключ валідований як IP |
| 3 | High | Немає захисту від перебору адмін-токена | Lockout: 10 невдалих спроб / 10 хв / IP; токен > 512 символів відхиляється; `ADMIN_TOKEN` коротший за 24 символи ігнорується |
| 4 | Medium | Порівняння `ADMIN_TOKEN` видавало довжину секрету через timing | Порівнюються SHA-256 дайджести; мертвий `adminAuth.ts` видалено |
| 5 | High | Сіль хешу сесії = перші 24 символи service-role ключа Supabase (публічний константний JWT-заголовок) або статичний рядок → хеш IP відновлюється перебором | Сіль = `LEAD_HASH_SALT`, інакше SHA-256 від повного ключа, інакше випадкова на процес |
| 6 | Medium | Тіло запиту без обмеження розміру (`req.json()`), немає перевірки Content-Type → DoS памʼяті, CSRF «simple request» | `readJsonBody`: ліміт 16 КБ (413), лише `application/json` (415) — у всіх 7 POST-маршрутах |
| 7 | Medium | Prompt injection: `pet.name/breed/animalType/preferredDistrict` йшли в SYSTEM-промпт без очищення; `/api/triage` пересилав у LLM довільні обʼєкти `answers` | Allowlist enum-ів, вирізання переносів/керівних символів; triage приймає лише відомі значення |
| 8 | Medium | Виклики LLM без таймауту (зависання функції = гроші + DoS) | `AbortSignal.timeout(15s)` |
| 9 | Medium | Логічна діра модерації: статус `changes_requested` / `pending_review` після `approved` лишав заклад у публічній видачі | Будь-який не-`approved` статус знімає публікацію; помилка запису аудиту логується |
| 10 | Medium | CSP: `img-src https:` і `connect-src https:` — будь-який хост (ексфільтрація) | Точний allowlist (OSM tiles, Nominatim, OSRM); `frame-src 'none'`; додано COOP, CORP, `X-Permitted-Cross-Domain-Policies`; прибрано `X-Powered-By` |
| 11 | Low | `/admin`, `/partner`, `/api/admin/*` могли кешуватись/індексуватись; service worker клав їх в офлайн-кеш і кешував помилкові відповіді | `Cache-Control: no-store` + `X-Robots-Tag: noindex`; SW пропускає admin/partner і кешує лише `res.ok`; robots.txt доповнено |
| 12 | Low | `/api/safety/shelters` без ліміту (до 10 запитів до міського GIS на виклик); `/api/safety/alert` — кожне опитування = виклик upstream з токеном | Ліміт 20/хв/IP; спільний кеш 10 с + дедуплікація; env-override джерела лише HTTPS |
| 13 | Low | Валідація: `website`/`mapLink` приймали `tel:`/`mailto:` та URL з логіном; `animalTypes` — довільні рядки; координати поза діапазоном; `placeId` без формату; керівні символи; `promotedDays` дробовий | Виправлено у `submissionValidation.ts` та маршрутах |
| 14 | Low | ID через `Math.random()` | `crypto.randomBytes` |
| 15 | Low | Фото тварини: приймався будь-який тип файлу | Лише JPEG/PNG/WebP |
| 16 | Low | `.gitignore` не покривав `.env`, `.env.production` | Додано `.env`, `.env.*`; створено `.env.example` |
| 17 | DB | Захист лише RLS без політик | `003_security_hardening.sql`: REVOKE для anon/authenticated, CHECK-обмеження розмірів, append-only аудит, функція ретенції лідів. **Міграцію не запускав — бази тут немає; перевірте на staging.** |

## Що треба зробити вручну після деплою
1. Виконати `supabase/migrations/003_security_hardening.sql` (спершу на staging).
2. У Vercel задати `LEAD_HASH_SALT` (32+ випадкових символи) і `ADMIN_TOKEN` ≥ 24 символів (або прибрати його, видавши токени через `scripts/moderator-token.mjs`). Увага: коротший `ADMIN_TOKEN` тепер перестане працювати.
3. Якщо секрети колись потрапляли в git/zip/чат — ротувати їх.

## Відомі обмеження (не закрито кодом)
- Rate limit і lockout — у памʼяті процесу; на Vercel кожен інстанс має свій лічильник. Потрібен Upstash Redis / Vercel KV.
- Lockout за IP блокує й правильний токен з тієї ж адреси на 10 хв (свідомий компроміс).
- `script-src 'unsafe-inline'` лишився — потрібен nonce через `proxy.ts`.
- `/admin` і `/partner/dashboard` — клієнтські демо на localStorage без серверної авторизації сторінки.
- Залишилися dev-only advisories (vitest/vite/esbuild) — виправляються лише мажорним оновленням vitest; у production-збірку не потрапляють.
- Не перевірено тут: шляхи з реальним Supabase, реальні виклики LLM, тривоги/укриття з реальними токенами, UI у браузері (перевірено лише HTTP-коди сторінок).
