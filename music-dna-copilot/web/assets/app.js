// Music DNA Copilot 3.3 — web app (vanilla ES modules, no build step, no dependencies)
//
// Simple on purpose: four sections (Home, My taste, Music, Settings), one clear
// action per screen, plain words in Russian, Ukrainian or English.
// Loop: add your music → see your taste → pick a mood → listen → react → taste learns.
// Every number on screen comes from /api/v3; missing data renders as an empty state.

/* ------------------------------------------------------------------ language */
const LANGS = ["ru", "uk", "en"];
const IX = { en: 0, ru: 1, uk: 2 };
function detectLang() {
  try { const v = localStorage.getItem("mdna-lang"); if (LANGS.includes(v)) return v; } catch { /* storage blocked */ }
  const n = String(navigator.language || "en").slice(0, 2).toLowerCase();
  return n === "uk" ? "uk" : ["ru", "be", "kk"].includes(n) ? "ru" : "en";
}
let LANG = detectLang();

// key: [en, ru, uk]. {name} placeholders are filled from `vars`.
const TX = {
  // shell
  nav_home: ["Home", "Главная", "Головна"], nav_dna: ["My taste", "Мой вкус", "Мій смак"],
  nav_music: ["My music", "Моя музыка", "Моя музика"], nav_settings: ["Settings", "Настройки", "Налаштування"],
  skip: ["Skip to content", "К содержимому", "До вмісту"], local_foot: ["Everything stays on this computer", "Всё хранится только на этом компьютере", "Усе зберігається лише на цьому комп'ютері"],
  loading: ["Loading…", "Загрузка…", "Завантаження…"], cancel: ["Cancel", "Отмена", "Скасувати"], confirm: ["Confirm", "Подтвердить", "Підтвердити"],
  back_home: ["Back home", "На главную", "На головну"], went_wrong: ["Something went wrong", "Что-то пошло не так", "Щось пішло не так"],
  not_found: ["Page not found", "Страница не найдена", "Сторінку не знайдено"], not_found_t: ["That page doesn't exist.", "Такой страницы нет.", "Такої сторінки немає."],
  offline_title: ["Can't reach the app", "Приложение не отвечает", "Застосунок не відповідає"],
  offline_msg: ["The local Music DNA server isn't responding. Is it still running?", "Программа Music DNA не отвечает. Она всё ещё запущена?", "Програма Music DNA не відповідає. Вона ще запущена?"],
  status_msg: ["The app answered with status {s}.", "Приложение ответило с ошибкой {s}.", "Застосунок відповів з помилкою {s}."],
  offline_toast: ["You're offline. Everything still works except connecting services.", "Нет интернета. Всё работает, кроме подключения сервисов.", "Немає інтернету. Усе працює, крім підключення сервісів."],
  saved: ["Saved.", "Сохранено.", "Збережено."], done: ["Done.", "Готово.", "Готово."],
  copied: ["Copied.", "Скопировано.", "Скопійовано."], copy: ["Copy", "Копировать", "Копіювати"],
  copy_fail: ["Select the address and copy it manually.", "Выдели адрес и скопируй вручную.", "Виділи адресу й скопіюй вручну."],
  just_now: ["just now", "только что", "щойно"], min_ago: ["{n} min ago", "{n} мин назад", "{n} хв тому"],
  h_ago: ["{n} h ago", "{n} ч назад", "{n} год тому"], d_ago: ["{n} days ago", "{n} дн. назад", "{n} дн. тому"], never: ["never", "никогда", "ніколи"],
  // demo
  demo: ["Example", "Пример", "Приклад"],
  demo_notice: ["This is an example, not your music.", "Это пример, а не твоя музыка.", "Це приклад, а не твоя музика."],
  demo_link: ["Add your own music", "Добавить свою музыку", "Додати свою музику"],
  // onboarding
  ob_eyebrow: ["Music DNA", "Music DNA", "Music DNA"],
  ob_title: ["Find out your<br>music taste.", "Узнай свой<br>музыкальный вкус.", "Дізнайся свій<br>музичний смак."],
  ob_lead: ["Show the app what you listen to. It works out your taste and picks music for any mood. Everything stays on this computer.",
    "Покажи программе, что ты слушаешь. Она поймёт твой вкус и будет подбирать музыку под любое настроение. Всё остаётся на этом компьютере.",
    "Покажи програмі, що ти слухаєш. Вона зрозуміє твій смак і добиратиме музику під будь-який настрій. Усе залишається на цьому комп'ютері."],
  ob_start: ["Get started", "Начать", "Почати"], ob_skip: ["Go to my taste", "Перейти к моему вкусу", "Перейти до мого смаку"],
  ob_free: ["Free · no account · works offline", "Бесплатно · без регистрации · без интернета", "Безкоштовно · без реєстрації · без інтернету"],
  ob_src_title: ["Where do you listen to music?", "Где ты слушаешь музыку?", "Де ти слухаєш музику?"],
  ob_src_lead: ["Pick one way. You can add more later.", "Выбери один способ. Потом можно добавить ещё.", "Обери один спосіб. Потім можна додати ще."],
  ob_demo_t: ["Just try it on an example", "Просто попробовать на примере", "Просто спробувати на прикладі"],
  ob_demo_d: ["See how it works in 5 seconds. Your music can be added later.", "Посмотри, как это работает, за 5 секунд. Свою музыку добавишь потом.", "Подивися, як це працює, за 5 секунд. Свою музику додаси потім."],
  ob_ready: ["Music added: {n}. Ready to go!", "Добавлено источников: {n}. Можно начинать!", "Додано джерел: {n}. Можна починати!"],
  ob_go: ["Show my taste", "Показать мой вкус", "Показати мій смак"],
  an_title: ["Listening to your music…", "Слушаю твою музыку…", "Слухаю твою музику…"],
  an_lead: ["Everything happens on this computer.", "Всё происходит на этом компьютере.", "Усе відбувається на цьому комп'ютері."],
  an_working: ["Working…", "Работаю…", "Працюю…"], an_reveal: ["Show the result", "Показать результат", "Показати результат"],
  an_check: ["Check my music", "Проверить мою музыку", "Перевірити мою музику"],
  rv_eyebrow: ["Your taste", "Твой вкус", "Твій смак"], rv_first: ["Pick music for me", "Подобрать мне музыку", "Добрати мені музику"],
  rv_explore: ["Look at my taste", "Посмотреть мой вкус", "Подивитися мій смак"],
  f_genres: ["Favourite genres", "Любимые жанры", "Улюблені жанри"], f_artists: ["Favourite artists", "Любимые артисты", "Улюблені артисти"],
  f_style: ["How you listen", "Как ты слушаешь", "Як ти слухаєш"],
  st_explorer: ["You love discovering new music", "Любишь открывать новое", "Любиш відкривати нове"],
  st_loyal: ["You return to favourites", "Возвращаешься к любимому", "Повертаєшся до улюбленого"],
  st_balanced: ["A mix of favourites and new", "И любимое, и новое", "І улюблене, і нове"],
  st_unknown: ["Not enough data yet", "Пока мало данных", "Поки замало даних"],
  // stats
  n_plays: ["plays", "прослушиваний", "прослуховувань"], n_tracks: ["tracks", "треков", "треків"], n_artists: ["artists", "артистов", "артистів"],
  n_sources: ["sources", "источников", "джерел"],
  // home
  hi_title: ["Your taste", "Твой вкус", "Твій смак"], updated: ["updated {t}", "обновлено {t}", "оновлено {t}"],
  more_taste: ["More about my taste", "Подробнее о вкусе", "Докладніше про смак"],
  resume_t: ["You have an unfinished mix", "У тебя есть недослушанная подборка", "У тебе є недослухана добірка"],
  resume_b: ["Continue", "Продолжить", "Продовжити"],
  pick_title: ["Pick music", "Подобрать музыку", "Добрати музику"],
  pick_mood: ["What's the mood?", "Под какое настроение?", "Під який настрій?"],
  pick_new: ["How much new music?", "Сколько нового?", "Скільки нового?"],
  pick_go: ["Pick music", "Подобрать", "Добрати"], pick_busy: ["Picking…", "Подбираю…", "Добираю…"],
  custom_ph: ["Or describe it: “rainy sunday reading”", "Или опиши словами (по-английски): “rainy sunday reading”", "Або опиши словами (англійською): “rainy sunday reading”"],
  past: ["Past mixes", "Прошлые подборки", "Минулі добірки"], past_n: ["{n} so far", "всего: {n}", "усього: {n}"],
  no_music_t: ["No music yet", "Музыки пока нет", "Музики поки немає"],
  no_music_d: ["Add your music (or try the example) to see your taste.", "Добавь свою музыку (или попробуй пример), чтобы узнать свой вкус.", "Додай свою музику (або спробуй приклад), щоб дізнатися свій смак."],
  add_music: ["Add music", "Добавить музыку", "Додати музику"],
  stale: ["No music is connected any more. Your taste still shows the old data.", "Музыка больше не подключена. Вкус показывает старые данные.", "Музику більше не підключено. Смак показує старі дані."],
  // DNA page
  dna_title: ["My taste", "Мой вкус", "Мій смак"],
  dna_lead: ["The bigger and closer a circle, the more you listen to that style. Tap a circle to see its artists.",
    "Чем ближе и крупнее круг, тем больше ты слушаешь этот стиль. Нажми на круг, чтобы увидеть артистов.",
    "Що ближче й більше коло, то більше ти слухаєш цей стиль. Натисни на коло, щоб побачити артистів."],
  refresh_taste: ["Update", "Обновить", "Оновити"], refreshing: ["Updating…", "Обновляю…", "Оновлюю…"],
  refreshed: ["Your taste is up to date.", "Вкус обновлён.", "Смак оновлено."],
  top_genres: ["Top genres", "Главные жанры", "Головні жанри"], top_artists: ["Top artists", "Главные артисты", "Головні артисти"],
  focus_hint: ["Tap a circle on the map to see its genres and artists.", "Нажми на круг на карте, чтобы увидеть жанры и артистов.", "Натисни на коло на карті, щоб побачити жанри й артистів."],
  focus_strong: ["You listen to <b>{f}</b> most, especially {g}.", "Больше всего ты слушаешь <b>{f}</b>, особенно {g}.", "Найбільше ти слухаєш <b>{f}</b>, особливо {g}."],
  genres: ["Genres", "Жанры", "Жанри"], micro: ["Niche styles", "Узкие стили", "Вузькі стилі"], artists: ["Artists", "Артисты", "Артисти"],
  none: ["None yet", "Пока нет", "Поки немає"], map: ["Map", "Карта", "Мапа"], list: ["List", "Список", "Список"],
  details: ["Details", "Подробности", "Подробиці"],
  changes_t: ["What changed recently", "Что изменилось недавно", "Що змінилося нещодавно"],
  changes_none: ["Nothing yet. Rate tracks in your mixes and your taste will learn.", "Пока ничего. Оценивай треки в подборках, и вкус будет учиться.", "Поки нічого. Оцінюй треки в добірках, і смак навчатиметься."],
  core_t: ["Long-term taste", "Вкус в целом", "Смак загалом"],
  core_d: ["Built from all your listening. Changes slowly.", "Собран из всех прослушиваний. Меняется медленно.", "Зібрано з усіх прослуховувань. Змінюється повільно."],
  now_t: ["Today", "Сегодня", "Сьогодні"],
  now_empty: ["Rate a few tracks and this updates right away.", "Оцени пару треков, и тут сразу появится результат.", "Оціни кілька треків, і тут одразу з'явиться результат."],
  now_from: ["From {n} ratings in the last {h} hours.", "По {n} оценкам за последние {h} ч.", "За {n} оцінками за останні {h} год."],
  measures: ["Measures", "Показатели", "Показники"], not_enough: ["Not enough data", "Мало данных", "Замало даних"],
  dim_genre: ["Genres", "Жанры", "Жанри"], dim_micro: ["Niche styles", "Узкие стили", "Вузькі стилі"], dim_artist: ["Artists", "Артисты", "Артисти"],
  dim_fam: ["Favourites vs new", "Любимое или новое", "Улюблене чи нове"], dim_nov: ["Variety", "Разнообразие", "Різноманітність"],
  dim_disc: ["Openness to new music", "Открытость новому", "Відкритість новому"], dim_main: ["Mainstream or niche", "Популярное или редкое", "Популярне чи рідкісне"],
  dim_shift: ["Recent shift", "Недавние перемены", "Нещодавні зміни"], dim_ctx: ["By situation", "По ситуациям", "За ситуаціями"],
  lo_new: ["New", "Новое", "Нове"], hi_rep: ["Repeats", "Повторы", "Повтори"], lo_fam: ["Same", "Одно и то же", "Одне й те саме"], hi_nov: ["Varied", "Разное", "Різне"],
  lo_close: ["Stays close", "Держится рядом", "Тримається поруч"], hi_far: ["Goes far", "Уходит далеко", "Йде далеко"],
  lo_main: ["Popular", "Популярное", "Популярне"], hi_niche: ["Niche", "Редкое", "Рідкісне"],
  learned_t: ["Learned from your ratings", "Выучено по твоим оценкам", "Вивчено з твоїх оцінок"],
  // capsule
  mix: ["Mix", "Подборка", "Добірка"], mystery_mix: ["Surprise mix", "Подборка-сюрприз", "Добірка-сюрприз"],
  n_of_rated: ["Rated {d} of {t}", "Оценено {d} из {t}", "Оцінено {d} з {t}"],
  small_pool: ["Only {n} tracks fit this time.", "В этот раз подошло только {n} треков.", "Цього разу підійшло лише {n} треків."],
  match: ["match", "совпадение", "збіг"], current: ["now playing", "сейчас", "зараз"],
  other_services: ["Other services", "Другие сервисы", "Інші сервіси"],
  fb_love: ["Like", "Нравится", "Подобається"], fb_skip: ["Skip", "Пропустить", "Пропустити"], fb_no: ["Not for me", "Не моё", "Не моє"],
  fb_more: ["More", "Ещё", "Ще"], fb_save: ["Save", "Сохранить", "Зберегти"], fb_completed: ["Listened to the end", "Дослушал", "Дослухав"],
  fb_replay: ["Played again", "Послушал ещё раз", "Послухав ще раз"], fb_mlt: ["More like this", "Больше такого", "Більше такого"],
  fb_similar: ["Too similar", "Слишком похоже", "Занадто схоже"], fb_strange: ["Too strange", "Слишком странно", "Занадто дивно"],
  fbd_love: ["Liked", "Нравится", "Подобається"], fbd_save: ["Saved", "Сохранено", "Збережено"], fbd_completed: ["Listened", "Дослушал", "Дослухав"],
  fbd_replay: ["Played again", "Послушал ещё раз", "Послухав ще раз"], fbd_skip: ["Skipped", "Пропущено", "Пропущено"], fbd_no: ["Not for me", "Не моё", "Не моє"],
  why: ["Why this track?", "Почему этот трек?", "Чому цей трек?"],
  inferred: ["Genres for this track were guessed from the artist.", "Жанры угаданы по артисту.", "Жанри вгадано за артистом."],
  reveal: ["Show track", "Показать трек", "Показати трек"], reveal_note: ["Or just rate it: any rating reveals it.", "Или просто оцени: любая оценка его откроет.", "Або просто оціни: будь-яка оцінка його відкриє."],
  hidden_track: ["Hidden track {n}", "Скрытый трек {n}", "Прихований трек {n}"], hidden_t: ["TRACK {n}", "ТРЕК {n}", "ТРЕК {n}"],
  hidden_a: ["???", "???", "???"],
  k_match: ["Match", "Совпадение", "Збіг"], k_dist: ["How new", "Насколько ново", "Наскільки нове"], k_ctx: ["Fits the mood", "Под настроение", "Під настрій"],
  finish: ["Finish", "Завершить", "Завершити"], close_mix: ["Close", "Закрыть", "Закрити"],
  close_q: ["Close this mix?", "Закрыть подборку?", "Закрити добірку?"],
  close_d: ["You haven't rated any tracks. It will stay in your past mixes.", "Ты не оценил ни одного трека. Подборка останется в истории.", "Ти не оцінив жодного треку. Добірка залишиться в історії."],
  complete: ["Mix finished", "Подборка готова", "Добірку завершено"], closed: ["Mix closed", "Подборка закрыта", "Добірку закрито"],
  c_liked: ["liked or saved", "понравилось", "сподобалося"], c_listened: ["listened", "дослушано", "дослухано"], c_skipped: ["skipped", "пропущено", "пропущено"],
  c_rejected: ["not for me", "не моё", "не моє"], c_learned: ["What your taste learned", "Чему научился твой вкус", "Чого навчився твій смак"],
  next_mix: ["Another mix", "Ещё подборку", "Ще добірку"], see_taste: ["See my taste", "Посмотреть вкус", "Подивитися смак"],
  // history
  hist_title: ["Past mixes", "Прошлые подборки", "Минулі добірки"], hist_lead: ["Every mix you opened and what you thought of it.", "Все подборки и твои оценки.", "Усі добірки та твої оцінки."],
  hist_empty: ["No mixes yet", "Подборок пока нет", "Добірок поки немає"], hist_empty_d: ["Your first mix will appear here.", "Здесь появится твоя первая подборка.", "Тут з'явиться твоя перша добірка."],
  discoveries: ["New discoveries", "Новые открытия", "Нові відкриття"],
  disc_none: ["Like a track by an artist you didn't know, and it shows up here.", "Понравится трек нового для тебя артиста, и он появится здесь.", "Сподобається трек нового для тебе артиста, і він з'явиться тут."],
  h_rated: ["rated {r} of {t}", "оценено {r} из {t}", "оцінено {r} з {t}"], export: ["Download", "Скачать", "Завантажити"],
  st_opened: ["open", "открыта", "відкрита"], st_started: ["in progress", "слушаю", "слухаю"], st_completed: ["finished", "готова", "завершена"], st_abandoned: ["closed", "закрыта", "закрита"],
  // music (sources)
  mu_title: ["My music", "Моя музыка", "Моя музика"],
  mu_lead: ["Where your listening history comes from. The more you add, the better the picks.", "Откуда берётся твоя история прослушиваний. Чем больше добавишь, тем точнее подборки.", "Звідки береться твоя історія прослуховувань. Що більше додаси, то точніші добірки."],
  mu_connected: ["Added", "Добавлено", "Додано"], mu_add: ["Add music", "Добавить музыку", "Додати музику"],
  mu_way1: ["By user name", "По имени пользователя", "За ім'ям користувача"],
  mu_way1_d: ["The quickest way if you use Last.fm or ListenBrainz.", "Самый быстрый способ, если у тебя есть Last.fm или ListenBrainz.", "Найшвидший спосіб, якщо в тебе є Last.fm або ListenBrainz."],
  mu_way2: ["From a file", "Из файла", "З файлу"],
  mu_way2_d: ["Any service lets you download your listening history as a file. Choose the service, then the file.", "Любой сервис позволяет скачать историю прослушиваний файлом. Выбери сервис, потом файл.", "Будь-який сервіс дозволяє завантажити історію прослуховувань файлом. Обери сервіс, потім файл."],
  mu_way3: ["Connect an account", "Подключить аккаунт", "Підключити акаунт"],
  mu_way3_d: ["Spotify, YouTube Music, Deezer and Apple Music need a one-time setup (about 5 minutes). After that, one click.", "Spotify, YouTube Music, Deezer и Apple Music нужно один раз настроить (~5 минут). Потом — в один клик.", "Spotify, YouTube Music, Deezer і Apple Music треба один раз налаштувати (~5 хвилин). Потім — в один клік."],
  service: ["Service", "Сервис", "Сервіс"], choose_file: ["Choose file…", "Выбрать файл…", "Обрати файл…"],
  lb_user: ["ListenBrainz user name", "Имя в ListenBrainz", "Ім'я в ListenBrainz"], lf_user: ["Last.fm user name", "Имя в Last.fm", "Ім'я в Last.fm"],
  lf_key: ["Last.fm API key", "Ключ API Last.fm", "Ключ API Last.fm"],
  lf_key_help: ["Free, takes a minute: last.fm/api/account/create", "Бесплатно, за минуту: last.fm/api/account/create", "Безкоштовно, за хвилину: last.fm/api/account/create"],
  connect: ["Connect", "Подключить", "Підключити"], set_up: ["Set up", "Настроить", "Налаштувати"],
  change_setup: ["Change setup", "Изменить настройку", "Змінити налаштування"], forget_setup: ["Forget setup", "Забыть настройку", "Забути налаштування"],
  save_connect: ["Save and connect", "Сохранить и подключить", "Зберегти й підключити"],
  setup_intro: ["{s} only lets apps you register yourself read your account, so you create a free app once.", "{s} разрешает читать аккаунт только приложениям, которые ты создал сам, поэтому нужно один раз создать бесплатное приложение.", "{s} дозволяє читати акаунт лише застосункам, які ти створив сам, тож треба один раз створити безкоштовний застосунок."],
  open_dev: ["Open the developer page ↗", "Открыть страницу разработчика ↗", "Відкрити сторінку розробника ↗"],
  redirect_reg: ["Address to paste there", "Адрес, который нужно вставить", "Адреса, яку треба вставити"],
  redirect_none: ["Sign-in returns here (nothing to paste)", "Вход вернётся сюда (вставлять ничего не нужно)", "Вхід повернеться сюди (нічого вставляти не треба)"],
  redirect_deezer: ["Application domain / Redirect URL", "Application domain / Redirect URL", "Application domain / Redirect URL"],
  optional: ["optional", "необязательно", "необов'язково"], keep_blank: ["Saved. Leave blank to keep it", "Сохранено. Оставь пустым", "Збережено. Залиш порожнім"],
  stay: ["Stay connected on this computer", "Не выходить на этом компьютере", "Не виходити на цьому комп'ютері"],
  local_only: ["Saved only on this computer. Read-only access.", "Хранится только на этом компьютере. Доступ только на чтение.", "Зберігається лише на цьому комп'ютері. Доступ лише на читання."],
  s_connected: ["Connected", "Подключено", "Підключено"], s_imported: ["From file", "Из файла", "З файлу"], s_ready: ["Ready to connect", "Можно подключать", "Можна підключати"],
  s_setup: ["Setup ~5 min", "Настройка ~5 мин", "Налаштування ~5 хв"],
  as_account: ["as {a}", "как {a}", "як {a}"], plays_n: ["{n} plays", "прослушиваний: {n}", "прослуховувань: {n}"],
  sync: ["Update", "Обновить", "Оновити"], syncing: ["Updating…", "Обновляю…", "Оновлюю…"],
  disconnect: ["Disconnect", "Отключить", "Відключити"], remove: ["Delete data", "Удалить данные", "Видалити дані"],
  more_actions: ["More", "Ещё", "Ще"],
  q_forget: ["Forget {s} setup?", "Забыть настройку {s}?", "Забути налаштування {s}?"],
  q_forget_d: ["The keys and sign-in for this service are deleted from this computer. Your music stays.", "Ключи и вход для этого сервиса удалятся с компьютера. Музыка останется.", "Ключі та вхід для цього сервісу видаляться з комп'ютера. Музика залишиться."],
  q_disc: ["Disconnect {s}?", "Отключить {s}?", "Відключити {s}?"],
  q_disc_d: ["Updates stop. Music you already added stays until you delete it.", "Обновления прекратятся. Добавленная музыка останется, пока ты её не удалишь.", "Оновлення припиняться. Додана музика залишиться, доки ти її не видалиш."],
  q_rm: ["Delete {s} data?", "Удалить данные {s}?", "Видалити дані {s}?"],
  q_rm_d: ["Deletes the copy on this computer. Your account and original file are not touched.", "Удалится копия на этом компьютере. Аккаунт и исходный файл не пострадают.", "Видалиться копія на цьому комп'ютері. Акаунт і вихідний файл не постраждають."],
  t_forgot: ["{s} setup forgotten.", "Настройка {s} удалена.", "Налаштування {s} видалено."], t_disc: ["{s} disconnected.", "{s} отключён.", "{s} відключено."],
  t_removed: ["{s} data deleted.", "Данные {s} удалены.", "Дані {s} видалено."],
  t_import: ["{s}: added {n} plays.", "{s}: добавлено прослушиваний: {n}.", "{s}: додано прослуховувань: {n}."],
  t_connected: ["{s} connected: {n} plays added.", "{s} подключён: добавлено прослушиваний: {n}.", "{s} підключено: додано прослуховувань: {n}."],
  t_synced: ["{s} updated: {n} plays.", "{s} обновлён: прослушиваний: {n}.", "{s} оновлено: прослуховувань: {n}."],
  t_rebuilt: ["Your taste is updated.", "Вкус обновлён.", "Смак оновлено."],
  t_conn_fail: ["{s}: connection didn't finish. Nothing changed; try again.", "{s}: подключение не завершилось. Ничего не изменилось, попробуй ещё раз.", "{s}: підключення не завершилося. Нічого не змінилося, спробуй ще раз."],
  the_service: ["The service", "Сервис", "Сервіс"],
  file_where: ["Where to get the file", "Где взять файл", "Де взяти файл"],
  demo_on: ["You're looking at an example. Add your music below and the app switches to it.", "Сейчас показан пример. Добавь свою музыку ниже, и программа переключится на неё.", "Зараз показано приклад. Додай свою музику нижче, і програма перемкнеться на неї."],
  mu_note: ["Connections only read your history, never change anything. Files stay on this computer.", "Подключения только читают историю и ничего не меняют. Файлы остаются на этом компьютере.", "Підключення лише читають історію й нічого не змінюють. Файли залишаються на цьому комп'ютері."],
  // settings
  set_title: ["Settings", "Настройки", "Налаштування"], language: ["Language", "Язык", "Мова"],
  pref: ["Open tracks in", "Где открывать треки", "Де відкривати треки"],
  pref_d: ["Your music app. If a track isn't found there, a search opens.", "Твоё музыкальное приложение. Если трека там нет, откроется поиск.", "Твій музичний застосунок. Якщо треку там немає, відкриється пошук."],
  privacy_link: ["My data and privacy", "Мои данные и приватность", "Мої дані та приватність"],
  privacy_link_d: ["What is stored, download or delete it", "Что хранится, скачать или удалить", "Що зберігається, завантажити або видалити"],
  replay: ["Show the introduction again", "Показать вступление ещё раз", "Показати вступ ще раз"],
  for_pros: ["For advanced users", "Для опытных", "Для досвідчених"],
  fallbacks: ["If a track isn't there, try next", "Если трека нет, пробовать дальше", "Якщо треку немає, пробувати далі"],
  fb_none: ["Only the main service is used.", "Используется только основной сервис.", "Використовується лише основний сервіс."],
  add: ["Add", "Добавить", "Додати"], rm: ["Remove", "Убрать", "Прибрати"], up: ["Move up", "Выше", "Вище"], down: ["Move down", "Ниже", "Нижче"],
  motion: ["Animation", "Анимация", "Анімація"], motion_d: ["“System” follows your device setting.", "«Как в системе» — по настройке устройства.", "«Як у системі» — за налаштуванням пристрою."],
  m_system: ["System", "Как в системе", "Як у системі"], m_reduced: ["Less", "Меньше", "Менше"], m_full: ["Full", "Полная", "Повна"],
  analytics: ["Local statistics", "Локальная статистика", "Локальна статистика"],
  analytics_d: ["Anonymous usage counters kept on this computer (no titles or artists).", "Анонимные счётчики на этом компьютере (без названий и артистов).", "Анонімні лічильники на цьому комп'ютері (без назв і артистів)."],
  adv_mode: ["Technical details", "Технические подробности", "Технічні подробиці"],
  adv_mode_d: ["Show diagnostics, surprise mixes and the quality lab.", "Показывать диагностику, подборки-сюрпризы и лабораторию качества.", "Показувати діагностику, добірки-сюрпризи та лабораторію якості."],
  adv_link: ["Technical pages", "Технические страницы", "Технічні сторінки"], adv_link_d: ["Quality, statistics, track matching, diagnostics", "Качество, статистика, сопоставление треков, диагностика", "Якість, статистика, зіставлення треків, діагностика"],
  classic: ["Classic version (2.x)", "Классическая версия (2.x)", "Класична версія (2.x)"], classic_d: ["The old interface with many settings", "Старый интерфейс с множеством настроек", "Старий інтерфейс з безліччю налаштувань"],
  // privacy
  pv_title: ["My data and privacy", "Мои данные и приватность", "Мої дані та приватність"],
  pv_lead: ["Exactly what exists, where, and how to remove it.", "Что именно хранится, где и как это удалить.", "Що саме зберігається, де і як це видалити."],
  pv_local: ["What stays on this computer", "Что остаётся на компьютере", "Що залишається на комп'ютері"],
  pv_imported: ["Added files", "Добавленные файлы", "Додані файли"], pv_nothing: ["Nothing added.", "Ничего не добавлено.", "Нічого не додано."],
  pv_stored: ["What is stored", "Что хранится", "Що зберігається"], pv_dna: ["Your taste", "Твой вкус", "Твій смак"],
  pv_not_built: ["Not built", "Не собран", "Не зібрано"], pv_caps: ["Mixes", "Подборки", "Добірки"], pv_fb: ["Ratings", "Оценки", "Оцінки"],
  pv_events: ["Statistics records", "Записи статистики", "Записи статистики"], pv_creds: ["Connection keys", "Ключи подключений", "Ключі підключень"],
  pv_none: ["None saved", "Нет", "Немає"], pv_private: ["private file", "личный файл", "особистий файл"],
  pv_analytics: ["What statistics contain", "Что в статистике", "Що в статистиці"], pv_on: ["On", "Вкл.", "Увімк."], pv_off: ["Off", "Выкл.", "Вимк."],
  pv_never: ["Never:", "Никогда:", "Ніколи:"], pv_local_only: ["only on this computer.", "только на этом компьютере.", "лише на цьому комп'ютері."],
  pv_export: ["Download my data", "Скачать мои данные", "Завантажити мої дані"], pv_export_d: ["As JSON files.", "В виде файлов JSON.", "У вигляді файлів JSON."],
  ex_dna: ["My taste", "Мой вкус", "Мій смак"], ex_hist: ["Mixes", "Подборки", "Добірки"], ex_fb: ["Ratings", "Оценки", "Оцінки"], ex_an: ["Statistics", "Статистика", "Статистика"],
  pv_delete: ["Delete", "Удалить", "Видалити"],
  pv_delete_d: ["Each action asks first. To delete added music, use My music.", "Каждое действие переспросит. Добавленную музыку удаляют в разделе «Моя музыка».", "Кожна дія перепитає. Додану музику видаляють у розділі «Моя музика»."],
  pa_session: ["Forget today's mood", "Забыть сегодняшнее настроение", "Забути сьогоднішній настрій"], pa_session_d: ["Only today's ratings are forgotten.", "Забудутся только сегодняшние оценки.", "Забудуться лише сьогоднішні оцінки."],
  pa_hist: ["Delete past mixes", "Удалить прошлые подборки", "Видалити минулі добірки"], pa_hist_d: ["What the app learned stays.", "Выученное останется.", "Вивчене залишиться."],
  pa_dna: ["Reset my taste", "Сбросить вкус", "Скинути смак"], pa_dna_d: ["Forgets everything learned from your ratings. Your music stays; update your taste afterwards.", "Забудет всё, что выучено по оценкам. Музыка останется, потом обнови вкус.", "Забуде все, що вивчено з оцінок. Музика залишиться, потім онови смак."],
  pa_an: ["Delete statistics", "Удалить статистику", "Видалити статистику"], pa_an_d: ["Deletes local usage counters.", "Удалит локальные счётчики.", "Видалить локальні лічильники."],
  pa_conn: ["Forget all connections", "Забыть все подключения", "Забути всі підключення"],
  pa_conn_d: ["Disconnects every service and deletes saved keys and sign-ins. Your music stays.", "Отключит все сервисы и удалит ключи и входы. Музыка останется.", "Відключить усі сервіси та видалить ключі й входи. Музика залишиться."],
  reset: ["Reset", "Сбросить", "Скинути"], forget: ["Forget", "Забыть", "Забути"],
  // advanced
  adv_title: ["Technical pages", "Технические страницы", "Технічні сторінки"],
  adv_lead: ["Engineering views. They don't change your mixes.", "Инженерные экраны. На подборки не влияют.", "Інженерні екрани. На добірки не впливають."],
  tab_quality: ["Quality", "Качество", "Якість"], tab_beta: ["Statistics", "Статистика", "Статистика"], tab_identity: ["Track matching", "Сопоставление треков", "Зіставлення треків"], tab_diag: ["Diagnostics", "Диагностика", "Діагностика"],
  proxy: ["Approximate metrics", "Приблизные метрики", "Приблизні метрики"], open_to_eval: ["Open a mix to evaluate it.", "Открой подборку, чтобы её оценить.", "Відкрий добірку, щоб її оцінити."],
  outcomes: ["Results by mix type and mood", "Результаты по типу подборки и настроению", "Результати за типом добірки та настроєм"],
  no_completed: ["No finished mixes yet.", "Готовых подборок пока нет.", "Завершених добірок поки немає."], no_data: ["No data yet.", "Данных пока нет.", "Даних поки немає."],
  version: ["Version", "Версия", "Версія"], data_folder: ["Data folder", "Папка данных", "Тека даних"],
  recent_issues: ["Recent issues", "Последние ошибки", "Останні помилки"], no_issues: ["No issues recorded.", "Ошибок нет.", "Помилок немає."],
  cross_n: ["{n} tracks found on more than one service", "Треков, найденных в нескольких сервисах: {n}", "Треків, знайдених у кількох сервісах: {n}"],
  cross_none: ["Add a second service to see matches.", "Добавь второй сервис, чтобы увидеть совпадения.", "Додай другий сервіс, щоб побачити збіги."],
  col_track: ["Track", "Трек", "Трек"], col_found: ["Found in", "Где найден", "Де знайдено"], col_method: ["Matched by", "Как сопоставлен", "Як зіставлено"], col_conf: ["Confidence", "Уверенность", "Впевненість"],
  col_tier: ["Mix type", "Тип подборки", "Тип добірки"], col_ctx: ["Mood", "Настроение", "Настрій"], col_n: ["Mixes", "Подборки", "Добірки"],
  col_done: ["Finished", "Дослушано", "Дослухано"], col_save: ["Saved", "Сохранено", "Збережено"], col_replay: ["Replayed", "Повторы", "Повтори"], col_reject: ["Rejected", "Отклонено", "Відхилено"],
  col_opened: ["Opened", "Открыто", "Відкрито"], col_started: ["Started", "Начато", "Розпочато"],
  sessions: ["Sessions", "Сеансы", "Сеанси"], variant: ["Variant", "Вариант", "Варіант"],
};
function t(key, vars) {
  const row = TX[key];
  let s = row ? (row[IX[LANG]] ?? row[0]) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  return s;
}

/* ------------------------------------------------------------------ utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const locale = () => (LANG === "uk" ? "uk-UA" : LANG === "ru" ? "ru-RU" : undefined);
const n = (v) => (v == null ? "—" : Number(v).toLocaleString(locale()));
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const cap1 = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
function ago(iso) {
  if (!iso) return t("never");
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t("just_now");
  if (s < 3600) return t("min_ago", { n: Math.round(s / 60) });
  if (s < 86400) return t("h_ago", { n: Math.round(s / 3600) });
  if (s < 86400 * 30) return t("d_ago", { n: Math.round(s / 86400) });
  return new Date(iso).toLocaleDateString(locale());
}
const date = (iso) => (iso ? new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" }) : "—");

/* ------------------------------------------------------------------ icons */
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
  dna: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5" opacity=".7"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3" opacity=".6"/><circle cx="18.5" cy="7" r="1.4"/>',
  capsule: '<rect x="4" y="3.5" width="16" height="17" rx="8"/><path d="M4 12h16"/><circle cx="12" cy="8" r="1.2"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4.5l3 2"/>',
  sources: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6"/><path d="M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  check: '<path d="M5 12.5l4.2 4L19 7"/>',
  love: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  save: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4.5v4h4"/>',
  skip: '<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
  no: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  listened: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  focus: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  energy: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  chill: '<path d="M4 15c3-4 6-4 8 0s5 4 8 0"/><path d="M4 10c3-4 6-4 8 0s5 4 8 0" opacity=".6"/>',
  night_drive: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  workout: '<path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6"/>',
  deep_listen: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M8 14a4 4 0 0 1 8 0"/><circle cx="12" cy="14" r="1"/>',
  discover: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  surprise: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4.5v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5"/><path d="M20 19.5v-4h-4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  empty: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 13h5l1.5 2h4l1.5-2h5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
};
const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

/* ------------------------------------------------------------------ API */
class ApiError extends Error {
  constructor(err, status) { super(err?.message || "Request failed"); this.err = err || {}; this.status = status; }
}
const baseHeaders = () => ({ "X-MusicDNA-Client": "3", "X-MusicDNA-Lang": LANG });
async function api(path, { method = "GET", body, form } = {}) {
  const headers = baseHeaders();
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`/api/v3/${path}`, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError({ code: "OFFLINE", title: t("offline_title"), message: t("offline_msg") }, 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || data.ok === false) throw new ApiError(data.error || { code: "INTERNAL", title: t("went_wrong"), message: t("status_msg", { s: res.status }) }, res.status);
  return data;
}
async function streamBuild(body, onLine) {
  const res = await fetch("/api/v3/dna/build", { method: "POST", headers: { ...baseHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let data = {}; try { data = await res.json(); } catch { /* */ }
    throw new ApiError(data.error, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) onLine(JSON.parse(line));
    }
  }
  if (buf.trim()) onLine(JSON.parse(buf));
}

/* ------------------------------------------------------------------ app state */
const S = { state: null, settings: {}, vizModule: null, capsule: null, expanded: new Set(), revealing: new Set(), tier: "common", intent: "surprise", custom: "" };
async function refresh() {
  const st = await api("state");
  S.state = st; S.settings = st.settings || {};
  if (LANGS.includes(S.settings.language) && S.settings.language !== LANG) { LANG = S.settings.language; applyStatic(); return refresh(); }
  applyMotion();
  return st;
}
function applyMotion() {
  const m = S.settings.motion || "system";
  if (m === "system") document.documentElement.removeAttribute("data-motion");
  else document.documentElement.dataset.motion = m;
}
const advanced = () => !!S.settings.advanced_mode;
// Each render creates a fresh .page element; views bind listeners to it so
// handlers never accumulate across navigations.
const root = () => $("#main > .page");
async function viz() {
  if (!S.vizModule) S.vizModule = await import("./dna-viz.js");
  return S.vizModule;
}
const vizOpts = (extra = {}) => ({ eventsLabel: t("n_plays"), label: t("hi_title"), ...extra });

/* ------------------------------------------------------------------ feedback UI */
function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), kind === "error" ? 7000 : 4200);
}
function errInfo(e) { return e instanceof ApiError ? e.err : { title: t("went_wrong"), message: String(e?.message || e) }; }
function errorBlock(e, extra = "") {
  const err = errInfo(e);
  return `<div class="notice error" role="alert"><div><b>${esc(err.title || t("went_wrong"))}</b><p>${esc(err.message || "")}</p>
    ${err.original ? `<p class="faint" style="font-size:12.5px">${esc(err.original)}</p>` : ""}
    ${advanced() && err.detail ? `<div class="detail">${esc(err.code || "")}: ${esc(err.detail)}</div>` : ""}${extra}</div></div>`;
}
function showError(e) {
  const err = errInfo(e);
  toast(`${err.title}${err.message ? ` — ${err.message}` : ""}`, "error");
}
function confirmDialog(title, text, okLabel = t("confirm")) {
  const d = $("#confirm");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-ok").textContent = okLabel;
  d.returnValue = "cancel";
  d.showModal();
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true }));
}
function empty(iconName, title, text, action = "") {
  return `<div class="empty">${icon(iconName, "ic")}<h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`;
}
const addMusicBtn = () => `<a class="btn btn-primary" href="#/music">${icon("music")} ${t("add_music")}</a>`;

/* ------------------------------------------------------------------ shell */
function applyStatic() {
  document.documentElement.lang = LANG;
  const set = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  set(".skip-link", t("skip"));
  const foot = $(".sidebar-foot"); if (foot) foot.innerHTML = `<span class="dot" aria-hidden="true"></span>${esc(t("local_foot"))}`;
  set('#confirm button[value="cancel"]', t("cancel"));
  const brand = $(".sidebar .brand-name small"); if (brand) brand.textContent = "Copilot 3.3";
  $$(".lang-switch").forEach((el) => el.remove());
  const sw = `<div class="lang-switch" role="group" aria-label="${esc(t("language"))}">${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === LANG}">${{ ru: "RU", uk: "UA", en: "EN" }[l]}</button>`).join("")}</div>`;
  $(".sidebar-foot")?.insertAdjacentHTML("beforebegin", sw);
  $(".topbar")?.insertAdjacentHTML("beforeend", sw);
}
async function setLang(l) {
  if (!LANGS.includes(l)) return;
  LANG = l;
  try { localStorage.setItem("mdna-lang", l); } catch { /* storage blocked */ }
  applyStatic();
  try { await api("settings", { method: "POST", body: { language: l } }); } catch { /* keep the local choice */ }
  S.state = null;
  route();
}
document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-lang]"); if (b) setLang(b.dataset.lang); });

const NAV = [["home", "#/", "nav_home"], ["dna", "#/dna", "nav_dna"], ["music", "#/music", "nav_music"], ["settings", "#/settings", "nav_settings"]];
function renderNav(active) {
  const item = ([ic, href, key]) => `<a href="${href}" ${active === href ? 'aria-current="page"' : ""}>${icon(ic)}<span>${t(key)}</span></a>`;
  $("#nav").innerHTML = NAV.map(item).join("");
  $("#bottom-nav").innerHTML = NAV.map(item).join("");
  $("#topbar-settings").innerHTML = icon("settings");
  $("#topbar-settings").setAttribute("aria-label", t("nav_settings"));
  $("#topbar-settings").toggleAttribute("aria-current", active === "#/settings");
}

const ROUTES = [
  [/^\/?$/, viewHome, "#/"],
  [/^\/welcome(?:\/(\w+))?$/, viewWelcome, null],
  [/^\/dna$/, viewDNA, "#/dna"],
  [/^\/capsules$/, viewHome, "#/"],
  [/^\/capsule\/([\w-]+)$/, viewCapsule, "#/"],
  [/^\/history$/, viewHistory, "#/"],
  [/^\/(?:music|sources)$/, viewSources, "#/music"],
  [/^\/settings$/, viewSettings, "#/settings"],
  [/^\/settings\/privacy$/, viewPrivacy, "#/settings"],
  [/^\/settings\/advanced(?:\/(\w+))?$/, viewAdvanced, "#/settings"],
];
let renderToken = 0;
async function route() {
  const token = ++renderToken;
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs || "");
  const main = $("#main");
  let match = null, fn = viewNotFound, active = null;
  for (const [re, f, a] of ROUTES) { const m = path.match(re); if (m) { match = m; fn = f; active = a; break; } }
  renderNav(active);
  document.body.classList.toggle("is-onboarding", fn === viewWelcome);
  try {
    if (!S.state) { await refresh(); renderNav(active); }
    if (fn !== viewWelcome && !S.state.onboarding_completed && !S.state.has_dna && path !== "/settings" && !path.startsWith("/settings/")
        && !(fn === viewSources && params.toString())) {
      location.replace("#/welcome");
      return;
    }
    const html = await fn(match, params);
    if (token !== renderToken) return;
    if (typeof html === "string") {
      main.innerHTML = `<div class="page">${html}</div>`;
    }
    const h1 = $("h1", main);
    document.title = h1 ? `${h1.textContent.trim()} · Music DNA` : "Music DNA";
    if (fn.after) await fn.after(match, params);
    if (!route.first) main.focus({ preventScroll: true });
    route.first = false;
    window.scrollTo({ top: 0 });
  } catch (e) {
    if (token !== renderToken) return;
    main.innerHTML = `<div class="page"><h1>${t("went_wrong")}</h1><div class="stack">${errorBlock(e)}<a class="btn" href="#/">${t("back_home")}</a></div></div>`;
  }
}
route.first = true;

/* ------------------------------------------------------------------ shared blocks */
function demoNotice() {
  if (!S.state?.dna?.demo) return "";
  return `<div class="notice demo"><span class="badge demo">${t("demo")}</span><div class="spacer"><b>${t("demo_notice")}</b></div>
    <a class="btn btn-sm" href="#/music">${t("demo_link")}</a></div>`;
}
function statLine(dna) {
  const s = dna.stats;
  return `<div class="signal-line">
    <span><b>${n(s.raw_events)}</b> ${t("n_plays")}</span>
    <span><b>${n(s.unique_tracks)}</b> ${t("n_tracks")}</span>
    <span><b>${n(s.artists)}</b> ${t("n_artists")}</span>
  </div>`;
}
function styleWord(d) {
  const x = d.discovery;
  if (!x || x.status !== "ok") return t("st_unknown");
  return x.value >= 0.55 ? t("st_explorer") : x.value <= 0.3 ? t("st_loyal") : t("st_balanced");
}
function intentGrid() {
  return `<div class="intent-grid" role="group" aria-label="${esc(t("pick_mood"))}">${Object.entries(S.state.intents).map(([k, label]) =>
    `<button type="button" class="intent" data-act="intent" data-value="${k}" aria-pressed="${S.intent === k}">${icon(k)}<b>${esc(label)}</b></button>`).join("")}</div>
    ${advanced() ? `<form class="custom-intent" data-form="custom"><label class="sr-only" for="custom-intent">${esc(t("custom_ph"))}</label>
      <input class="input" id="custom-intent" name="custom" maxlength="80" placeholder="${esc(t("custom_ph"))}" value="${esc(S.custom)}"></form>` : ""}`;
}
// Three plain choices; the "surprise" (hidden titles) mix is only offered in technical mode.
function tierPicker() {
  const tiers = S.state.tiers;
  const keys = ["common", "rare", "legendary"].concat(advanced() ? ["mystery"] : []);
  if (!keys.includes(S.tier)) S.tier = "common";
  return `<div class="tier-picker simple" role="radiogroup" aria-label="${esc(t("pick_new"))}">${keys.filter((k) => tiers[k]).map((k) => {
    const x = tiers[k];
    return `<button type="button" class="tier-opt" role="radio" data-tier="${k}" aria-checked="${S.tier === k}" data-act="tier" data-value="${k}">
      <span class="row"><span class="tier-dot"></span><b>${esc(x.label)}</b><span class="faint mono">${x.size}</span></span>
      <small>${esc(x.tagline)}</small></button>`;
  }).join("")}</div>`;
}
function bindPicker(root) {
  root.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "tier") {
      S.tier = b.dataset.value;
      $$(".tier-opt", root).forEach((x) => x.setAttribute("aria-checked", String(x.dataset.value === S.tier)));
    } else if (b.dataset.act === "intent") {
      S.intent = b.dataset.value;
      S.custom = "";
      const ci = $("#custom-intent", root); if (ci) ci.value = "";
      $$(".intent", root).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.value === S.intent)));
    } else if (b.dataset.act === "open-capsule") {
      openCapsule(b);
    }
  });
  const ci = $("#custom-intent", root);
  if (ci) {
    ci.addEventListener("input", () => {
      S.custom = ci.value;
      if (S.custom) { S.intent = null; $$(".intent", root).forEach((x) => x.setAttribute("aria-pressed", "false")); }
    });
    $('[data-form="custom"]', root).addEventListener("submit", (ev) => { ev.preventDefault(); openCapsule($('[data-act="open-capsule"]', root)); });
  }
}
async function openCapsule(btn) {
  const label = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> ${t("pick_busy")}`; }
  try {
    const body = { tier: S.tier, intent: S.intent || "surprise" };
    if (S.custom.trim()) body.custom_intent = S.custom.trim();
    const { capsule } = await api("capsules", { method: "POST", body });
    S.capsule = capsule; S.expanded = new Set(); S.justOpened = true;
    await refresh();
    location.hash = `#/capsule/${capsule.capsule_id}`;
  } catch (e) {
    showError(e);
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}
// Rebuild the taste after music was added or removed, so there is no separate "rebuild" step to remember.
async function rebuildTaste({ quiet = false } = {}) {
  if (S.state?.dna?.demo) await api("demo", { method: "POST", body: { enable: false } });
  await streamBuild({ demo: false }, (s) => { if (s.step === "error") throw new ApiError(s.error, 500); });
  await refresh();
  if (!quiet) toast(t("t_rebuilt"), "ok");
}

/* ------------------------------------------------------------------ onboarding */
async function viewWelcome(m) {
  const step = (m && m[1]) || "start";
  const dots = (i) => `<div class="steps-dots" aria-hidden="true">${[1, 2, 3, 4].map((k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>`;
  if (step === "start") {
    return `<section class="onboard onboard-hero" aria-labelledby="ob-title">
      <div>${dots(1)}<p class="eyebrow">${t("ob_eyebrow")}</p>
        <h1 id="ob-title">${t("ob_title")}</h1>
        <p class="lead">${esc(t("ob_lead"))}</p>
        <div class="row"><a class="btn btn-primary btn-lg" href="#/welcome/sources">${t("ob_start")} ${icon("arrow")}</a>
        ${S.state.has_dna ? `<a class="btn btn-ghost" href="#/">${t("ob_skip")}</a>` : ""}</div>
        <p class="faint" style="margin-top:18px">${t("ob_free")}</p>
      </div>
      <div class="hero-viz" id="ob-viz" aria-hidden="true"></div>
    </section>`;
  }
  if (step === "sources") {
    const src = await api("sources");
    const active = src.active_count;
    return `<section class="onboard">
      ${dots(2)}<div class="page-head"><div><h1>${t("ob_src_title")}</h1><p>${t("ob_src_lead")}</p></div></div>
      ${active ? `<div class="notice ok-notice"><span class="ic">${icon("check")}</span><div class="spacer"><b>${t("ob_ready", { n: active })}</b></div>
        <button class="btn btn-signal" data-act="analyze">${t("ob_go")} ${icon("arrow")}</button></div>` : ""}
      <div class="choice-list">
        <button class="choice primary-choice" data-act="demo">${icon("surprise", "ic")}<span><b>${t("ob_demo_t")}</b><small>${t("ob_demo_d")}</small></span>${icon("arrow")}</button>
      </div>
      <div id="ob-sources">${addMusicBlocks(src.cards, true)}</div>
    </section>`;
  }
  if (step === "analysis") {
    return `<section class="onboard analysis" aria-labelledby="an-title">${dots(3)}
      <h1 id="an-title">${t("an_title")}</h1><p class="muted">${t("an_lead")}</p>
      <ol id="an-steps" aria-live="polite"></ol><div class="pending" id="an-pending"><span class="pulse-dot" aria-hidden="true"></span><span>${t("an_working")}</span></div>
      <div id="an-error"></div></section>`;
  }
  if (step === "reveal") {
    const st = await refresh();
    const d = st.dna;
    if (!d) { location.replace("#/welcome/sources"); return ""; }
    return `<section class="onboard reveal" aria-labelledby="rv-title">${dots(4)}
      <div class="hero-dna"><div class="hero-viz" id="rv-viz"></div>
      <div class="hero-copy"><p class="eyebrow">${t("rv_eyebrow")}</p><h1 id="rv-title" class="state-words">${d.state_words.map((w) => `<span>${esc(w)}</span>`).join("")}</h1>
        ${statLine(d)}
        <dl class="kv">
          <dt>${t("f_genres")}</dt><dd>${esc(d.top_genres.slice(0, 4).join(", ") || t("st_unknown"))}</dd>
          <dt>${t("f_artists")}</dt><dd>${esc(d.top_artists.slice(0, 4).join(", ") || "—")}</dd>
          <dt>${t("f_style")}</dt><dd>${esc(styleWord(d))}</dd>
        </dl>
        <div class="row"><button class="btn btn-signal btn-lg" data-act="first-capsule">${icon("play")} ${t("rv_first")}</button>
        <a class="btn btn-ghost" href="#/dna" data-act="finish-onboarding">${t("rv_explore")}</a></div>
      </div></div>${demoNotice()}</section>`;
  }
  return viewNotFound();
}
viewWelcome.after = async (m) => {
  const step = (m && m[1]) || "start";
  const main = root();
  if (step === "start") {
    const el = $("#ob-viz");
    if (el) (await viz()).renderDNA(el, DEMO_SHAPE, { compact: true, illustration: true, label: "" });
  }
  if (step === "sources") {
    bindAddMusic(main, { onboarding: true });
    main.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      try {
        if (b.dataset.act === "demo") {
          await api("demo", { method: "POST", body: { enable: true } }); location.hash = "#/welcome/analysis";
        } else if (b.dataset.act === "analyze") {
          await api("demo", { method: "POST", body: { enable: false } }); location.hash = "#/welcome/analysis";
        }
      } catch (e) { showError(e); }
    });
  }
  if (step === "analysis") {
    await runAnalysis({ onDone: () => { location.hash = "#/welcome/reveal"; } });
  }
  if (step === "reveal") {
    const el = $("#rv-viz");
    const { dna } = await api("dna");
    (await viz()).renderDNA(el, dna, vizOpts({ compact: true }));
    main.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "first-capsule") {
        await api("onboarding/complete", { method: "POST", body: {} });
        S.tier = "common"; S.intent = "surprise";
        openCapsule(b);
      } else if (b.dataset.act === "finish-onboarding") {
        await api("onboarding/complete", { method: "POST", body: {} }); await refresh();
      }
    });
  }
};
async function runAnalysis({ onDone, demo } = {}) {
  const list = $("#an-steps"), pending = $("#an-pending"), errBox = $("#an-error");
  try {
    await streamBuild(demo === undefined ? {} : { demo }, (step) => {
      if (step.step === "error") throw new ApiError(step.error, 500);
      if (step.step === "done") return;
      const li = document.createElement("li");
      li.innerHTML = `<span class="ic">${icon("check")}</span><span><b>${esc(step.label)}</b><small>${esc(step.detail)}</small></span>${advanced() ? `<span class="ms">${step.ms} ms</span>` : ""}`;
      list.append(li);
    });
    pending.remove();
    await refresh();
    const btn = document.createElement("div");
    btn.innerHTML = `<button class="btn btn-primary btn-lg" style="margin-top:22px">${t("an_reveal")} ${icon("arrow")}</button>`;
    list.after(btn);
    btn.querySelector("button").addEventListener("click", onDone);
    btn.querySelector("button").focus();
  } catch (e) {
    pending.remove();
    errBox.innerHTML = `<div style="margin-top:18px">${errorBlock(e)}</div><a class="btn" style="margin-top:12px" href="#/music">${t("an_check")}</a>`;
  }
}
// Illustrative shape for the welcome screen only (aria-hidden, no numbers shown as facts).
const DEMO_SHAPE = {
  generated_at: "illustration", stats: { raw_events: 0 },
  families: [{ id: "a", label: "", affinity: 1, genres: [] }, { id: "b", label: "", affinity: .7, genres: [] }, { id: "c", label: "", affinity: .55, genres: [] },
    { id: "d", label: "", affinity: .4, genres: [] }, { id: "e", label: "", affinity: .3, genres: [] }, { id: "f", label: "", affinity: .2, genres: [] }],
  genres: ["a", "a", "a", "b", "b", "c", "c", "d", "e", "f"].map((f, i) => ({ name: `g${i}`, family: f, affinity: 1 - i * 0.08, kind: i % 3 ? "subgenre" : "microgenre" })),
  artists: ["a", "a", "b", "b", "c", "d", "e", "f", "a", "c"].map((f, i) => ({ name: "", family: f, affinity: 1 - i * .08, plays: 0 })),
};

/* ------------------------------------------------------------------ home */
async function viewHome() {
  const st = await refresh();
  if (!st.has_dna) {
    return `<h1>${t("nav_home")}</h1><div style="margin-top:18px">${empty("music", t("no_music_t"), t("no_music_d"), addMusicBtn())}</div>`;
  }
  const d = st.dna;
  const act = st.active_capsule;
  const pastCount = (st.recent_capsules || []).length;
  return `
  ${demoNotice()}
  ${st.dna_stale ? `<div class="notice warn" style="margin-top:16px"><div class="spacer"><b>${t("stale")}</b></div><a class="btn btn-sm" href="#/music">${t("nav_music")}</a></div>` : ""}
  <section class="card hero-dna" aria-labelledby="home-title" style="margin-top:${d.demo || st.dna_stale ? 16 : 0}px">
    <div class="hero-viz" id="home-viz"><div class="skeleton" style="height:100%"></div></div>
    <div class="hero-copy">
      <p class="eyebrow">${t("hi_title")} · ${t("updated", { t: ago(d.generated_at) })}</p>
      <h1 id="home-title" class="state-words">${d.state_words.map((w) => `<span>${esc(w)}</span>`).join("")}</h1>
      ${statLine(d)}
      <div class="row"><a class="btn btn-sm" href="#/dna">${t("more_taste")}</a></div>
    </div>
  </section>
  ${act ? `<div class="notice" style="margin-top:16px" data-tier="${esc(act.tier)}"><span class="tier-dot" style="margin-top:6px"></span><div class="spacer"><b>${t("resume_t")}</b><p>${esc(act.tier_label)}</p></div><a class="btn btn-sm btn-primary" href="#/capsule/${esc(act.capsule_id)}">${t("resume_b")}</a></div>` : ""}
  <section class="card" aria-labelledby="pick-title" style="margin-top:16px" id="picker">
    <h2 id="pick-title">${icon("play")} ${t("pick_title")}</h2>
    <p class="step-label"><span class="num-dot">1</span>${t("pick_mood")}</p>
    ${intentGrid()}
    <p class="step-label"><span class="num-dot">2</span>${t("pick_new")}</p>
    ${tierPicker()}
    <div class="cta-bar"><button class="btn btn-signal btn-lg btn-wide" data-act="open-capsule">${icon("play")} ${t("pick_go")}</button></div>
  </section>
  ${pastCount ? `<a class="card link-card" href="#/history" style="margin-top:16px">${icon("history", "ic")}<span class="spacer"><b>${t("past")}</b></span>${icon("arrow")}</a>` : ""}`;
}
viewHome.after = async () => {
  const st = S.state;
  if (!st.has_dna) return;
  bindPicker($("#picker"));
  try {
    const { dna } = await api("dna");
    (await viz()).renderDNA($("#home-viz"), dna, vizOpts({ compact: true }));
  } catch (e) { $("#home-viz").innerHTML = ""; }
};
function changeList(items) {
  if (!items.length) return `<p class="muted">${t("changes_none")}</p>`;
  return `<ul class="feed">${items.map((i) => `<li class="${esc(i.direction)}"><span class="arrow" aria-hidden="true">${i.direction === "up" ? "↑" : i.direction === "down" ? "↓" : "•"}</span>
    <div><b>${esc(i.title)}</b><small>${esc(i.why)}</small>${i.confidence ? `<em>${esc(i.confidence)}</em>` : ""}</div></li>`).join("")}</ul>`;
}

/* ------------------------------------------------------------------ my taste */
async function viewDNA() {
  const st = await refresh();
  if (!st.has_dna) return `<h1>${t("dna_title")}</h1><div style="margin-top:18px">${empty("dna", t("no_music_t"), t("no_music_d"), addMusicBtn())}</div>`;
  const [{ dna }, ch] = await Promise.all([api("dna"), api("dna/changes")]);
  S.dna = dna; S.changes = ch;
  const dims = dna.dimensions;
  const DIM = [
    ["genre_affinity", "dim_genre"], ["microgenre_affinity", "dim_micro"], ["artist_affinity", "dim_artist"],
    ["familiarity", "dim_fam", "lo_new", "hi_rep"], ["novelty", "dim_nov", "lo_fam", "hi_nov"],
    ["discovery_tolerance", "dim_disc", "lo_close", "hi_far"], ["mainstream_niche", "dim_main", "lo_main", "hi_niche"],
    ["recent_shift", "dim_shift"], ["context_affinity", "dim_ctx"],
  ];
  const dimCard = ([k, title, lo, hi]) => {
    const x = dims[k] || { status: "insufficient_data", reason: "" };
    if (x.status !== "ok") return `<div class="dim insufficient"><h3>${t(title)}</h3><div class="val">${t("not_enough")}</div><p class="basis">${esc(x.reason)}</p></div>`;
    let body = "";
    if (x.value != null) body = `<div class="val">${pct(x.value)}</div><div class="meter"><i data-v="${x.value}"></i></div>${lo ? `<div class="scale"><span>${t(lo)}</span><span>${t(hi)}</span></div>` : ""}`;
    else if (x.top) body = `<div class="chips">${x.top.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>`;
    else if (x.rising) body = `<div class="chips">${x.rising.map((g) => `<span class="chip up">↑ ${esc(g)}</span>`).join("")}${x.fading.map((g) => `<span class="chip down">↓ ${esc(g)}</span>`).join("")}</div>`;
    else if (x.values) body = `<div class="chips">${Object.entries(x.values).map(([c, v]) => `<span class="chip ${v >= 0 ? "up" : "down"}">${esc(c.replace(/_/g, " "))} ${v >= 0 ? "↑" : "↓"}</span>`).join("")}</div>`;
    return `<div class="dim"><h3>${t(title)}</h3>${body}<p class="basis">${esc(x.basis || "")}</p></div>`;
  };
  const bars = (items, key = "affinity") => `<div class="bars">${items.map((g) => `<div class="bar-row"><span title="${esc(g.name)}">${esc(g.name)}</span><div class="meter"><i data-v="${g[key]}"></i></div><span class="v">${pct(g[key])}</span></div>`).join("")}</div>`;
  const s = dna.session || {};
  const nowBlock = s.events
    ? `<div class="chips">${(s.rising || []).map((g) => `<span class="chip up">↑ ${esc(g)}</span>`).join("")}${(s.cooling || []).map((g) => `<span class="chip down">↓ ${esc(g)}</span>`).join("")}</div>
       <p class="faint">${t("now_from", { n: s.events, h: s.window_hours })}</p>`
    : `<p class="faint">${t("now_empty")}</p>`;
  return `
  <div class="page-head"><div><p class="eyebrow">${t("updated", { t: ago(dna.generated_at) })}</p><h1>${t("dna_title")}</h1>
    <p>${t("dna_lead")}</p></div>
    <button class="btn btn-sm" data-act="rebuild">${icon("sync")} ${t("refresh_taste")}</button></div>
  ${demoNotice()}
  <div class="dna-layout" style="margin-top:${dna.demo ? 16 : 0}px">
    <section class="card viz-card" aria-label="${esc(t("map"))}">
      <div class="viz-toolbar"><span></span>
        <div class="segmented" role="tablist" aria-label="${esc(t("map"))}"><button role="tab" aria-selected="true" data-act="mode" data-value="map">${t("map")}</button><button role="tab" aria-selected="false" data-act="mode" data-value="list">${t("list")}</button></div></div>
      <div id="dna-map"><div class="viz-wrap" id="dna-viz"></div></div>
      <div id="dna-listview" hidden>${dnaListView(dna)}</div>
    </section>
    <section class="card focus-panel" id="focus-panel" aria-live="polite">${focusPanel(null, dna)}</section>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <section class="card"><h2 class="eyebrow" style="margin-bottom:12px">${t("top_genres")}</h2>${bars(dna.genres.slice(0, 8))}</section>
    <section class="card"><h2 class="eyebrow" style="margin-bottom:12px">${t("top_artists")}</h2>${bars(dna.artists.slice(0, 8))}</section>
  </div>
  <details class="card more-card" style="margin-top:16px"><summary><b>${t("details")}</b></summary>
    <div class="stack" style="margin-top:14px">
      <div class="core-now">
        <div><h3>${icon("dna")} ${t("core_t")}</h3><p>${t("core_d")}</p>
          <div class="chips">${(dna.top_genres || []).slice(0, 5).map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div></div>
        <div class="now"><h3>${icon("energy")} ${t("now_t")}</h3>${nowBlock}</div>
      </div>
      <div><h3 style="margin-bottom:8px">${t("changes_t")}</h3>${changeList(ch.items)}</div>
      <div><h3 style="margin-bottom:8px">${t("measures")}</h3><div class="dims">${DIM.map(dimCard).join("")}</div></div>
      ${dna.learned.evidence_count ? `<div><h3 style="margin-bottom:8px">${t("learned_t")}</h3>
        <div class="chips">${Object.entries(dna.learned.genres).map(([g, v]) => `<span class="chip ${v >= 0 ? "up" : "down"}">${esc(g)} ${v >= 0 ? "↑" : "↓"}</span>`).join("")}</div></div>` : ""}
      <p class="faint" style="font-size:12.5px">${n(dna.stats.source_count)} ${t("n_sources")} · ${esc(dna.coverage.level)}${dna.coverage.reasons.length ? ` · ${esc(dna.coverage.reasons.join(", "))}` : ""}</p>
    </div>
  </details>`;
}
function dnaListView(dna) {
  return `<div class="dna-list">${dna.families.map((f) => {
    const gs = dna.genres.filter((g) => g.family === f.id);
    const as = dna.artists.filter((a) => a.family === f.id);
    return `<details><summary>${esc(f.label)} · ${pct(f.affinity)}</summary>
      <p class="muted" style="margin-top:8px">${t("genres")}: ${esc(gs.map((g) => g.name).join(", ") || "—")}</p>
      <p class="muted">${t("artists")}: ${esc(as.map((a) => a.name).join(", ") || "—")}</p></details>`;
  }).join("")}</div>`;
}
function focusPanel(fam, dna) {
  if (!fam) {
    const top = dna.families[0];
    return `<p class="muted">${t("focus_hint")}</p>
      ${top ? `<p style="margin-top:12px">${t("focus_strong", { f: esc(top.label), g: esc(top.genres.slice(0, 3).join(", ")) })}</p>` : ""}`;
  }
  const gs = dna.genres.filter((g) => g.family === fam.id);
  const as = dna.artists.filter((a) => a.family === fam.id);
  const micro = gs.filter((g) => g.kind === "microgenre");
  const chips = (arr, cls = "") => arr.map((x) => `<span class="chip ${cls}">${esc(x.name)}</span>`).join("") || `<span class="faint">${t("none")}</span>`;
  return `<div class="card-head"><h2>${esc(fam.label)}</h2><span class="mono faint">${pct(fam.affinity)}</span></div>
    <p class="eyebrow">${t("genres")}</p><div class="chips" style="margin:8px 0 14px">${chips(gs.filter((g) => g.kind !== "microgenre").slice(0, 8))}</div>
    ${micro.length ? `<p class="eyebrow">${t("micro")}</p><div class="chips" style="margin:8px 0 14px">${chips(micro.slice(0, 8), "up")}</div>` : ""}
    <p class="eyebrow">${t("artists")}</p><div class="chips" style="margin-top:8px">${chips(as.slice(0, 10), "dim")}</div>`;
}
viewDNA.after = async () => {
  if (!S.state.has_dna) return;
  const main = root();
  $$(".meter i[data-v]", main).forEach((i) => i.style.setProperty("--v", `${Math.max(0, Math.min(1, +i.dataset.v)) * 100}%`));
  const changed = S.changes.items.filter((i) => i.kind === "genre").map((i) => i.subject);
  (await viz()).renderDNA($("#dna-viz"), S.dna, vizOpts({ changed, onSelect: (fam, dna) => { $("#focus-panel").innerHTML = focusPanel(fam, dna); } }));
  main.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "mode") {
      const list = b.dataset.value === "list";
      $("#dna-map").hidden = list; $("#dna-listview").hidden = !list;
      $$('[data-act="mode"]', main).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    }
    if (b.dataset.act === "rebuild") {
      b.disabled = true; b.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> ${t("refreshing")}`;
      try {
        await streamBuild({}, (s) => { if (s.step === "error") throw new ApiError(s.error, 500); });
        toast(t("refreshed"), "ok"); await refresh(); route();
      } catch (e) { showError(e); b.disabled = false; b.innerHTML = `${icon("sync")} ${t("refresh_taste")}`; }
    }
  });
};

/* ------------------------------------------------------------------ capsule (a mix) */
const FB_MAIN = [["love", "fb_love", "love"], ["skip", "fb_skip", "skip"], ["not_for_me", "fb_no", "no"]];
const FB_MORE = [["save", "fb_save"], ["completed", "fb_completed"], ["replay", "fb_replay"], ["more_like_this", "fb_mlt"], ["too_similar", "fb_similar"], ["too_strange", "fb_strange"]];
const TERMINAL = new Set(["completed", "skip", "not_for_me", "save", "love", "replay"]);
const fbLabel = (a) => t({ love: "fbd_love", save: "fbd_save", completed: "fbd_completed", replay: "fbd_replay", skip: "fbd_skip", not_for_me: "fbd_no", more_like_this: "fb_mlt", too_similar: "fb_similar", too_strange: "fb_strange" }[a] || a);

async function viewCapsule(m) {
  const { capsule } = await api(`capsules/${m[1]}`);
  S.capsule = capsule;
  return capsuleHTML(capsule);
}
function currentIndex(c) {
  return c.tracks.findIndex((x) => !x.feedback.some((a) => TERMINAL.has(a)));
}
function capsuleHTML(c) {
  const cur = currentIndex(c);
  const closed = c.state === "completed" || c.state === "abandoned";
  const intro = S.justOpened ? " capsule-open" : "";
  S.justOpened = false;
  const warn = (c.retrieval?.warnings || []).includes("pool_smaller_than_capsule")
    ? `<div class="notice warn"><div><b>${t("small_pool", { n: c.actual_size })}</b></div></div>` : "";
  return `<div data-tier="${esc(c.rarity)}" class="${intro.trim()}">
    <div class="capsule-head">
      <div class="capsule-title"><p class="eyebrow">${esc(c.context?.intent_label || "")} · ${date(c.generated_at)}${c.demo ? ` · <span class="badge demo">${t("demo")}</span>` : ""}</p>
        <h1>${c.rarity === "mystery" ? t("mystery_mix") : `${t("mix")}: ${esc(c.tier_label)}`}</h1>
        <p class="muted">${esc(c.tagline || "")}</p></div>
      <div class="capsule-progress" aria-label="${esc(t("n_of_rated", { d: c.progress.done, t: c.progress.total }))}"><div class="row"><span>${t("n_of_rated", { d: c.progress.done, t: c.progress.total })}</span></div>
        <div class="meter tier"><i data-v="${c.progress.done / Math.max(1, c.progress.total)}"></i></div></div>
    </div>
    ${warn}
    ${closed && c.summary ? completeHTML(c) : ""}
    <ol class="tracks" aria-label="${esc(t("mix"))}" style="list-style:none;padding:0;margin:${warn ? "14px" : "0"} 0 0">
      ${c.tracks.map((x, i) => trackHTML(c, x, i, i === cur && !closed)).join("")}
    </ol>
    ${!closed ? `<div class="row" style="margin-top:18px"><span class="spacer"></span>
      <button class="btn btn-ghost" data-act="finish">${c.progress.done ? t("finish") : t("close_mix")}</button></div>` : ""}
    ${advanced() ? `<p class="faint mono" style="margin-top:14px;font-size:12px">variant ${esc(c.algorithm?.variant)} · ${esc(c.algorithm?.version)} · pool ${c.retrieval?.pool_size} · ${esc(c.composition ? `${c.composition.close}/${c.composition.moderate}/${c.composition.far}` : "")} · ${esc((c.retrieval?.catalogs || []).map((x) => x.label).join(" + "))}</p>` : ""}
  </div>`;
}
function trackHTML(c, x, i, isCurrent) {
  const done = x.feedback.some((a) => TERMINAL.has(a));
  const open = isCurrent || S.expanded.has(x.track_id);
  const num = String(i + 1).padStart(2, "0");
  const name = x.hidden
    ? `<b>${t("hidden_t", { n: num })}</b><span>${t("hidden_a")}</span>`
    : `<b>${esc(x.title)}</b><span>${esc(x.artist)}</span>`;
  const label = x.hidden ? t("hidden_track", { n: i + 1 }) : `${x.title} — ${x.artist}`;
  const cls = ["track", isCurrent ? "is-current" : "", done ? "is-done" : "", x.hidden ? "hidden-track" : "", S.revealing.has(x.track_id) ? "revealing" : ""].join(" ");
  return `<li class="${cls}" style="--i:${i}" data-track="${esc(x.track_id)}">
    <div class="track-main">
      <span class="track-no" aria-hidden="true">${done ? icon("check") : num}</span>
      <button class="track-name link-reset" data-act="toggle" aria-expanded="${open}" aria-controls="tb-${esc(x.track_id)}" aria-label="${esc(label)}${isCurrent ? ` (${t("current")})` : ""}">${name}</button>
      <div class="track-match"><b>${x.explain.match}%</b><small>${t("match")}</small></div>
    </div>
    <div class="track-body" id="tb-${esc(x.track_id)}" ${open ? "" : "hidden"}>
      ${done ? `<span class="done-tag">${icon("check", "")} ${esc(x.feedback.filter((a) => TERMINAL.has(a)).map(fbLabel).join(" · "))}</span>` : ""}
      ${x.hidden ? mysteryBody(x) : playBody(x)}
      ${c.state === "completed" || c.state === "abandoned" ? "" : feedbackRow(x)}
      ${x.hidden ? "" : whyPanel(x)}
    </div>
  </li>`;
}
function mysteryBody(x) {
  return `<div class="why-kv">
      <div><small>${t("k_match")}</small><b>${x.explain.match}%</b></div><div><small>${t("k_dist")}</small><b>${esc(x.explain.distance)}</b></div><div><small>${t("k_ctx")}</small><b>${x.explain.context_fit}%</b></div></div>
    <div class="mystery-veil" aria-hidden="true"></div>
    <div class="play-row"><button class="btn btn-sm" data-act="reveal">${icon("eye")} ${t("reveal")}</button>
      <span class="play-note">${t("reveal_note")}</span></div>`;
}
function playBody(x) {
  const pb = x.playback || { actions: [] };
  const acts = pb.actions || [];
  const primary = acts.filter((a) => !a.secondary).slice(0, 1);
  const secondary = acts.filter((a) => a.secondary).concat(acts.filter((a) => !a.secondary).slice(1));
  const btn = (a, cls, ic) => a.url ? `<a class="btn btn-sm ${cls}" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-act="open" data-provider="${esc(a.provider)}">${icon(ic)} ${esc(a.label)}</a>` : "";
  return `<div class="play-row">${primary.map((a) => btn(a, "btn-primary", "play")).join("")}
      ${secondary.length ? `<details class="more-fb"><summary>${t("other_services")}</summary><div class="play-row" style="margin-top:6px">${secondary.map((a) => btn(a, "btn-ghost", a.kind === "open" ? "external" : "search")).join("")}</div></details>` : ""}</div>
    ${pb.note ? `<p class="play-note">${esc(pb.note)}</p>` : ""}`;
}
function feedbackRow(x) {
  const on = (a) => x.feedback.includes(a);
  return `<div class="fb-row fb-simple" role="group" aria-label="${esc(t("fb_more"))}">${FB_MAIN.map(([a, key, ic]) =>
    `<button class="fb fb-${a}" data-act="fb" data-action="${a}" aria-pressed="${on(a)}">${icon(ic)}<span>${t(key)}</span></button>`).join("")}</div>
    <details class="more-fb"><summary>${t("fb_more")}</summary><div class="fb-row">${FB_MORE.map(([a, key]) =>
      `<button class="fb" data-act="fb" data-action="${a}" aria-pressed="${on(a)}">${t(key)}</button>`).join("")}</div></details>`;
}
function whyPanel(x) {
  const e = x.explain;
  return `<details class="why"><summary>${t("why")}</summary><div class="why-body">
    <ul>${e.reasons.map((r) => `<li>${esc(r.text)}${r.items ? `: <b>${esc(r.items.join(", "))}</b>` : ""}</li>`).join("")}</ul>
    ${e.caution ? `<p class="muted">${esc(e.caution)}</p>` : ""}
    ${x.genres?.length ? `<div class="chips">${x.genres.map((g) => `<span class="chip dim">${esc(g)}</span>`).join("")}</div>` : ""}
    <p class="faint" style="font-size:12px">${esc(e.match_note)}${e.genres_inferred ? ` ${t("inferred")}` : ""}</p>
    ${advanced() && x.playback ? `<p class="faint mono" style="font-size:12px">resolver: ${esc(x.playback.status)} / ${esc(x.playback.method)} via ${esc(x.playback.provider)} · ${t("k_dist")}: ${esc(e.distance)} · ${t("k_ctx")}: ${e.context_fit}%</p>` : ""}
  </div></details>`;
}
function completeHTML(c) {
  const s = c.summary;
  const abandoned = c.state === "abandoned";
  return `<section class="card complete reveal" aria-labelledby="done-title" style="margin-bottom:16px">
    <div class="complete-hero"><div><h2 id="done-title" tabindex="-1">${abandoned ? t("closed") : t("complete")}</h2>
      <div class="complete-counts" style="margin-top:14px">
        <div class="stat"><b>${s.saved + s.loved}</b><span>${t("c_liked")}</span></div><div class="stat"><b>${s.completed}</b><span>${t("c_listened")}</span></div>
        <div class="stat"><b>${s.skipped}</b><span>${t("c_skipped")}</span></div><div class="stat"><b>${s.rejected}</b><span>${t("c_rejected")}</span></div></div></div>
    <div><p class="eyebrow">${t("c_learned")}</p>
      ${s.learned.length ? `<ul class="learned" style="margin-top:12px">${s.learned.map((l) => `<li class="${esc(l.direction)}"><span class="dir">${l.direction === "up" ? "↑" : "↓"}</span><span>${esc(l.text)}</span></li>`).join("")}</ul>`
      : `<p class="muted" style="margin-top:12px">${esc(s.learned_empty_reason)}</p>`}
    </div></div>
    <div class="cta-bar"><button class="btn btn-signal" data-act="next">${icon("play")} ${t("next_mix")}</button><a class="btn" href="#/dna">${t("see_taste")}</a></div>
  </section>`;
}
viewCapsule.after = () => {
  const main = root();
  $$(".meter i[data-v]", main).forEach((i) => i.style.setProperty("--v", `${Math.max(0, Math.min(1, +i.dataset.v)) * 100}%`));
  S.revealing.clear();
  main.onclick = async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const c = S.capsule;
    const li = b.closest("[data-track]");
    const tid = li?.dataset.track;
    const act = b.dataset.act;
    if (act === "toggle") {
      const body = $(`#tb-${CSS.escape(tid)}`);
      const open = body.hidden;
      body.hidden = !open; b.setAttribute("aria-expanded", String(open));
      if (open) S.expanded.add(tid); else S.expanded.delete(tid);
      return;
    }
    if (act === "open") {
      // Let the link open normally; record the (observable) open in the background.
      fetch(`/api/v3/capsules/${c.capsule_id}/open`, { method: "POST", keepalive: true,
        headers: { ...baseHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ track_id: tid, provider: b.dataset.provider }) }).catch(() => {});
      return;
    }
    try {
      if (act === "fb") {
        const wasHidden = c.tracks.find((x) => x.track_id === tid)?.hidden;
        b.setAttribute("aria-busy", "true");
        const before = c.state;
        const { capsule } = await api(`capsules/${c.capsule_id}/feedback`, { method: "POST", body: { track_id: tid, action: b.dataset.action } });
        const nt = capsule.tracks.find((x) => x.track_id === tid);
        if (wasHidden && nt && !nt.hidden) S.revealing.add(tid);
        rerenderCapsule(capsule, tid);
        if (before !== "completed" && capsule.state === "completed") { $("#done-title")?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      } else if (act === "reveal") {
        const { capsule } = await api(`capsules/${c.capsule_id}/reveal`, { method: "POST", body: { track_id: tid } });
        S.revealing.add(tid); S.expanded.add(tid);
        rerenderCapsule(capsule, tid);
      } else if (act === "finish") {
        const ok = c.progress.done ? true : await confirmDialog(t("close_q"), t("close_d"), t("close_mix"));
        if (!ok) return;
        const { capsule } = await api(`capsules/${c.capsule_id}/finish`, { method: "POST", body: {} });
        rerenderCapsule(capsule); $("#done-title")?.focus();
      } else if (act === "next") {
        S.tier = c.rarity; S.intent = c.context?.custom ? null : c.context?.intent; S.custom = "";
        openCapsule(b);
      }
    } catch (e) { showError(e); }
  };
};
function rerenderCapsule(capsule, focusTrack) {
  S.capsule = capsule;
  const main = root();
  main.innerHTML = capsuleHTML(capsule);
  viewCapsule.after();
  if (focusTrack) {
    const next = capsule.tracks[currentIndex(capsule)];
    const target = next ? $(`[data-track="${CSS.escape(next.track_id)}"] [data-act="toggle"]`, main) : null;
    const same = $(`[data-track="${CSS.escape(focusTrack)}"] [data-act="toggle"]`, main);
    (target && next.track_id !== focusTrack && capsule.tracks.find((x) => x.track_id === focusTrack)?.feedback.some((a) => TERMINAL.has(a)) ? target : same)?.focus({ preventScroll: false });
  }
}

/* ------------------------------------------------------------------ past mixes */
async function viewHistory() {
  const h = await api("history");
  if (!h.capsules.length) return `<h1>${t("hist_title")}</h1><div style="margin-top:18px">${empty("history", t("hist_empty"), t("hist_empty_d"), S.state.has_dna ? `<a class="btn btn-primary" href="#/">${icon("play")} ${t("pick_title")}</a>` : "")}</div>`;
  return `<div class="page-head"><div><h1>${t("hist_title")}</h1><p>${t("hist_lead")}</p></div>
    <a class="btn btn-sm btn-ghost" href="/api/v3/export/history" download>${t("export")}</a></div>
  ${h.discoveries.length ? `<section class="card" aria-labelledby="disc-title"><div class="card-head"><h2 id="disc-title">${t("discoveries")}</h2><span class="faint">${h.discoveries.length}</span></div>
    <div class="chips">${h.discoveries.map((d) => `<a class="chip" href="#/capsule/${esc(d.capsule_id)}">${esc(d.title)} · <span class="muted">&nbsp;${esc(d.artist)}</span></a>`).join("")}</div></section>` : ""}
  <section style="margin-top:16px"><div class="history-cards always">${h.capsules.map((r) => `<a class="hcard" href="#/capsule/${esc(r.capsule_id)}" data-tier="${esc(r.tier)}">
    <span class="row"><span class="badge tier-badge">${esc(r.tier_label)}</span><span>${esc(r.intent || "")}</span>${r.demo ? ` <span class="badge demo">${t("demo")}</span>` : ""}</span>
    <small>${date(r.date)} · ${t("h_rated", { r: r.reacted, t: r.tracks })} · ${t("st_" + r.state) || esc(r.state)}</small></a>`).join("")}</div></section>`;
}

/* ------------------------------------------------------------------ my music (sources) */
const DIRECT = ["spotify", "youtube_music", "deezer", "apple_music"];
const QUICK = ["listenbrainz", "lastfm"];
const FILE_ORDER = ["spotify", "apple_music", "youtube_music", "deezer", "lastfm", "yandex_music", "soundcloud", "tidal", "amazon_music", "qobuz", "bandcamp", "pandora", "generic_csv", "generic_json"];
const isActive = (c) => c.state === "connected" || c.state === "imported";
// Where each service's history file comes from: [en, ru, uk].
const FILE_HELP = {
  spotify: ["spotify.com → Account → Privacy settings → request “Extended streaming history”. Spotify emails a link (can take a few days). Choose the Streaming_History_Audio_… .json files.",
    "spotify.com → Аккаунт → Настройки приватности → запросить «Расширенная история прослушиваний». Spotify пришлёт ссылку на почту (иногда через несколько дней). Выбери файлы Streaming_History_Audio_… .json.",
    "spotify.com → Акаунт → Налаштування приватності → запитати «Розширена історія прослуховувань». Spotify надішле посилання на пошту (іноді за кілька днів). Обери файли Streaming_History_Audio_… .json."],
  apple_music: ["privacy.apple.com → Request a copy of your data → Apple Media Services. In the archive choose “Apple Music Play Activity.csv”.",
    "privacy.apple.com → Запросить копию данных → Apple Media Services. В архиве выбери «Apple Music Play Activity.csv».",
    "privacy.apple.com → Запитати копію даних → Apple Media Services. В архіві обери «Apple Music Play Activity.csv»."],
  youtube_music: ["takeout.google.com → select only “YouTube and YouTube Music” → history. In the archive choose watch-history.json (or .html).",
    "takeout.google.com → отметь только «YouTube и YouTube Music» → история. В архиве выбери watch-history.json (или .html).",
    "takeout.google.com → познач лише «YouTube і YouTube Music» → історія. В архіві обери watch-history.json (або .html)."],
  deezer: ["deezer.com → My account → Privacy → download my data. Open the file in Excel or Google Sheets and save the listening-history sheet as CSV.",
    "deezer.com → Мой аккаунт → Конфиденциальность → скачать мои данные. Открой файл в Excel или Google Таблицах и сохрани лист с историей как CSV.",
    "deezer.com → Мій акаунт → Конфіденційність → завантажити мої дані. Відкрий файл в Excel або Google Таблицях і збережи аркуш з історією як CSV."],
  lastfm: ["Easier: connect by user name above. Any Last.fm scrobble export (CSV) also works.",
    "Проще подключить по имени выше. Подойдёт и любой экспорт скробблов Last.fm в CSV.",
    "Простіше підключити за ім'ям вище. Підійде й будь-який експорт скроблів Last.fm у CSV."],
};
const FILE_HELP_ANY = ["Any table (CSV) or JSON list with track and artist columns works. Many playlist-transfer tools can save one.",
  "Подойдёт любая таблица CSV или список JSON с колонками «трек» и «артист». Такой файл умеют сохранять многие сервисы переноса плейлистов.",
  "Підійде будь-яка таблиця CSV або список JSON з колонками «трек» і «артист». Такий файл уміють зберігати багато сервісів перенесення плейлистів."];
const fileHelp = (id) => (FILE_HELP[id] || FILE_HELP_ANY)[IX[LANG]];

function activeList(cards) {
  const act = cards.filter(isActive);
  if (!act.length) return "";
  return `<section class="card" aria-labelledby="act-title"><h2 id="act-title">${t("mu_connected")}</h2>
    <ul class="src-list">${act.map((c) => {
      const acts = [];
      if (c.can_sync) acts.push(`<button class="btn btn-sm" data-act="sync" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">${icon("sync")} ${t("sync")}</button>`);
      const more = [];
      if (c.live && (c.state === "connected" || c.state === "configured")) more.push(`<button class="btn btn-sm btn-ghost" data-act="disconnect" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">${t("disconnect")}</button>`);
      if (c.stats) more.push(`<button class="btn btn-sm btn-ghost" data-act="remove" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">${t("remove")}</button>`);
      return `<li class="src-item"><span class="src-ok">${icon("check")}</span>
        <div class="spacer"><b>${esc(c.label)}</b> <span class="badge ${c.state === "connected" ? "connected" : "imported"}">${c.state === "connected" ? t("s_connected") : t("s_imported")}</span>
          <small>${c.account ? `${esc(t("as_account", { a: c.account }))} · ` : ""}${c.stats ? esc(t("plays_n", { n: n(c.stats.events) })) : ""}${c.last_synced ? ` · ${esc(ago(c.last_synced))}` : ""}</small>
          ${c.error ? `<p class="err" role="alert">${esc(c.error)}</p>` : ""}</div>
        <div class="src-actions">${acts.join("")}${more.length ? `<details class="menu"><summary class="btn btn-sm btn-ghost">${t("more_actions")}</summary><div class="menu-body">${more.join("")}</div></details>` : ""}</div></li>`;
    }).join("")}</ul></section>`;
}
function quickBlock(cards) {
  const lb = cards.find((c) => c.id === "listenbrainz");
  const lf = cards.find((c) => c.id === "lastfm");
  const parts = [];
  if (lb && lb.state !== "connected") {
    parts.push(`<form class="quick-form" data-form="setup" data-provider="listenbrainz" data-label="ListenBrainz">
      <label for="lb-user">${t("lb_user")}</label>
      <div class="row"><input class="input" id="lb-user" name="username" autocomplete="username" required spellcheck="false" value="${esc((lb.config_public || {}).username || "")}">
        <button class="btn btn-primary">${t("connect")}</button></div>
      <input type="hidden" name="remember" value="on"></form>`);
  }
  if (lf && lf.state !== "connected") {
    parts.push(`<form class="quick-form" data-form="lastfm">
      <label for="lf-user">${t("lf_user")}</label><input class="input" id="lf-user" name="username" autocomplete="username" required spellcheck="false">
      <label for="lf-key">${t("lf_key")}</label><input class="input" id="lf-key" name="api_key" autocomplete="off" required spellcheck="false">
      <small class="faint">${t("lf_key_help")}</small>
      <div><button class="btn btn-primary">${t("connect")}</button></div></form>`);
  }
  if (!parts.length) return "";
  return `<section class="way"><h3>${icon("user")} ${t("mu_way1")}</h3><p class="muted">${t("mu_way1_d")}</p><div class="quick-grid">${parts.join("")}</div></section>`;
}
function fileBlock(cards) {
  const importable = cards.filter((c) => c.can_import).sort((a, b) => FILE_ORDER.indexOf(a.id) - FILE_ORDER.indexOf(b.id));
  if (!importable.length) return "";
  const first = importable[0];
  return `<section class="way"><h3>${icon("upload")} ${t("mu_way2")}</h3><p class="muted">${t("mu_way2_d")}</p>
    <div class="file-row">
      <div class="field"><label for="imp-service">${t("service")}</label>
        <select class="input" id="imp-service">${importable.map((c) => `<option value="${esc(c.id)}" data-how="${esc(fileHelp(c.id))}">${esc(c.label)}</option>`).join("")}</select></div>
      <label class="btn btn-primary file-btn">${icon("upload")} ${t("choose_file")}<input type="file" data-act="import" accept=".json,.csv,.html,.htm,.tsv,.txt"></label>
    </div>
    <div class="file-help"><b>${t("file_where")}</b><p id="imp-how">${esc(fileHelp(first.id))}</p></div>
  </section>`;
}
function directBlock(cards, onboarding) {
  const list = DIRECT.map((id) => cards.find((c) => c.id === id)).filter((c) => c && c.state !== "connected");
  if (!list.length) return "";
  const grid = `<div class="direct-grid">${list.map((c) => directCard(c)).join("")}</div>`;
  if (onboarding) {
    return `<details class="way way-fold"><summary><h3>${icon("link")} ${t("mu_way3")}</h3><p class="muted">${t("mu_way3_d")}</p></summary>${grid}</details>`;
  }
  return `<section class="way"><h3>${icon("link")} ${t("mu_way3")}</h3><p class="muted">${t("mu_way3_d")}</p>${grid}</section>`;
}
function directCard(c) {
  const ready = c.configured && c.can_connect;
  const status = ready ? `<span class="badge live">${t("s_ready")}</span>` : `<span class="badge setup">${t("s_setup")}</span>`;
  const acts = [];
  if (ready) acts.push(`<button class="btn btn-sm btn-primary" data-act="connect" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">${t("connect")}</button>`);
  acts.push(`<button class="btn btn-sm ${ready ? "btn-ghost" : ""}" data-act="setup">${ready ? t("change_setup") : t("set_up")}</button>`);
  if (c.configured) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-act="forget" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">${t("forget_setup")}</button>`);
  return `<article class="provider" aria-labelledby="pv-${esc(c.id)}">
    <div class="provider-head"><div class="provider-name" id="pv-${esc(c.id)}">${esc(c.label)}</div>${status}</div>
    ${c.reads ? `<p class="how">${esc(c.reads)}</p>` : ""}
    ${c.error ? `<p class="err" role="alert">${esc(c.error)}</p>` : ""}
    ${setupPanel(c)}
    <div class="provider-actions">${acts.join("")}</div>
  </article>`;
}
function setupPanel(c) {
  const s = c.setup;
  if (!s) return "";
  const fid = (f) => `su-${esc(c.id)}-${esc(f.name)}`;
  const fields = s.fields.map((f) => {
    const stored = (c.config_public || {})[f.name];
    const ph = f.secret && stored ? t("keep_blank") : "";
    const input = f.multiline
      ? `<textarea class="input" id="${fid(f)}" name="${esc(f.name)}" rows="4" autocomplete="off" spellcheck="false" placeholder="${esc(ph)}"></textarea>`
      : `<input class="input" id="${fid(f)}" name="${esc(f.name)}" ${f.secret ? 'type="password"' : ""} autocomplete="off" spellcheck="false" value="${f.secret ? "" : esc(stored || "")}" placeholder="${esc(ph)}" ${f.required && !(f.secret && stored) ? "required" : ""}>`;
    return `<div class="field"><label for="${fid(f)}">${esc(f.label)}${f.required ? "" : ` <span class="faint">(${t("optional")})</span>`}</label>${input}${f.help ? `<small class="faint">${esc(f.help)}</small>` : ""}</div>`;
  }).join("");
  const addr = c.id === "deezer" ? s.redirect_domain : s.redirect_uri;
  const redirect = s.redirect_uri ? `<div class="field"><span class="field-label">${c.id === "deezer" ? t("redirect_deezer") : s.needs_redirect_registration ? t("redirect_reg") : t("redirect_none")}</span>
      <div class="copy-row"><code class="copy-value">${esc(addr)}</code><button type="button" class="btn btn-sm btn-ghost" data-act="copy" data-value="${esc(addr)}">${t("copy")}</button></div></div>` : "";
  return `<form class="stack setup-form" data-form="setup" data-provider="${esc(c.id)}" data-label="${esc(c.label)}" hidden>
      <p class="faint" style="font-size:12.5px">${esc(t("setup_intro", { s: c.label }))}</p>
      <ol class="setup-steps">${s.setup_steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      ${s.dashboard_url ? `<p><a class="link-btn" href="${esc(s.dashboard_url)}" target="_blank" rel="noopener noreferrer">${t("open_dev")}</a></p>` : ""}
      ${redirect}${fields}
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
      <label class="check"><input type="checkbox" name="remember" checked> ${t("stay")}</label>
      <div class="provider-actions"><button class="btn btn-sm btn-primary">${t("save_connect")}</button></div>
      <p class="faint" style="font-size:12px">${t("local_only")}</p>
    </form>`;
}
function addMusicBlocks(cards, onboarding) {
  return `<div class="ways">${quickBlock(cards)}${fileBlock(cards)}${directBlock(cards, onboarding)}</div>`;
}
async function startConnect(p, label, remember = true) {
  const { connect } = await api(`sources/${p}/connect`, { method: "POST", body: { remember } });
  if (connect.redirect) { location.href = connect.redirect; return false; }
  const { sync } = await api(`sources/${p}/sync`, { method: "POST", body: {} });
  toast(t("t_connected", { s: label, n: n(sync.events) }), "ok");
  return true;
}
// One handler set for both the onboarding step and the My music page.
// After any change outside onboarding the taste is rebuilt automatically.
function bindAddMusic(root, { onboarding }) {
  const changed = async () => {
    if (!onboarding) { try { await rebuildTaste(); } catch (e) { showError(e); } }
    route();
  };
  root.addEventListener("change", async (ev) => {
    if (ev.target.id === "imp-service") {
      const o = ev.target.selectedOptions[0];
      $("#imp-how", root).textContent = o?.dataset.how || "";
      return;
    }
    const input = ev.target.closest('input[type="file"][data-act="import"]');
    if (!input || !input.files.length) return;
    const fd = new FormData();
    fd.append("provider", $("#imp-service", root).value);
    fd.append("file", input.files[0]);
    const label = input.closest("label");
    label.classList.add("is-busy"); label.setAttribute("aria-busy", "true");
    try {
      const { import: r } = await api("sources/import", { method: "POST", form: fd });
      toast(`${t("t_import", { s: r.label, n: n(r.events) })}${(r.notes || []).length ? " " + r.notes.join(" ") : ""}`, "ok");
      await changed();
    } catch (e) { showError(e); label.classList.remove("is-busy"); label.removeAttribute("aria-busy"); input.value = ""; }
  });
  root.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const p = b.dataset.provider, name = b.dataset.label;
    try {
      if (b.dataset.act === "sync") {
        b.disabled = true; b.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> ${t("syncing")}`;
        const { sync } = await api(`sources/${p}/sync`, { method: "POST", body: {} });
        toast(t("t_synced", { s: sync.label || name, n: n(sync.events) }), "ok");
        await changed();
      } else if (b.dataset.act === "connect") {
        b.disabled = true;
        if (await startConnect(p, name, true)) await changed();
      } else if (b.dataset.act === "setup") {
        const f = $('[data-form="setup"]', b.closest(".provider")); f.hidden = false; b.hidden = true;
        const first = $("input:not([type=checkbox]), textarea", f); if (first) first.focus();
      } else if (b.dataset.act === "copy") {
        try { await navigator.clipboard.writeText(b.dataset.value); toast(t("copied"), "ok"); }
        catch { toast(t("copy_fail"), "error"); }
      } else if (b.dataset.act === "forget") {
        if (!(await confirmDialog(t("q_forget", { s: name }), t("q_forget_d"), t("forget_setup")))) return;
        await api(`sources/${p}/forget`, { method: "POST", body: { confirm: true } });
        toast(t("t_forgot", { s: name }), "ok"); route();
      } else if (b.dataset.act === "disconnect") {
        if (!(await confirmDialog(t("q_disc", { s: name }), t("q_disc_d"), t("disconnect")))) return;
        await api(`sources/${p}/disconnect`, { method: "POST", body: { confirm: true } });
        toast(t("t_disc", { s: name }), "ok"); route();
      } else if (b.dataset.act === "remove") {
        if (!(await confirmDialog(t("q_rm", { s: name }), t("q_rm_d"), t("remove")))) return;
        await api(`sources/${p}/remove`, { method: "POST", body: { confirm: true } });
        toast(t("t_removed", { s: name }), "ok");
        const left = (await api("sources")).active_count;
        if (left) await changed(); else route();
      }
    } catch (e) { showError(e); b.disabled = false; route(); }
  });
  root.addEventListener("submit", async (ev) => {
    const sf = ev.target.closest('[data-form="setup"]');
    if (sf) {
      ev.preventDefault();
      const p = sf.dataset.provider;
      const fd = new FormData(sf);
      const remember = fd.get("remember") === "on";
      fd.delete("remember");
      const fields = Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));
      const btn = $("button.btn-primary", sf); btn.disabled = true;
      try {
        await api(`sources/${p}/setup`, { method: "POST", body: { fields } });
        if (await startConnect(p, sf.dataset.label, remember)) await changed();
      } catch (e) { showError(e); btn.disabled = false; }
      return;
    }
    const f = ev.target.closest('[data-form="lastfm"]');
    if (!f) return;
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    const btn = $("button", f); btn.disabled = true;
    try {
      await api("sources/lastfm/credentials", { method: "POST", body: data });
      const { sync } = await api("sources/lastfm/sync", { method: "POST", body: {} });
      toast(t("t_connected", { s: "Last.fm", n: n(sync.events) }), "ok");
      await changed();
    } catch (e) { showError(e); btn.disabled = false; }
  });
}
async function viewSources(m, params) {
  const st = await refresh();
  if (params.get("spotify") === "failed") toast(t("t_conn_fail", { s: "Spotify" }), "error");
  const cf = params.get("connect_failed");
  if (cf) toast(t("t_conn_fail", { s: SOURCE_NAMES[cf] || t("the_service") }), "error");
  const done = params.get("connected") || (params.get("spotify") === "connected" ? "spotify" : null);
  if (done && S.lastConnectToast !== location.hash) {
    S.lastConnectToast = location.hash;
    try {
      const { sync } = await api(`sources/${done}/sync`, { method: "POST", body: {} });
      toast(t("t_connected", { s: SOURCE_NAMES[done] || done, n: n(sync.events) }), "ok");
      await rebuildTaste({ quiet: true });
      if (!S.state.onboarding_completed) await api("onboarding/complete", { method: "POST", body: {} });
    } catch (e) { showError(e); }
    history.replaceState(null, "", "#/music");
    return viewSources(m, new URLSearchParams());
  }
  const src = await api("sources");
  return `<div class="page-head"><div><h1>${t("mu_title")}</h1><p>${t("mu_lead")}</p></div></div>
    ${st.dna?.demo ? `<div class="notice demo" style="margin-bottom:16px"><span class="badge demo">${t("demo")}</span><div><b>${t("demo_on")}</b></div></div>` : ""}
    ${activeList(src.cards)}
    <section class="card" style="margin-top:16px" aria-labelledby="add-title"><h2 id="add-title">${t("mu_add")}</h2>${addMusicBlocks(src.cards, false)}</section>
    <p class="faint" style="margin-top:16px;font-size:12.5px">${t("mu_note")}</p>`;
}
viewSources.after = () => { bindAddMusic(root(), { onboarding: false }); };

/* ------------------------------------------------------------------ settings */
const PROVIDERS = { spotify: "Spotify", apple_music: "Apple Music", youtube_music: "YouTube Music", deezer: "Deezer", tidal: "TIDAL", soundcloud: "SoundCloud" };
const SOURCE_NAMES = { ...PROVIDERS, listenbrainz: "ListenBrainz", lastfm: "Last.fm" };
async function viewSettings() {
  const { settings: s } = await api("settings");
  S.settings = s;
  const fb = s.fallback_order.filter((p) => p !== s.preferred_provider);
  const avail = Object.keys(PROVIDERS).filter((p) => p !== s.preferred_provider && !fb.includes(p));
  return `<div class="page-head"><div><h1>${t("set_title")}</h1></div></div>
  <section class="card"><div class="settings-list">
    <div class="setting"><div><b id="lang-l">${t("language")}</b></div>
      <div class="segmented" role="radiogroup" aria-labelledby="lang-l">${LANGS.map((l) => `<button role="radio" aria-checked="${LANG === l}" data-lang="${l}">${{ ru: "Русский", uk: "Українська", en: "English" }[l]}</button>`).join("")}</div></div>
    <div class="setting"><div><b><label for="pref">${t("pref")}</label></b><small>${t("pref_d")}</small></div>
      <select class="input" id="pref" data-set="preferred_provider" style="max-width:240px">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === s.preferred_provider ? "selected" : ""}>${v}</option>`).join("")}</select></div>
  </div></section>
  <section class="card" style="margin-top:16px"><div class="nav-list">
    <a href="#/settings/privacy"><span><b>${t("privacy_link")}</b><small>${t("privacy_link_d")}</small></span>${icon("lock")}</a>
    <a href="#/history"><span><b>${t("past")}</b></span>${icon("history")}</a>
    <a href="#/welcome"><span><b>${t("replay")}</b></span>${icon("arrow")}</a>
  </div></section>
  <details class="card more-card" style="margin-top:16px"><summary><b>${t("for_pros")}</b></summary>
    <div class="settings-list" style="margin-top:12px">
      <div class="setting column"><div><b>${t("fallbacks")}</b></div>
        <ol class="fallbacks">${fb.map((p, i) => `<li><span>${i + 1}. ${PROVIDERS[p]}</span>
          <button class="btn btn-sm btn-ghost" data-act="fb-up" data-p="${p}" ${i === 0 ? "disabled" : ""} aria-label="${t("up")}: ${PROVIDERS[p]}">${icon("up")}</button>
          <button class="btn btn-sm btn-ghost" data-act="fb-down" data-p="${p}" ${i === fb.length - 1 ? "disabled" : ""} aria-label="${t("down")}: ${PROVIDERS[p]}">${icon("down")}</button>
          <button class="btn btn-sm btn-ghost" data-act="fb-rm" data-p="${p}">${t("rm")}</button></li>`).join("") || `<li><span class="faint">${t("fb_none")}</span></li>`}</ol>
        ${avail.length ? `<div class="row" style="margin-top:10px"><select class="input" id="fb-add" aria-label="${t("add")}" style="flex:1">${avail.map((p) => `<option value="${p}">${PROVIDERS[p]}</option>`).join("")}</select><button class="btn btn-sm" data-act="fb-add">${t("add")}</button></div>` : ""}</div>
      <div class="setting"><div><b id="motion-l">${t("motion")}</b><small>${t("motion_d")}</small></div>
        <div class="segmented" role="radiogroup" aria-labelledby="motion-l">${["system", "reduced", "full"].map((m) => `<button role="radio" aria-checked="${s.motion === m}" data-act="motion" data-value="${m}">${t("m_" + m)}</button>`).join("")}</div></div>
      <label class="setting switch"><div><b>${t("analytics")}</b><small>${t("analytics_d")}</small></div><input type="checkbox" data-set="analytics_enabled" ${s.analytics_enabled ? "checked" : ""}></label>
      <label class="setting switch"><div><b>${t("adv_mode")}</b><small>${t("adv_mode_d")}</small></div><input type="checkbox" data-set="advanced_mode" ${s.advanced_mode ? "checked" : ""}></label>
    </div>
    <div class="nav-list" style="margin-top:12px">
      <a href="#/settings/advanced"><span><b>${t("adv_link")}</b><small>${t("adv_link_d")}</small></span>${icon("arrow")}</a>
      <a href="/classic"><span><b>${t("classic")}</b><small>${t("classic_d")}</small></span>${icon("external")}</a>
    </div>
  </details>`;
}
viewSettings.after = () => {
  const main = root();
  const save = async (changes, msg) => {
    try { const { settings } = await api("settings", { method: "POST", body: changes }); S.settings = settings; applyMotion(); if (msg) toast(msg, "ok"); route(); }
    catch (e) { showError(e); }
  };
  main.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-set]");
    if (!el) return;
    const v = el.type === "checkbox" ? el.checked : el.value;
    const ch = { [el.dataset.set]: v };
    if (el.dataset.set === "preferred_provider") ch.fallback_order = S.settings.fallback_order.filter((p) => p !== v);
    save(ch, t("saved"));
  });
  main.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const fb = S.settings.fallback_order.filter((p) => p !== S.settings.preferred_provider);
    const i = fb.indexOf(b.dataset.p);
    if (b.dataset.act === "motion") save({ motion: b.dataset.value });
    if (b.dataset.act === "fb-up" && i > 0) { [fb[i - 1], fb[i]] = [fb[i], fb[i - 1]]; save({ fallback_order: fb }); }
    if (b.dataset.act === "fb-down" && i < fb.length - 1) { [fb[i + 1], fb[i]] = [fb[i], fb[i + 1]]; save({ fallback_order: fb }); }
    if (b.dataset.act === "fb-rm") save({ fallback_order: fb.filter((p) => p !== b.dataset.p) });
    if (b.dataset.act === "fb-add") save({ fallback_order: [...fb, $("#fb-add").value] });
  });
};

async function viewPrivacy() {
  const p = await api("privacy");
  const fmtB = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`);
  return `<div class="page-head"><div><p class="eyebrow"><a href="#/settings" class="link-btn">${t("set_title")}</a> /</p><h1>${t("pv_title")}</h1><p>${t("pv_lead")}</p></div></div>
  <div class="grid grid-2">
    <section class="card privacy-sec"><h3>${t("pv_local")}</h3><p>${esc(p.stays_local)}</p><p style="margin-top:8px">${esc(p.network_calls)}</p></section>
    <section class="card privacy-sec"><h3>${t("pv_imported")}</h3>${p.imported.length ? `<dl class="kv" style="margin-top:8px">${p.imported.map((i) => `<dt>${esc(i.label)}</dt><dd>${esc(i.file)} · ${fmtB(i.bytes)}</dd>`).join("")}</dl>` : `<p>${t("pv_nothing")}</p>`}</section>
    <section class="card privacy-sec"><h3>${t("pv_stored")}</h3><dl class="kv" style="margin-top:8px">
      <dt>${t("pv_dna")}</dt><dd>${p.stored.music_dna.exists ? fmtB(p.stored.music_dna.bytes) : t("pv_not_built")}</dd>
      <dt>${t("pv_caps")}</dt><dd>${p.stored.capsules.count}</dd>
      <dt>${t("pv_fb")}</dt><dd>${p.stored.feedback.count}</dd>
      <dt>${t("pv_events")}</dt><dd>${p.stored.analytics_events.count}</dd>
      <dt>${t("pv_creds")}</dt><dd>${p.stored.connections && p.stored.connections.exists ? `${fmtB(p.stored.connections.bytes)} · ${t("pv_private")}` : t("pv_none")}</dd></dl>
      ${p.stored.connections && p.stored.connections.exists ? `<p class="faint" style="font-size:12.5px;margin-top:8px">${esc(p.stored.connections.contains)} ${esc(p.stored.connections.file)}</p>` : ""}</section>
    <section class="card privacy-sec"><h3>${t("pv_analytics")}</h3><p><b>${p.analytics.enabled ? t("pv_on") : t("pv_off")}</b> · ${t("pv_local_only")} ${esc(p.analytics.contains)}</p><p style="margin-top:8px"><b>${t("pv_never")}</b> ${esc(p.analytics.never_contains)}</p></section>
  </div>
  <section class="card" style="margin-top:16px"><h2>${t("pv_export")}</h2><p class="muted" style="margin:6px 0 14px">${t("pv_export_d")}</p>
    <div class="row"><a class="btn btn-sm" href="/api/v3/export/dna" download>${t("ex_dna")}</a><a class="btn btn-sm" href="/api/v3/export/history" download>${t("ex_hist")}</a>
      <a class="btn btn-sm" href="/api/v3/export/feedback" download>${t("ex_fb")}</a><a class="btn btn-sm" href="/api/v3/export/analytics" download>${t("ex_an")}</a></div></section>
  <section class="card" style="margin-top:16px"><h2>${t("pv_delete")}</h2><p class="muted" style="margin:6px 0 14px">${t("pv_delete_d")}</p>
    <div class="settings-list">
      ${[["reset_session", "pa_session", "reset"], ["delete_history", "pa_hist", "pv_delete"], ["reset_dna", "pa_dna", "reset"],
         ["delete_analytics", "pa_an", "pv_delete"], ["forget_connections", "pa_conn", "forget"]].map(([a, k, l]) =>
        `<div class="setting"><div><b>${t(k)}</b><small>${t(k + "_d")}</small></div><button class="btn btn-sm btn-danger" data-act="priv" data-action="${a}" data-title="${esc(t(k))}" data-desc="${esc(t(k + "_d"))}" data-label="${esc(t(l))}">${t(l)}</button></div>`).join("")}
      <div class="setting"><div><b>${t("nav_music")}</b></div><a class="btn btn-sm" href="#/music">${t("nav_music")}</a></div>
    </div></section>`;
}
viewPrivacy.after = () => {
  root().addEventListener("click", async (ev) => {
    const b = ev.target.closest('[data-act="priv"]');
    if (!b) return;
    if (!(await confirmDialog(`${b.dataset.title}?`, b.dataset.desc, b.dataset.label))) return;
    try {
      await api(`privacy/${b.dataset.action}`, { method: "POST", body: { confirm: true } });
      toast(t("done"), "ok"); await refresh(); route();
    } catch (e) { showError(e); }
  });
};

async function viewAdvanced(m) {
  const tab = (m && m[1]) || "quality";
  const tabs = [["quality", "tab_quality"], ["beta", "tab_beta"], ["identity", "tab_identity"], ["diagnostics", "tab_diag"]];
  const data = await api(`advanced/${tab}`);
  let body = "";
  const metric = (name, v, def, fmt = pct) => `<div class="metric"><span class="name">${esc(name)}</span><b>${v == null ? "—" : fmt(v)}</b><small>${esc(def)}</small></div>`;
  if (tab === "quality") {
    const L = data.latest, D = data.definitions;
    body = `<div class="notice warn"><div><b>${t("proxy")}</b><p>${esc(data.caveat)}</p></div></div>
      ${L ? `<h2 style="margin:18px 0 12px">${esc(cap1(L.label))} <span class="faint">· ${L.count}</span></h2><div class="metric-grid">
        ${metric("Relevance proxy", L.relevance_proxy, D.relevance_proxy)}${metric("Diversity", L.diversity, D.diversity)}${metric("Novelty", L.novelty, D.novelty)}
        ${metric("Coverage", L.catalog_coverage, D.catalog_coverage)}${metric("Artist concentration", L.artist_concentration, D.artist_concentration, (v) => v.toFixed(2))}
        ${metric("Context fit", L.context_fit, D.context_fit)}${metric("Calibration", L.calibration, D.calibration)}</div>` : `<p class="muted" style="margin-top:14px">${t("open_to_eval")}</p>`}
      <h2 style="margin:22px 0 12px">${t("outcomes")}</h2>
      ${data.outcomes.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t("col_tier")}</th><th>${t("col_ctx")}</th><th class="num">${t("col_n")}</th><th class="num">${t("col_done")}</th><th class="num">${t("col_save")}</th><th class="num">${t("col_replay")}</th><th class="num">${t("col_reject")}</th></tr></thead><tbody>
        ${data.outcomes.map((o) => `<tr><td>${esc(cap1(o.rarity))}</td><td>${esc(o.task || "—")}</td><td class="num">${o.sessions}</td><td class="num">${pct(o.completion_rate)}</td><td class="num">${pct(o.save_rate)}</td><td class="num">${pct(o.replay_rate)}</td><td class="num">${pct(o.rejection_rate)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">${t("no_completed")}</p>`}`;
  } else if (tab === "beta") {
    const f = data.funnel;
    const bd = (key, title) => {
      const rows = Object.entries(data.breakdowns[key] || {});
      return `<h3 style="margin:18px 0 8px">${title}</h3>${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${title}</th><th class="num">${t("col_opened")}</th><th class="num">${t("col_started")}</th><th class="num">${t("col_done")}</th><th class="num">%</th><th class="num">${t("col_save")}</th><th class="num">${t("col_replay")}</th><th class="num">${t("col_reject")}</th></tr></thead><tbody>
        ${rows.map(([k, r]) => `<tr><td>${esc(k)}</td><td class="num">${r.opened}</td><td class="num">${r.started}</td><td class="num">${r.completed}</td><td class="num">${pct(r.completion_rate)}</td><td class="num">${pct(r.save_rate)}</td><td class="num">${pct(r.replay_rate)}</td><td class="num">${pct(r.rejection_rate)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="faint">${t("no_data")}</p>`}`;
    };
    body = `<div class="notice"><div><b>${t("tab_beta")} · ${data.enabled ? t("pv_on") : t("pv_off")}</b><p>${t("variant")}: <b>${esc(data.variant)}</b> (${esc(data.algorithm_version)}).</p></div></div>
      <div class="metric-grid" style="margin-top:16px">
        ${metric(t("sessions"), data.sessions, "", n)}${metric(t("col_opened"), f.capsule_opened.sessions, "", n)}
        ${metric(t("col_started"), f.capsule_started.sessions, "", n)}${metric(t("col_done"), f.capsule_completed.sessions, "", n)}
        ${metric("%", f.capsule_completed.session_rate, "")}${metric("Return rate", data.retention.return_rate, `${data.retention.returned_users}/${data.retention.users}`)}
      </div>
      ${bd("capsule_rarity", t("col_tier"))}${bd("context", t("col_ctx"))}${bd("provider", t("service"))}${bd("algorithm_variant", t("variant"))}`;
  } else if (tab === "identity") {
    body = `<div class="notice"><div><b>${t("cross_n", { n: n(data.cross_service_tracks) })}</b><p>${esc(data.policy)}</p></div></div>
      <div class="chips" style="margin:14px 0">${Object.entries(data.methods).map(([k, v]) => `<span class="chip">${esc(k)} · ${v}</span>`).join("")}</div>
      ${data.tracks.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t("col_track")}</th><th>${t("col_found")}</th><th>${t("col_method")}</th><th>${t("col_conf")}</th></tr></thead><tbody>
        ${data.tracks.map((x) => `<tr><td>${esc(x.title)} <span class="muted">· ${esc(x.artist)}</span></td><td>${esc(x.found_on.join(", "))}</td><td>${esc(x.method)}</td><td>${esc(x.confidence)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">${t("cross_none")}</p>`}`;
  } else {
    body = `<dl class="kv"><dt>${t("version")}</dt><dd>${esc(data.version)}</dd><dt>${t("data_folder")}</dt><dd class="mono">${esc(data.outputs)}</dd></dl>
      <h3 style="margin:18px 0 8px">${t("recent_issues")}</h3>${data.diagnostics.length ? `<pre class="code">${esc(data.diagnostics.map((d) => `${d.ts}  ${d.code}  ${d.message}${d.detail ? "\n    " + (typeof d.detail === "string" ? d.detail.split("\n").slice(-3).join("\n    ") : JSON.stringify(d.detail)) : ""}`).join("\n"))}</pre>` : `<p class="muted">${t("no_issues")}</p>`}`;
  }
  return `<div class="page-head"><div><p class="eyebrow"><a href="#/settings" class="link-btn">${t("set_title")}</a> /</p><h1>${t("adv_title")}</h1><p>${t("adv_lead")}</p></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" data-href="#/settings/advanced/${k}">${t(l)}</button>`).join("")}</div>
    <section class="card">${body}</section>`;
}
viewAdvanced.after = () => {
  root().addEventListener("click", (ev) => { const b = ev.target.closest("[data-href]"); if (b) location.hash = b.dataset.href; });
};

function viewNotFound() {
  return `<h1>${t("not_found")}</h1><p class="muted" style="margin:10px 0 18px">${t("not_found_t")}</p><a class="btn" href="#/">${t("back_home")}</a>`;
}

/* ------------------------------------------------------------------ boot */
applyStatic();
window.addEventListener("hashchange", route);
window.addEventListener("offline", () => toast(t("offline_toast"), "error"));
route();
