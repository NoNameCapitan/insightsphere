# Швидкий старт: Vercel

Повна інструкція — `docs/VERCEL.md`. Тут лише послідовність команд.

> Хмарне розгортання переносить медичну базу до зовнішнього провайдера.
> Для реальної роботи ВЛК призначений локальний режим — `docs/OFFLINE.md`.

## 1. База даних (постійного диска на Vercel немає)

```sh
turso db create vlk-standby
turso db show vlk-standby --url      # libsql://vlk-standby-<org>.turso.io
turso db tokens create vlk-standby
```

## 2. Схема й перший адміністратор — з вашого комп'ютера

```sh
npm ci
export DATABASE_URL="libsql://vlk-standby-<org>.turso.io"
export DATABASE_AUTH_TOKEN="<токен>"
npm run db:generate
npm run db:migrate:remote   # міграції у віддалену базу
npm run setup               # запитає логін, ПІБ і пароль адміністратора
```

## 3. Змінні оточення проєкту Vercel

```sh
vercel env add DATABASE_URL production
vercel env add DATABASE_AUTH_TOKEN production
vercel env add APP_ORIGIN production          # https://<проєкт>.vercel.app
vercel env add ALLOWED_ORIGINS production     # https://<проєкт>.vercel.app
vercel env add COOKIE_SECURE production       # true
```

`APP_ORIGIN` і `ALLOWED_ORIGINS` мають точно збігатися з адресою в браузері,
без завершального `/`.

**Vercel не підхоплює змінні на льоту** — після кожної зміни потрібне
повторне розгортання.

## 4. Розгортання

```sh
vercel --prod
```

## Якщо після деплою сторінки не відкриваються

Застосунок не віддає 500: замість кабінету показується екран очікування
з причиною. Машинно її називає health-ендпойнт:

```sh
curl https://<проєкт>.vercel.app/api/health
```

| Відповідь            | Що робити                                                            |
| -------------------- | -------------------------------------------------------------------- |
| `ok`                 | усе працює                                                           |
| `misconfigured`      | додати `DATABASE_URL` і `DATABASE_AUTH_TOKEN`, повторити розгортання |
| `unreachable`        | перевірити адресу бази й чинність токена                             |
| `migrations-pending` | виконати `npm run db:migrate:remote`                                 |

Помилка «Адреса доступу не дозволена» під час збереження форми означає,
що `APP_ORIGIN` / `ALLOWED_ORIGINS` не збігаються з адресою в браузері.

## Локальний запуск із цього ж архіву

```sh
npm run prepare:offline   # єдиний крок з інтернетом
npm start                 # далі працює без мережі
```
