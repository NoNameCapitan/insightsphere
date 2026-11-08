# Інтеграція — для розробника мережі

## Модель
```
Choice / POS ──► синхронізація (щогодини або за подією) ──► js/data.js (або branch.json на філію)
                                                         └► js/branches.js (профілі філій)
                     статичний CDN ──► 9 сайтів (/slug) · віджет embed.js · QR у залах
```
Замовлення та оплата не дублюються: кожна картка страви веде на `venue.url + '/' + item.url` у Choice.

## Додати нову філію
1. У `js/data.js` додати об’єкт у `venues` (формат нижче) з унікальним `key`.
2. У `js/branches.js` → `list[key]` вказати `slug`, `short`, `district`, `lat`, `lng`, `accent`, `tagline`, `heroDish` (масив regex-шаблонів назв), `kanji`.
3. Додати рядок у `_redirects` / `vercel.json`. Усе — сайт `/slug`, картка в Network Studio, точка на мапі й віджет з’являються автоматично.

## Контракт даних філії (`venues[]`)
```json
{
  "key": "torisho", "name": "вул. Шота Руставелі, 12", "subtitle": "…",
  "url": "https://menyamusashixtorisho.choiceqr.com/uk",
  "hours": "12:00–22:00", "phone": "+38 …", "phoneHref": "tel:+38…", "map": "https://maps.google.com/?q=…",
  "sections": [{ "title": "ОСНОВНЕ МЕНЮ", "categories": [{ "title": "РАМЕН", "items": [{
    "name": "Рамен з рваною телятиною", "price": "Від 359 ₴", "description": "…",
    "image": "assets/dish-4.webp", "url": "section:osnovne-menyu/ramen/…",
    "options": [{ "title": "розмір", "items": [{ "name": "L - 400 г", "price": "359 ₴" }] }],
    "labels": [], "measure": ""
  }]}]}]
}
```
Мінімум: `key`, `name`, `url`, `hours`, `sections[].categories[].items[].{name, price, image}`.

## Синхронізація (етап B)
Будь-який планувальник (GitHub Actions cron, Cloud Function) забирає експорт Choice/POS, нормалізує у формат вище, оптимізує фото у WebP і перезбирає `data.js`. Статус «відкрито» рахується на клієнті з `hours` за `Europe/Kyiv`; стоп-лист — прапорцем `available:false` (додати фільтр у `app.js`).

## Віджет
```html
<div data-musashi-widget data-venue="torisho" data-count="3"></div>
<script src="https://ДОМЕН/js/embed.js" async></script>
```
Shadow DOM, самостійно підвантажує дані з того ж домену. Опційно `data-accent="#e64a2e"`.

## Параметри URL
`venue` (key або slug), `accent` (hex без #), `dish` (назва страви), `headline` (`рядок1|рядок2`), `embed=1` (без плашки й прелоадера — для iframe).

## Межі прототипу
Немає автосинхронізації (знімок 06.11.2026), немає аналітики й cookie, немає оформлення замовлення на сайті. Мапа — схема, координати приблизні.
