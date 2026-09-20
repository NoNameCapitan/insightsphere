# VLK Navigator 402 v27.1 — Clinical Polish

Дата роботи: 16.09.2026. База: `VLK-Navigator-402-v27-hybrid-clinical-motion.zip`.
SHA-256 базового ZIP: `678dcec687fdc41ca9619008c7dc68e93c9f5aa2f17f16aa808984fd05a2d42a`.

## 1. Підсумок і статус приймання

Реалізовано attached Implementation Improvement Prompt у поточному проєкті, без нового scaffold і без зміни клінічної/нормативної логіки. Готовий вихідний код передається окремим чистим ZIP.

**Реалізація внесена; повне production-приймання НЕ завершене.** `npm ci` не встановив залежності через недоступний npm registry. Lint, Vinext build, Next build і повний npm test не мають PASS. Обов’язкова умова ТЗ «усі команди з exit 0» не виконана.

Є реальні перевірки вихідного коду та реальний Chromium, але браузерний запуск обмежений **ізольованим стендом компонентів, а не Next.js/React застосунком**. Наведені нижче позитивні результати не замінюють production-збірку, hydration і повний end-to-end сценарій.

## 2. Змінені й додані файли

| Файл | Дія | Призначення |
|---|---|---|
| `app/page.tsx` | Змінено | EditionTicker винесено під header до showDashboard; додано лише CSS-клас specialty-card-heading. |
| `app/globals.css` | Змінено | Розміри іконок/плашок, незмінна висота icon-row, статичний ticker, другорядна стрілка, SVG-фази, Signature, reduced motion. |
| `components/vlk/specialty-icon.tsx` | Змінено | Уточнено хірурга, психіатра, дерматовенеролога; замкнуто контур зуба, скориговано хвилю ЛОР. |
| `components/vlk/edition-ticker.tsx` | Змінено | Статична labelled region, повний текст, окремі дати й офіційне посилання; без marquee/live region. |
| `components/vlk/clinical-motion.tsx` | Змінено | React lifecycle-wrapper, що підключає та очищає окремий DOM-контролер. |
| `components/vlk/clinical-motion-controller.ts` | Додано | Події pointer/focus/touch, завершення CSS animation, м’яке повернення, reduced motion, detached-node cleanup. |
| `tests/vlk-redesign.test.mjs` | Змінено | Читає wrapper і контролер; перевіряє region замість implicit-live status. |
| `tests/vlk-clinical-polish.test.mjs` | Додано | 15 нових source-regression тестів, включно з реальним імпортом .ts. |
| `README.md` | Змінено | Актуальний стан v27.1 з явними обмеженнями та посиланням на цей звіт. |
| `RELEASE-NOTES.md` | Змінено | Новий запис v27.1 без перезапису історії. |
| `QA-V27.1-CLINICAL-POLISH.md` | Додано | Цей звіт. |

Не видалено жодного файлу вихідного архіву. `package.json`, `package-lock.json`, runtime/build-конфігурації і deployment-скрипти залишено без змін; не виконувалося оновлення залежностей.

## 3. Розміри та геометрія

| Параметр | Desktop, від 640 px | Mobile, до 639 px |
|---|---:|---:|
| SVG | 38 × 38 px | 34 × 34 px |
| Плашка | 50 × 50 px | 46 × 46 px |
| Зайнята висота heading-row | 44 px | 40 px |

Плашка використовує вже наявний простір padding, а висота рядка зафіксована на baseline-значенні. Не застосовано `transform: scale()` до картки і не змінено grid. Геометрія кожної картки, відступ заголовка й кількості статей збіглися з v27 у всіх 16 компонентних layout/theme перевірках (допуск 0.1 px).

Пріоритет віддано конкретним px-розмірам ТЗ. Вихідний SVG мав 30/28 px, тому приріст його CSS-box становить близько 26.7% / 21.4%, а не рівно 15–20%. Внутрішню систему `viewBox="0 0 24 24"`, `currentColor`, `fill="none"`, округлені linecap/linejoin і спільну основну товщину 1.9 збережено. Тонші допоміжні штрихи залишено там, де вони були потрібні для читабельності; це не твердження про 1.9 для кожного path.

## 4. Clinical Motion Atlas

| Спеціальність | Основний символ | Рухомі / акцентні SVG-частини | Повна тривалість | Семантичний ефект |
|---|---|---|---:|---|
| Терапевт | Стетоскоп | Трубка, chest piece, ECG | 1900 мс | Прослуховування та один ритмічний сигнал |
| Хірург | Скальпель | Руків’я, група інструмента, gleam, короткий лінійний акцент | 1800 мс | Контрольований точний рух, без зображення розрізу |
| Невролог | Мозок + нервові зв’язки | Core, neural signal, периферійні вузли | 2200 мс | Передавання сигналу |
| Психіатр | Спрощений мозок + speech bubble | Мозковий контур, dialog-one, dialog-two, bubble, central response | 1900 мс | Послідовний діалог і стабілізація |
| Офтальмолог | Око | Зіниця й відблиск | 1800 мс | М’яке фокусування без швидкого моргання |
| ЛОР | Вухо | Внутрішня завитка, дві звукові хвилі | 1900 мс | Сприйняття звуку, не Wi-Fi-символ |
| Стоматолог | Зуб | Контур, enamel glint, pulp | 1800 мс | Огляд емалі та коротка внутрішня реакція |
| Дерматовенеролог | Лупа зі шкірою | Лупа зі зразком, два шари, точка texture | 2100 мс | Уважний огляд поверхні шкіри |

Кожна основна CSS-послідовність має `iterations: 1`; browser-перевірка підтвердила фактичні значення. Перший feedback перевірений на плашці через 380 мс; це не вимірювання фізіологічної точності або першого пікселя кожної SVG-фази.

### Чим психіатр відрізняється від невролога

Невролог зберігає нервові зв’язки й імпульс. Психіатр тепер має спрощений мозковий контур і чітку закриту speech bubble з двома однаковими короткими лініями. Немає нейронних вузлів, тріщин або стигматизувальних мотивів. Лінії з’являються послідовно та стабілізуються; це інша композиція й інший характер руху.

### Чим дерматолог відрізняється від загального пошуку

Усередині лінзи видно поверхневу лінію, два хвилясті шари та дві маленькі точки. Зразок вкладено в групу лупи, тому він рухається разом з інструментом, а не залишається поза лінзою. Шари підсвічуються послідовно, одна точка дає коротку реакцію. Реалістичних уражень немає.

### Чому залишено скальпель

Обрано один інструмент, а не змішано ножиці зі скальпелем. Руків’я скорочено, шийку і розширене вигнуте лезо відділено, відблиск локалізовано на металевій частині. Це зберігає зв’язок із v27 та робить силует виразнішим. Вигляд перевірено в реальному Chromium на компонентному стенді й на оптичному атласі 24/32/40/48 px; окремого дослідження впізнаваності з лікарями не проводилося.

### Стоматолог та інші символи

Замкнено верхній контур коронки зуба; збережено тонкий відблиск і внутрішню лінію без зірки або emoji-обличчя. У ЛОР скориговано край хвилі й прибрано ненормалізований `stroke-dasharray`, який перетворював її на пунктир. Вдалі композиції терапевта, невролога й офтальмолога не перепроєктовувалися.

## 5. Motion lifecycle та доступність

`ClinicalMotion` лишився React-компонентом життєвого циклу. Його DOM-контролер виділено в окремий presentation-only файл, щоб тестувати фактичні події без підміни логіки застосунку.

Одночасно активна одна картка або емблема. Pointer-перехід між іконкою, текстом і стрілкою всередині тієї самої картки не перезапускає послідовність. Повторний справжній вхід запускає її знову. Після природного завершення найдовшої активної CSS-анімації маркер очищається; завершення короткої Signature не обриває основний рух.

Ранній вихід дає м’яке повернення 180 мс. Новий target, blur, pointercancel, приховування документа, reduced-motion change, демонтаж компонента й видалення активного DOM-вузла очищають стан. `MutationObserver` потрібен лише для випадку видалення картки до animationend. Таймерів, storage, нових мережевих запитів та перехоплення клінічних дій немає.

Touch не вимагає подвійного натискання: перший tap може дати motion feedback, але звичайний click приймається одразу. Enter/Space не чекають завершення анімації. Це перевірка прийняття нативної події у стенді, не підтвердження реального переходу в статтю.

Стрілка має opacity 0.3 у спокої / 0.5 при взаємодії та зсув максимум 2 px, без bounce і довгої анімації. Clinical Signature — короткий м’ятно-латунний штрих 14 px, що одноразово проходить по плашці за 1100 мс; це не смуга накопичувального прогресу.

При `prefers-reduced-motion: reduce` основні transform/pulse/stroke-dash-послідовності та Signature вимкнені, JS-повернення не запускається, стрілка не рухається. Залишаються статичні SVG, зміна кольору/плашки/межі й visible focus. Декоративні SVG приховані від accessibility tree; текстові назви не прибрано. Контролер не створює live regions.

**Межа:** це не сертифікація WCAG 2.1 AA всього застосунку. Не виконано повний contrast/screen-reader audit, VoiceOver/NVDA або Firefox/Safari/iOS перевірку.

## 6. Edition ticker: причина та виправлення

У вихідному `app/page.tsx` `<EditionTicker />` знаходився всередині `showDashboard ? ...`, тому не рендерився на стартовому екрані. Тепер виклик знаходиться одразу після `</header>` і до цієї умови — на головному та в workspace.

Текст: «Наказ МОУ №402: у корпусі навігатора — редакція від [EDITION] · остання перевірка офіційного джерела: [CHECK_DATE] · Відкрити джерело».

З оригінальних метаданих без змін підставляються **22.08.2025** і **09.09.2026** відповідно. До дати перевірки додано пояснення, що це записана дата метаданих, не перевірка в реальному часі. **У цій роботі чинність редакції та достовірність історичної перевірки повторно не перевірялися.** Файли `lib/vlk-edition.ts`, `lib/vlk-source-check.ts` та офіційний href не змінювалися.

Рухому стрічку замінено статичним повним переносом в обох темах. Це свідомий вибір читабельності: немає очікування прокрутки або другого дубльованого тексту, тому hover/focus/reduced motion не повинні зупиняти рух, якого вже немає. Блок має `role="region"` і назву, не `role="status"`; focusable залишається тільки посилання. Посилання має мінімум 44 px по висоті та видиму рамку фокусу.

**Що підтверджено:** безумовне місце в реальній JSX-розмітці та видимість/повний текст у компонентному браузерному стенді. **Що не підтверджено:** геометрія реального sticky-header, workspace, mobile tabs і overlay після повної React hydration — це треба перевірити після встановлення залежностей.

## 7. Перевірки команд у чистій директорії

Середовище: Node 22.16.0, npm 10.9.2. Вихідні файли копіювалися у чисту директорію без node_modules, build-артефактів та npm-cache. Нижче наведено фактично виконані команди, а не прогноз.

| Команда | Результат | Exit | Причина |
|---|---|---:|---|
| `npm ci` | BLOCKED | -9 | Обмежену повторну спробу припинено через timeout 12 с; залежності не встановлено |
| `npm run lint` | BLOCKED | 127 | `eslint: not found` після невдалої інсталяції |
| `npm run build` | BLOCKED | 69 | `vinext is unavailable` |
| `npm run build:next` | BLOCKED | 127 | `next: not found` |
| `npm test` | BLOCKED | 69 | Зупинився на build-пререквізиті; повний тестовий етап не стартував |

Попередні npm debug-логи тієї самої сесії зафіксували запити до `registry.npmjs.org`, що завершилися `EAI_AGAIN`. Повторна чиста спроба була обмежена за часом; -9 є результатом примусового завершення перевіряльником, не штатним exit npm і не доказом помилки вихідного коду.

`package.json` уже містив `--experimental-strip-types`, тому його не змінено. Новий regression-тест справді імпортує `clinical-motion-controller.ts` під Node 22.16.0 через той самий механізм і проходить. `ERR_UNKNOWN_FILE_EXTENSION` у виконаній source-підмножині не виник. Нативне видалення типів не замінює повну перевірку типізації.

## 8. Фактично виконані локальні тести

| Перевірка | Результат | Межа |
|---|---|---|
| `vlk-redesign` + `vlk-clinical-polish` | 34/34 PASS; exit 0 | Входять у source-only підмножину, не додавати до 127 як незалежний total |
| Source-only підмножина | 127/127 PASS; exit 0 | Без трьох build/runtime-залежних файлів, перелічених нижче |
| Розширена підмножина з offline-тестами | 135 PASS, 1 FAIL / 136; exit 1 | Немає build-generated `dist/client/offline-manifest.json` |
| Та сама розширена підмножина у baseline v27 | 120 PASS, 1 FAIL / 121; exit 1 | Та сама відсутність маніфесту; не нова source-регресія |
| Strict typecheck окремого DOM-контролера | PASS; exit 0 | Global TypeScript 5.8.3, DOM libs, без сторонніх типів; не весь проєкт |
| Syntax parse | 208 TS/TSX + 2 CSS, PASS; exit 0 | TS 5.8.3 / PostCSS 8.5.6; не module resolution чи semantic typecheck |
| SHA-256 protected comparison | 146/146 ідентичні | Порівняння до файлів оригінального ZIP |
| `app/page.tsx` exact diff | PASS | Весь файл дорівнює baseline плюс лише дві дозволені render-заміни |

Source-only команда:

```bash
node --experimental-strip-types --test $(find tests -maxdepth 1 -name '*.test.mjs' \
  ! -name 'rendered-html.test.mjs' \
  ! -name 'ui-components.test.mjs' \
  ! -name 'vlk-offline.test.mjs' | sort)
```

Окремо `vlk-offline.test.mjs` включено в розширений запуск, де відповідна build-залежність чесно залишилася FAIL. Тести не видалено, не пропущено через `test.skip` та не змінено для приховування цього результату. Всі старі test-файли, крім design regression, побайтово незмінні. У design regression помилковий implicit-live `status` замінено перевіркою labelled region без live-announcement; жодного нормативного інваріанта не ослаблено.

## 9. Реальний браузер: що саме відкривалось

Chromium **144.0.7559.96**, headless, Playwright. Відкривався source-derived компонентний HTML-стенд через `page.set_content`.

У стенді використано фактичні SVG-компоненти, JSX карток із `app/page.tsx`, метадані, оновлені CSS і фактичний DOM-контролер без змін. Водночас JSX перетворювався тестовим stateless renderer, а не React; іконки Lucide для стрілки/метаданих та next/image мали тестові заміни. Оболонка стенда не є справжнім header/workspace. Tailwind компілювався глобальною 4.1.10, тоді як lockfile проєкту містить 4.2.1; відсутній tw-animate-css не підвантажувався у стенд. Це явно підписано у видимому інтерфейсі.

### Interaction: 63/63 PASS

Перевірено всі 8 іконок, тривалості та одноразовість; Signature не обриває основну послідовність; ранній feedback; незмінність картки; природне завершення й повторний hover; швидкий перехід; перехід між дочірніми елементами; вихід до завершення; Tab/focus, Enter/Space; прийняття одного touch tap; reduced motion та його зміна під час руху; blur; видалення активного вузла; одноразова емблема й teardown. У цьому запуску — 0 JavaScript page errors.

### Layout: 16/16 комбінацій PASS

У кожній комбінації: 8 карток; відсутність горизонтального overflow сторінки; targets ≥44 px; збіг геометрії та offsets з baseline; потрібні розміри іконок; видимий статичний ticker; доступний source link; окремі записані дати.

| Viewport | Тема | Компонентний результат |
|---|---|---|
| 360x844 | light | PASS |
| 360x844 | dark | PASS |
| 390x844 | light | PASS |
| 390x844 | dark | PASS |
| 430x932 | light | PASS |
| 430x932 | dark | PASS |
| 768x1024 | light | PASS |
| 768x1024 | dark | PASS |
| 1024x768 | light | PASS |
| 1024x768 | dark | PASS |
| 1280x800 | light | PASS |
| 1280x800 | dark | PASS |
| 1440x1024 | light | PASS |
| 1440x1024 | dark | PASS |
| 1920x1080 | light | PASS |
| 1920x1080 | dark | PASS |

Порівняння геометрії виконувалося після двох animation frames; колірні переходи перед скріншотами завершувались. Оптичний атлас перевірено при 24/32/40/48 px. PNG для desktop/mobile, light/dark зроблено зі справжнього Chromium, а не з mockup або генератора зображень.

**200%:** виконано Chromium CSS `zoom: 2` при viewport 1440×1024; 8 карток і ticker видимі, горизонтального overflow сторінки немає. Це proxy для масштабування, **не нативний browser-toolbar zoom**. Відповідна вимога ТЗ закрита частково, а не повністю.

**Не перевірено у запущеному застосунку:** React hydration, реальне відкриття статті, пошук, картка пункту, зведення/кошик, ТДВ-overlay, auth, persistence, service-worker/offline, deployment. Їхній код не змінювався, але незмінність коду не дорівнює успішному runtime QA.

## 10. Передані візуальні матеріали

Окремо від source ZIP передаються:

- `VLK-v27.1-isolated-component-preview.html` — локальний інтерактивний preview саме компонентів, не застосунок для деплою.
- `component-1440-light.png`, `component-1440-dark.png` — desktop-компоненти.
- `component-390-light.png`, `component-390-dark.png` — mobile-компоненти.
- `component-css-zoom-200.png` — proxy-перевірка масштабування.

Назви у цьому розділі описують окремі артефакти видачі, вони не є runtime-assets проєкту. Preview і скріншоти не входять до source ZIP і не повинні підмінювати app/page.tsx.

## 11. Захищені файли

Побайтово звірено 146 захищених файлів (із них 116 у `lib/`) SHA-256 до baseline-архіву. Без змін: нормативний корпус, правила результатів, specialty mapping, МКХ, ТДВ, пояснення, пошук, local storage, worker, DB, офіційні посилання, source metadata, service-worker та конфігурації. Жодного protected mismatch.

`app/page.tsx` перевірено додатково цілком: він ідентичний оригіналу після застосування тільки перенесення `<EditionTicker />` і додавання `specialty-card-heading`. Це виключає приховані зміни handlers, умов придатності, кошика, сесії або мапінгу в цьому файлі.

Повний перелік побайтово незмінних protected-файлів:

```text
.openai/hosting.json
app/layout.tsx
app/manifest.ts
build/sites-vite-plugin.ts
components/sw-register.tsx
db/index.ts
db/schema.ts
drizzle.config.ts
hooks/use-mobile.ts
lib/diagnosis-aliases.ts
lib/explanations/article-1.ts
lib/explanations/article-10.ts
lib/explanations/article-11.ts
lib/explanations/article-12.ts
lib/explanations/article-13.ts
lib/explanations/article-14.ts
lib/explanations/article-15.ts
lib/explanations/article-16.ts
lib/explanations/article-17.ts
lib/explanations/article-18.ts
lib/explanations/article-19.ts
lib/explanations/article-2.ts
lib/explanations/article-20.ts
lib/explanations/article-21.ts
lib/explanations/article-22.ts
lib/explanations/article-23.ts
lib/explanations/article-24.ts
lib/explanations/article-25.ts
lib/explanations/article-26.ts
lib/explanations/article-27.ts
lib/explanations/article-28.ts
lib/explanations/article-29.ts
lib/explanations/article-3.ts
lib/explanations/article-30.ts
lib/explanations/article-31.ts
lib/explanations/article-32.ts
lib/explanations/article-33.ts
lib/explanations/article-34.ts
lib/explanations/article-35.ts
lib/explanations/article-36.ts
lib/explanations/article-37.ts
lib/explanations/article-38.ts
lib/explanations/article-39.ts
lib/explanations/article-4.ts
lib/explanations/article-40.ts
lib/explanations/article-41.ts
lib/explanations/article-42.ts
lib/explanations/article-43.ts
lib/explanations/article-44.ts
lib/explanations/article-45.ts
lib/explanations/article-46.ts
lib/explanations/article-47.ts
lib/explanations/article-48.ts
lib/explanations/article-49.ts
lib/explanations/article-5.ts
lib/explanations/article-50.ts
lib/explanations/article-51.ts
lib/explanations/article-52.ts
lib/explanations/article-53.ts
lib/explanations/article-54.ts
lib/explanations/article-55.ts
lib/explanations/article-56.ts
lib/explanations/article-57.ts
lib/explanations/article-58.ts
lib/explanations/article-59.ts
lib/explanations/article-6.ts
lib/explanations/article-60.ts
lib/explanations/article-61.ts
lib/explanations/article-62.ts
lib/explanations/article-63.ts
lib/explanations/article-64.ts
lib/explanations/article-65.ts
lib/explanations/article-66.ts
lib/explanations/article-67.ts
lib/explanations/article-68.ts
lib/explanations/article-69.ts
lib/explanations/article-7.ts
lib/explanations/article-70.ts
lib/explanations/article-71.ts
lib/explanations/article-72.ts
lib/explanations/article-73.ts
lib/explanations/article-74.ts
lib/explanations/article-75.ts
lib/explanations/article-76.ts
lib/explanations/article-77.ts
lib/explanations/article-78.ts
lib/explanations/article-79.ts
lib/explanations/article-8.ts
lib/explanations/article-80.ts
lib/explanations/article-81.ts
lib/explanations/article-82.ts
lib/explanations/article-83.ts
lib/explanations/article-84.ts
lib/explanations/article-85.ts
lib/explanations/article-86.ts
lib/explanations/article-87.ts
lib/explanations/article-9.ts
lib/explanations/index.ts
lib/explanations/types.ts
lib/utils.ts
lib/vlk-anchors.ts
lib/vlk-clipboard.ts
lib/vlk-edition-monitor.ts
lib/vlk-edition.ts
lib/vlk-explanation-tables.ts
lib/vlk-explanation-view.ts
lib/vlk-explanations.ts
lib/vlk-graphs.ts
lib/vlk-highlight.ts
lib/vlk-links.ts
lib/vlk-local-storage.ts
lib/vlk-official-articles.ts
lib/vlk-outcomes.ts
lib/vlk-provenance.ts
lib/vlk-report.ts
lib/vlk-rules.ts
lib/vlk-sample-data.ts
lib/vlk-search-history.ts
lib/vlk-search.ts
lib/vlk-selection.ts
lib/vlk-session.ts
lib/vlk-source-check.ts
lib/vlk-tdv-general.ts
lib/vlk-tdv.ts
lib/vlk-workspace.ts
next.config.ts
package-lock.json
package.json
public/favicon.svg
public/file.svg
public/globe.svg
public/sw.js
public/vlk-command-emblem.png
public/vlk-command-header.png
public/window.svg
scripts/audit-source.mjs
scripts/audit-source.py
scripts/build-verified.sh
scripts/check-vlk-edition.mjs
scripts/generate-offline-manifest.mjs
scripts/install-ci.sh
scripts/sites-env.sh
tsconfig.json
vercel.json
vite.config.ts
worker/index.ts
```

## 12. Залишені ризики та наступна перевірка

Production-критерій готовності залишається відкритим через невстановлені залежності. Ізольований стенд з іншою версією Tailwind не гарантує ідентичний результат locked production build. Перенесений ticker додає видимий рядок на головній, тому повний layout зі sticky header/mobile tabs треба звірити у реальному застосунку. Глобальний strict check охопив лише новий контролер, не React-інтеграцію або весь TypeScript-проєкт. Нативний 200% zoom, Safari/iOS, Firefox, реальний screen reader і комплексний contrast audit не виконані.

У середовищі з доступом до npm registry виконати з кореня розпакованого ZIP, використовуючи Node з project engines:

```bash
npm ci
npm run lint
npm run build
npm run build:next
npm test
```

Лише після exit 0 усіх команд запустити реальну Next production-збірку (`npm run start:next`) та пройти головна → спеціальність → стаття → пошук → кошик → ТДВ, обидві теми, mobile, keyboard, native zoom і offline. Не вважати цей ZIP підтверджено готовим до production лише на підставі source-тестів або компонентних скріншотів.

## 13. Пакування

ZIP містить вихідні файли, lockfile, існуючі runtime/deploy-конфігурації, тести та цей QA-звіт. Виключаються node_modules, .next, dist, .sites-runtime, .wrangler, .git, тимчасові логи/кеші, .env*, вкладені ZIP і build-артефакти. Існуючі виконувані права shell-скриптів зберігаються. Цілісність ZIP і наявність protected-файлів додатково перевіряються після пакування; hash фінального ZIP подано окремо з артефактом.
