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
npm run db:migrate
npm run setup          # запитає логін, ПІБ і пароль адміністратора
```

## 3. Змінні оточення проєкту Vercel

```
DATABASE_URL=libsql://vlk-standby-<org>.turso.io
DATABASE_AUTH_TOKEN=<токен>
APP_ORIGIN=https://<проєкт>.vercel.app
ALLOWED_ORIGINS=https://<проєкт>.vercel.app
COOKIE_SECURE=true
COMMISSION_NAME=ВЛК установи
ORDER_402_REVISION=За редакцією, чинною на дату огляду
NEXT_TELEMETRY_DISABLED=1
```

`APP_ORIGIN` і `ALLOWED_ORIGINS` мають точно збігатися з адресою в браузері,
без завершального `/`.

## 4. Розгортання

```sh
npx vercel --prod
```

## Локальний запуск із цього ж архіву

```sh
npm run prepare:offline   # єдиний крок з інтернетом
npm start                 # далі працює без мережі
```
