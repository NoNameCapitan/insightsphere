"""Russian and Ukrainian wording for the 3.x JSON API.

The product layer writes its user-facing text in English. The web app sends
`X-MusicDNA-Lang: ru|uk|en`; `localize()` then rewrites the text fields of the
response. Only known UI keys are touched, never data: track titles, artist
names and genres pass through unchanged. Unknown text stays in English rather
than being guessed.
"""
from __future__ import annotations

import re

LANGS = ("en", "ru", "uk")
LANG_HEADER = "X-MusicDNA-Lang"

# Keys whose string values are UI text (translated when an exact or pattern match exists).
TEXT_KEYS = {
    "label", "tier_label", "tagline", "intent_label", "intent", "how_to", "note", "reads", "limits", "help",
    "setup_steps", "text", "title", "message", "why", "caution", "match_note", "distance", "level", "reasons",
    "basis", "reason", "explanation", "detail", "discovery_definition", "stays_local", "network_calls",
    "contains", "never_contains", "completed_note", "learned_empty_reason", "evidence", "state_words",
    "notes", "confidence", "deletable", "caveat", "policy",
}
# In these objects the listed keys are data, not UI text.
DATA_KEYS_WHEN = (("artist", {"title", "label", "text"}),)

# en -> (ru, uk)
EXACT = {
    # tiers / intents
    "Common": ("Знакомое", "Знайоме"),
    "Rare": ("Смесь", "Суміш"),
    "Legendary": ("Открытия", "Відкриття"),
    "Mystery": ("Сюрприз", "Сюрприз"),
    "High confidence. Comfort plus a small discovery.": ("То, что точно понравится, и чуть-чуть нового.", "Те, що точно сподобається, і трохи нового."),
    "Balanced. Known taste plus meaningful exploration.": ("Поровну знакомого и нового.", "Порівну знайомого й нового."),
    "Deep discovery. Further out, still explainable.": ("Больше нового: дальше от привычного, но в твоём духе.", "Більше нового: далі від звичного, але у твоєму дусі."),
    "Trust the algorithm. Identities stay hidden until you reveal them.": ("Названия скрыты, пока не откроешь трек.", "Назви приховані, доки не відкриєш трек."),
    "Focus": ("Работа и учёба", "Робота й навчання"),
    "Energy": ("Бодрость", "Бадьорість"),
    "Chill": ("Отдых", "Відпочинок"),
    "Night drive": ("Ночная поездка", "Нічна поїздка"),
    "Workout": ("Спорт", "Спорт"),
    "Deep listen": ("Слушать внимательно", "Слухати уважно"),
    "Discover": ("Что-то новое", "Щось нове"),
    "Surprise me": ("Удиви меня", "Здивуй мене"),
    "Surprise": ("Удиви меня", "Здивуй мене"),
    # DNA words / coverage
    "Melancholic": ("Меланхолия", "Меланхолія"), "Energetic": ("Энергия", "Енергія"), "Calm": ("Спокойствие", "Спокій"),
    "Dark": ("Мрачное", "Похмуре"), "Happy": ("Радость", "Радість"), "Aggressive": ("Напор", "Напір"),
    "Uplifting": ("Подъём", "Піднесення"), "Dreamy": ("Мечтательность", "Мрійливість"), "Romantic": ("Романтика", "Романтика"),
    "High-energy": ("Высокая энергия", "Висока енергія"), "Low-energy": ("Спокойный темп", "Спокійний темп"),
    "Mid-energy": ("Средняя энергия", "Середня енергія"), "Exploratory": ("Любопытство", "Допитливість"),
    "Loyal": ("Верность любимому", "Вірність улюбленому"), "Balanced": ("Баланс", "Баланс"),
    "Other": ("Другое", "Інше"), "Ukrainian": ("Украинское", "Українське"),
    "High": ("Высокое", "Високе"), "Medium": ("Среднее", "Середнє"), "Low": ("Низкое", "Низьке"),
    "single source": ("один источник", "одне джерело"), "few timestamps": ("мало дат прослушиваний", "мало дат прослуховувань"),
    "Close": ("Близко", "Близько"), "Moderate": ("Чуть дальше", "Трохи далі"), "Far": ("Далеко", "Далеко"),
    "Demo library": ("Демо-библиотека", "Демо-бібліотека"),
    "likely": ("вероятно", "ймовірно"), "early signal": ("первый сигнал", "перший сигнал"), "observed": ("замечено", "помічено"),
    # explanations
    "Short-term context from this listening session. It nudges the next capsule (at most ±12%) and fades after a few hours; it never rewrites your core DNA.":
        ("Настроение этого сеанса. Слегка влияет на следующую подборку и забывается через несколько часов.",
         "Настрій цього сеансу. Трохи впливає на наступну добірку й забувається за кілька годин."),
    "Blend of genre and artist affinity, mood and context fit, and your feedback. Not a probability.":
        ("Насколько трек похож на твой вкус: жанры, артисты, настроение и твои оценки.",
         "Наскільки трек схожий на твій смак: жанри, артисти, настрій і твої оцінки."),
    "You frequently return to": ("Ты часто слушаешь", "Ти часто слухаєш"),
    "This track sits outside your usual artist network.": ("Этот артист новый для тебя.", "Цей артист новий для тебе."),
    "Your recent reactions nudged it up.": ("Твои недавние оценки подняли его выше.", "Твої нещодавні оцінки підняли його вище."),
    "It's close to what you liked earlier this session.": ("Похоже на то, что тебе понравилось сегодня.", "Схоже на те, що тобі сподобалося сьогодні."),
    "A controlled step from your profile; evidence for this pick is thin.": ("Осторожный шаг в сторону от твоего вкуса.", "Обережний крок убік від твого смаку."),
    "No exact match known yet — this opens a search, not the exact track.": ("Откроется поиск по названию.", "Відкриється пошук за назвою."),
    "Changes come from your recorded reactions. A single skip is bounded, reactions inside Legendary/Mystery capsules count half when negative, and one capsule can only move a genre so far — so one evening never rewrites years of listening.":
        ("Вкус меняется от твоих оценок, но понемногу: один вечер не перечеркнёт годы прослушиваний.",
         "Смак змінюється від твоїх оцінок, але потроху: один вечір не перекреслить роки прослуховувань."),
    "Tracks you loved, saved, replayed or asked more of, by artists that aren't in your imported listening history.":
        ("Треки новых для тебя артистов, которые тебе понравились.", "Треки нових для тебе артистів, які тобі сподобалися."),
    "From your latest DNA build.": ("Из последнего обновления.", "З останнього оновлення."),
    "Your artist network expanded.": ("Ты открыл новых артистов.", "Ти відкрив нових артистів."),
    "Discovery tolerance": ("Любовь к новому", "Любов до нового"),
    "Artist cluster expanded": ("Новые артисты", "Нові артисти"),
    # dimensions
    "Genres the taxonomy classifies as microgenres": ("Узкие поджанры", "Вузькі піджанри"),
    "Share of distinct tracks, adjusted by your 'too similar' / 'too strange' feedback": ("Доля разных треков с учётом твоих оценок", "Частка різних треків з урахуванням твоїх оцінок"),
    "Your sources don't report track popularity for enough tracks.": ("Нет данных о популярности треков.", "Немає даних про популярність треків."),
    "Not enough timestamped plays to compare recent vs older listening.": ("Мало прослушиваний с датами.", "Мало прослуховувань із датами."),
    "Open a few capsules in different moods to learn this.": ("Открой несколько подборок под разное настроение.", "Відкрий кілька добірок під різний настрій."),
    "None of your tracks carry genre information yet.": ("У треков пока нет жанров.", "У треків поки немає жанрів."),
    "No microgenre-level tags found in your history.": ("Узких поджанров не найдено.", "Вузьких піджанрів не знайдено."),
    "No artist information found.": ("Нет данных об артистах.", "Немає даних про артистів."),
    "Learned from feedback given inside each context": ("По твоим оценкам в разных ситуациях", "За твоїми оцінками в різних ситуаціях"),
    "Newest third of dated plays vs oldest third": ("Новые прослушивания против старых", "Нові прослуховування проти старих"),
    # build steps
    "Reading listening history": ("Читаю историю прослушиваний", "Читаю історію прослуховувань"),
    "Resolving duplicate tracks": ("Убираю повторы", "Прибираю повтори"),
    "Matching artists": ("Собираю артистов", "Збираю артистів"),
    "Mapping genres": ("Определяю жанры", "Визначаю жанри"),
    "Calculating affinities": ("Считаю, что ты любишь больше", "Рахую, що ти любиш більше"),
    "Building discovery profile": ("Смотрю, насколько ты любишь новое", "Дивлюся, наскільки ти любиш нове"),
    "Building Music DNA": ("Собираю твой музыкальный вкус", "Збираю твій музичний смак"),
    # sources: service descriptions
    "Live read-only connection, or your Extended Streaming History (.json) from Spotify's privacy page.":
        ("Прямое подключение (только чтение) или файл истории из настроек приватности Spotify.", "Пряме підключення (лише читання) або файл історії з налаштувань приватності Spotify."),
    "Live connection through Apple's MusicKit sign-in, or the Apple privacy export (Play Activity CSV).":
        ("Вход через Apple или файл «Play Activity» из запроса данных Apple.", "Вхід через Apple або файл «Play Activity» із запиту даних Apple."),
    "Live scrobble sync with your username + free API key, or an export file.":
        ("Имя пользователя и бесплатный ключ API, или файл экспорта.", "Ім'я користувача й безкоштовний ключ API, або файл експорту."),
    "Live public listening history by user name. No password, no developer app.":
        ("Достаточно имени пользователя. Без пароля.", "Досить імені користувача. Без пароля."),
    "Live sign-in with Google for the songs you liked, or Google Takeout watch-history (.json/.html).":
        ("Вход через Google (понравившиеся песни) или файл истории из Google Takeout.", "Вхід через Google (вподобані пісні) або файл історії з Google Takeout."),
    "Live sign-in with your Deezer app for history and favourites, or a CSV/JSON export.":
        ("Вход через Deezer (история и избранное) или файл экспорта.", "Вхід через Deezer (історія та обране) або файл експорту."),
    "CSV/JSON export with track and artist columns.": ("Файл CSV или JSON с названиями треков и артистов.", "Файл CSV або JSON з назвами треків і артистів."),
    "Collection export (CSV/JSON) with track and artist columns.": ("Файл коллекции CSV или JSON.", "Файл колекції CSV або JSON."),
    "Any CSV with track/title and artist columns (play counts, dates, genres optional).": ("Любая таблица CSV с колонками «трек» и «артист».", "Будь-яка таблиця CSV з колонками «трек» і «артист»."),
    "Any JSON list of tracks with title and artist fields.": ("Любой список треков в JSON.", "Будь-який список треків у JSON."),
    "Scanning a folder of audio files is planned, not implemented.": ("Пока не работает.", "Поки не працює."),
    "Generic CSV": ("Таблица CSV", "Таблиця CSV"), "Generic JSON": ("Файл JSON", "Файл JSON"),
    "Local music folder": ("Папка с музыкой", "Тека з музикою"), "Yandex Music": ("Яндекс Музыка", "Яндекс Музика"),
    # sources: notes
    "One-time setup: paste the Client ID of your free Spotify app. After that, Connect is one click.":
        ("Нужна разовая настройка (~5 минут). Потом подключение в один клик.", "Потрібне разове налаштування (~5 хвилин). Потім підключення в один клік."),
    "Not connected right now. Your previously synced or imported data is still part of your DNA.":
        ("Сейчас не подключено. Загруженные раньше данные сохранены.", "Зараз не підключено. Завантажені раніше дані збережено."),
    "Live sync needs your username and a free Last.fm API key. Export files work offline.":
        ("Нужны имя пользователя и бесплатный ключ API Last.fm.", "Потрібні ім'я користувача й безкоштовний ключ API Last.fm."),
    "Uses the generic column importer; official export formats vary.": ("Подойдёт файл с колонками «трек» и «артист».", "Підійде файл з колонками «трек» і «артист»."),
    "Spotify apps in development mode only work for accounts added under User Management.":
        ("Работает только для аккаунтов, добавленных в User Management вашего приложения Spotify.", "Працює лише для акаунтів, доданих у User Management вашого застосунку Spotify."),
    "Apple requires a paid developer membership for MusicKit. Without one, import the Apple privacy export (Play Activity CSV).":
        ("Apple требует платный аккаунт разработчика. Без него загрузите файл экспорта Apple.", "Apple вимагає платний акаунт розробника. Без нього завантажте файл експорту Apple."),
    "Deezer sometimes pauses new developer-app registration; if you can't create one, import an export instead.":
        ("Deezer иногда закрывает регистрацию приложений. Тогда загрузите файл.", "Deezer іноді закриває реєстрацію застосунків. Тоді завантажте файл."),
    "Only listens that reach ListenBrainz are visible (it records what your scrobbler sends).":
        ("Видны только прослушивания, которые попали в ListenBrainz.", "Видно лише прослуховування, що потрапили в ListenBrainz."),
    "Google has no API for YouTube Music play history; use Google Takeout import for that.":
        ("Полную историю YouTube Music можно загрузить только файлом из Google Takeout.", "Повну історію YouTube Music можна завантажити лише файлом з Google Takeout."),
    "No live connection yet: TIDAL's developer API is in beta and offers no play history. Import an export instead.": ("Только файлом: у TIDAL нет доступа к истории.", "Лише файлом: TIDAL не дає доступу до історії."),
    "No live connection: SoundCloud rarely approves new API apps. Import an export instead.": ("Только файлом.", "Лише файлом."),
    "No live connection: Amazon Music's API is invite-only. Import an export instead.": ("Только файлом.", "Лише файлом."),
    "No live connection: Qobuz has no public API for listeners. Import an export instead.": ("Только файлом.", "Лише файлом."),
    "No live connection: Bandcamp has no public API for fans. Import your collection export.": ("Только файлом.", "Лише файлом."),
    "No live connection: Yandex Music has no official public API (unofficial login tools are not used). Import an export.": ("Только файлом: у Яндекс Музыки нет официального API.", "Лише файлом: Яндекс Музика не має офіційного API."),
    "No live connection: Pandora has no public API. Import an export instead.": ("Только файлом.", "Лише файлом."),
    # sources: what each connection reads
    "Top tracks, recently played, saved songs, playlists and followed artists.": ("Любимые и недавние треки, сохранённое, плейлисты, подписки.", "Улюблені й нещодавні треки, збережене, плейлисти, підписки."),
    "Recently played tracks, heavy rotation and the songs in your library.": ("Недавние треки и песни из медиатеки.", "Нещодавні треки й пісні з медіатеки."),
    "Your public listens (up to the latest 5,000).": ("Публичные прослушивания (до 5000 последних).", "Публічні прослуховування (до 5000 останніх)."),
    "Songs you liked on YouTube / YouTube Music (the Music category of your Liked videos) and your channel name.": ("Песни, которым ты поставил лайк.", "Пісні, яким ти поставив вподобайку."),
    "Your recently played tracks and your favourite tracks.": ("Недавние и избранные треки.", "Нещодавні й обрані треки."),
    # sources: setup forms
    "ListenBrainz user name": ("Имя пользователя ListenBrainz", "Ім'я користувача ListenBrainz"),
    "User token (optional)": ("Токен (необязательно)", "Токен (необов'язково)"),
    "Only raises rate limits. Find it at listenbrainz.org → Settings.": ("Не обязателен.", "Не обов'язковий."),
    "Type your ListenBrainz user name. Public listens need no password or app.": ("Введи имя пользователя ListenBrainz.", "Введи ім'я користувача ListenBrainz."),
    "From your app's page in the Spotify developer dashboard. No secret needed (PKCE).": ("Со страницы вашего приложения в Spotify for Developers.", "Зі сторінки вашого застосунку в Spotify for Developers."),
    "Open the Spotify developer dashboard and click “Create app” (free, about two minutes).": ("Откройте Spotify for Developers и нажмите «Create app» (бесплатно, пара минут).", "Відкрийте Spotify for Developers і натисніть «Create app» (безкоштовно, кілька хвилин)."),
    "Add the Redirect URI shown below exactly, and tick “Web API”.": ("Вставьте адрес ниже в поле «Redirect URI» и отметьте «Web API».", "Вставте адресу нижче в поле «Redirect URI» і позначте «Web API»."),
    "Open Settings → User Management and add the Spotify accounts that will connect (apps start in development mode).": ("В Settings → User Management добавьте свой аккаунт Spotify.", "У Settings → User Management додайте свій акаунт Spotify."),
    "Paste the Client ID here.": ("Скопируйте сюда Client ID.", "Скопіюйте сюди Client ID."),
    "Apple Developer → Membership details (10 characters).": ("Apple Developer → Membership details (10 символов).", "Apple Developer → Membership details (10 символів)."),
    "Certificates, Identifiers & Profiles → Keys → your key with MusicKit enabled.": ("Certificates, Identifiers & Profiles → Keys → ключ с MusicKit.", "Certificates, Identifiers & Profiles → Keys → ключ з MusicKit."),
    "Private key (.p8 file contents)": ("Закрытый ключ (содержимое файла .p8)", "Закритий ключ (вміст файлу .p8)"),
    "Open the downloaded AuthKey_XXXX.p8 in a text editor and paste all of it.": ("Откройте файл AuthKey_XXXX.p8 в блокноте и вставьте всё содержимое.", "Відкрийте файл AuthKey_XXXX.p8 у блокноті й вставте весь вміст."),
    "…or a ready developer token (JWT)": ("…или готовый developer token (JWT)", "…або готовий developer token (JWT)"),
    "Use this instead of the three fields above if you already generated a token.": ("Вместо трёх полей выше, если токен уже есть.", "Замість трьох полів вище, якщо токен уже є."),
    "You need an Apple Developer Program membership (Apple requires it for MusicKit).": ("Нужен аккаунт Apple Developer Program.", "Потрібен акаунт Apple Developer Program."),
    "Certificates, Identifiers & Profiles → Keys → create a key with “Media Services (MusicKit)” enabled and download the .p8 file.": ("Certificates, Identifiers & Profiles → Keys → создайте ключ с «Media Services (MusicKit)» и скачайте файл .p8.", "Certificates, Identifiers & Profiles → Keys → створіть ключ з «Media Services (MusicKit)» і завантажте файл .p8."),
    "Paste your Team ID, the Key ID and the .p8 contents here (or a developer token you already have). The token is signed on this computer.": ("Вставьте сюда Team ID, Key ID и содержимое .p8.", "Вставте сюди Team ID, Key ID і вміст .p8."),
    "Google Cloud → APIs & Services → Credentials → OAuth client ID of type Desktop app.": ("Google Cloud → APIs & Services → Credentials → OAuth client ID (тип Desktop app).", "Google Cloud → APIs & Services → Credentials → OAuth client ID (тип Desktop app)."),
    "Client secret": ("Client secret", "Client secret"),
    "Shown next to the client ID. Google requires it even for desktop apps.": ("Показан рядом с client ID.", "Показано поруч із client ID."),
    "In Google Cloud Console create a project and enable “YouTube Data API v3”.": ("В Google Cloud Console создайте проект и включите «YouTube Data API v3».", "У Google Cloud Console створіть проєкт і ввімкніть «YouTube Data API v3»."),
    "Configure the OAuth consent screen (External, Testing) and add your Google account as a test user.": ("Настройте OAuth consent screen (External, Testing) и добавьте свой Google-аккаунт в тестовые пользователи.", "Налаштуйте OAuth consent screen (External, Testing) і додайте свій Google-акаунт у тестові користувачі."),
    "Create credentials → OAuth client ID → Desktop app. Loopback addresses like the one below are allowed automatically.": ("Create credentials → OAuth client ID → Desktop app.", "Create credentials → OAuth client ID → Desktop app."),
    "Paste the client ID and client secret here.": ("Вставьте сюда client ID и client secret.", "Вставте сюди client ID і client secret."),
    "Application ID": ("Application ID", "Application ID"), "Secret key": ("Secret key", "Secret key"),
    "Open Deezer for Developers → My Apps and create an app (or open an existing one).": ("Откройте Deezer for Developers → My Apps и создайте приложение.", "Відкрийте Deezer for Developers → My Apps і створіть застосунок."),
    "Set the Application domain / Redirect URL to the address shown below.": ("В поля Application domain и Redirect URL вставьте адрес ниже.", "У поля Application domain і Redirect URL вставте адресу нижче."),
    "Paste the Application ID and Secret key here.": ("Вставьте сюда Application ID и Secret key.", "Вставте сюди Application ID і Secret key."),
    # privacy
    "Everything. Music DNA Copilot runs on this computer; your history, DNA, capsules, feedback and analytics are files in the outputs/ folder. Nothing is uploaded.":
        ("Всё. Программа работает на этом компьютере, все данные — обычные файлы в папке данных. Ничего не отправляется в интернет.",
         "Усе. Програма працює на цьому комп'ютері, усі дані — звичайні файли в теці даних. Нічого не надсилається в інтернет."),
    "Only when you ask: read-only sign-in and sync with the services you connect (Spotify, Deezer, YouTube Music, Apple Music, Last.fm, ListenBrainz), and the music-service links you open. Opening a link sends that search or track to that service.":
        ("Только когда ты сам просишь: подключение сервисов (только чтение) и ссылки на треки, которые ты открываешь.",
         "Лише коли ти сам просиш: підключення сервісів (лише читання) і посилання на треки, які ти відкриваєш."),
    "Event names, timestamps, a random local ID, capsule tier/intent, provider and resolver status, experiment variant.":
        ("Названия действий и время, без названий треков.", "Назви дій і час, без назв треків."),
    "Track titles, artist names, listening history, account names or e-mail.": ("Названия треков, артисты, история, имя аккаунта или почта.", "Назви треків, артисти, історія, ім'я акаунта чи пошта."),
    "App credentials you pasted in setup and, when you chose to stay connected, access tokens. Readable only by your user account (0600).":
        ("Ключи из настройки подключений и токены входа. Доступно только вашему пользователю.", "Ключі з налаштування підключень і токени входу. Доступно лише вашому користувачеві."),
    # misc
    "This import replaced your previous one from the same service.": ("Этот файл заменил предыдущий из того же сервиса.", "Цей файл замінив попередній з того ж сервісу."),
    "Connect or import at least one music source to build your DNA.": ("Подключи сервис или загрузи файл, чтобы узнать свой вкус.", "Підключи сервіс або завантаж файл, щоб дізнатися свій смак."),
    "Connect or import at least one music source, then build your DNA.": ("Подключи сервис или загрузи файл.", "Підключи сервіс або завантаж файл."),
    "The file was readable but contained no tracks we could use.": ("В файле не нашлось треков.", "У файлі не знайшлося треків."),
}

# Dynamic sentences: (regex, ru, uk). Groups are re-inserted with str.format-style {1}, {2}.
PATTERNS = [
    (r"^You already listen to (.+)\.$", "Ты уже слушаешь {1}.", "Ти вже слухаєш {1}."),
    (r"^It fits your (.+) context\.$", "Подходит для «{1}».", "Пасує для «{1}»."),
    (r"^This pick is experimental because you opened a (\w+) capsule\.$", "Смелый выбор: ты выбрал подборку с новым.", "Сміливий вибір: ти обрав добірку з новим."),
    (r"^([\d,]+) rows · ([\d,]+) listening events from (\d+) source\(s\)$", "Прослушиваний: {2} · источников: {3}", "Прослуховувань: {2} · джерел: {3}"),
    (r"^([\d,]+) rows → ([\d,]+) unique tracks(.*)$", "Разных треков: {2}", "Різних треків: {2}"),
    (r"^([\d,]+) distinct artists$", "Артистов: {1}", "Артистів: {1}"),
    (r"^([\d,]+) of ([\d,]+) tracks have genres(.*)$", "Жанры есть у {1} из {2} треков", "Жанри є в {1} з {2} треків"),
    (r"^(\d+) genre and (\d+) artist affinities$", "Жанров: {1} · артистов: {2}", "Жанрів: {1} · артистів: {2}"),
    (r"^(\d+) feedback signals learned so far$", "Твоих оценок учтено: {1}", "Твоїх оцінок враховано: {1}"),
    (r"^Coverage (\w+) · (\d+) genres mapped$", "Жанров найдено: {2}", "Жанрів знайдено: {2}"),
    (r"^([\d,]+) genre tags across ([\d,]+) tracks$", "Жанровых меток: {1} на {2} треков", "Жанрових міток: {1} на {2} треків"),
    (r"^Play counts across ([\d,]+) artists$", "Прослушивания {1} артистов", "Прослуховування {1} артистів"),
    (r"^(\d+)% of your listening events are repeat plays$", "{1}% прослушиваний — повторы любимого", "{1}% прослуховувань — повтори улюбленого"),
    (r"^(\d+)% of events are distinct tracks$", "{1}% прослушиваний — разные треки", "{1}% прослуховувань — різні треки"),
    (r"^(\d+) plays under 30 seconds were not counted\.$", "Прослушивания короче 30 секунд не учтены: {1}.", "Прослуховування коротші за 30 секунд не враховано: {1}."),
    (r"^Your (.+) affinity increased( slightly)?\.$", "Тебе стал больше нравиться жанр {1}.", "Тобі більше подобається жанр {1}."),
    (r"^Your (.+) affinity decreased( slightly)?\.$", "Жанр {1} стал нравиться меньше.", "Жанр {1} подобається менше."),
    (r"^Your discovery tolerance increased slightly\.$", "Ты стал охотнее слушать новое.", "Ти охочіше слухаєш нове."),
    (r"^Your discovery tolerance decreased slightly\.$", "Ты стал реже выбирать новое.", "Ти рідше обираєш нове."),
    (r"^You reacted positively to artists that weren't in your history: (.+)$", "Понравились новые артисты: {1}", "Сподобалися нові артисти: {1}"),
    (r"^(.+) affinity$", "{1}", "{1}"),
    (r"^You (.+) during the last (\d+) days\.$", "По твоим оценкам за последние дни.", "За твоїми оцінками за останні дні."),
    (r"^Signals suggest this because (.+)$", "Так говорят твои оценки.", "Так кажуть твої оцінки."),
    (r"^Search (.+)$", "Найти в {1}", "Знайти в {1}"),
    (r"^Open in (.+)$", "Открыть в {1}", "Відкрити в {1}"),
    (r"^(.+) needs setup$", "{1}: нужна настройка", "{1}: потрібне налаштування"),
    (r"^(.+) connection needs attention$", "{1}: нужно войти заново", "{1}: потрібно увійти знову"),
    (r"^Couldn't reach (.+)$", "Нет связи с {1}", "Немає зв'язку з {1}"),
    (r"^(.+) isn't responding$", "{1} не отвечает", "{1} не відповідає"),
    (r"^(.+) asked us to slow down$", "{1}: слишком много запросов", "{1}: забагато запитів"),
    (r"^(\d+(?:\.\d)?) years$", "лет: {1}", "років: {1}"),
    (r"^(\d+) months$", "месяцев: {1}", "місяців: {1}"),
    (r"^(\d+) days$", "дней: {1}", "днів: {1}"),
]
_PATTERNS = [(re.compile(p), ru, uk) for p, ru, uk in PATTERNS]

# Fallback wording per error code, used when an error's own text has no translation.
ERRORS = {
    "BAD_REQUEST": (("Что-то пошло не так", "Проверь введённые данные и попробуй ещё раз."), ("Щось пішло не так", "Перевір введені дані й спробуй ще раз.")),
    "NOT_FOUND": (("Не найдено", "Возможно, это уже удалено."), ("Не знайдено", "Можливо, це вже видалено.")),
    "NO_SOURCES": (("Музыка не подключена", "Подключи сервис или загрузи файл."), ("Музику не підключено", "Підключи сервіс або завантаж файл.")),
    "NO_DNA": (("Вкус ещё не определён", "Сначала подключи музыку."), ("Смак ще не визначено", "Спочатку підключи музику.")),
    "NOT_ENOUGH_DATA": (("Мало данных", "Добавь ещё прослушиваний."), ("Замало даних", "Додай ще прослуховувань.")),
    "MALFORMED_IMPORT": (("Не удалось прочитать файл", "Похоже, это не тот файл. Проверь, что выбран правильный сервис."), ("Не вдалося прочитати файл", "Схоже, це не той файл. Перевір, що обрано правильний сервіс.")),
    "UNSUPPORTED_FORMAT": (("Этот тип файла не подходит", "Нужен файл .json, .csv, .html или .txt."), ("Цей тип файлу не підходить", "Потрібен файл .json, .csv, .html або .txt.")),
    "DUPLICATE_IMPORT": (("Этот файл уже загружен", "Ничего не изменилось."), ("Цей файл уже завантажено", "Нічого не змінилося.")),
    "PAYLOAD_TOO_LARGE": (("Файл слишком большой", "Попробуй файл поменьше."), ("Файл завеликий", "Спробуй менший файл.")),
    "REQUIRES_SETUP": (("Нужна настройка", "Заполни настройку на карточке сервиса."), ("Потрібне налаштування", "Заповни налаштування на картці сервісу.")),
    "AUTH_EXPIRED": (("Нужно войти заново", "Нажми «Подключить» ещё раз. Твои данные в безопасности."), ("Потрібно увійти знову", "Натисни «Підключити» ще раз. Твої дані в безпеці.")),
    "OAUTH_FAILED": (("Вход не завершён", "Ничего не изменилось, попробуй ещё раз."), ("Вхід не завершено", "Нічого не змінилося, спробуй ще раз.")),
    "PROVIDER_UNAVAILABLE": (("Сервис не отвечает", "Ничего не изменилось. Попробуй позже."), ("Сервіс не відповідає", "Нічого не змінилося. Спробуй пізніше.")),
    "RATE_LIMITED": (("Слишком много запросов", "Подожди несколько минут и попробуй снова."), ("Забагато запитів", "Зачекай кілька хвилин і спробуй знову.")),
    "OFFLINE": (("Нет связи", "Проверь интернет. Ничего не изменилось."), ("Немає зв'язку", "Перевір інтернет. Нічого не змінилося.")),
    "CORRUPTED_DATA": (("Часть данных повреждена", "Повреждённый файл отложен в сторону. Возможно, нужно обновить вкус."), ("Частину даних пошкоджено", "Пошкоджений файл відкладено. Можливо, треба оновити смак.")),
    "CONFLICT": (("Не получилось", "Попробуй ещё раз."), ("Не вийшло", "Спробуй ще раз.")),
    "INTERNAL": (("Что-то пошло не так", "Подробности сохранены в Настройки → Для опытных."), ("Щось пішло не так", "Подробиці збережено в Налаштування → Для досвідчених.")),
    "FORBIDDEN": (("Заблокировано", "Запрос должен идти из самого приложения."), ("Заблоковано", "Запит має йти із самого застосунку.")),
}


def pick_lang(value) -> str:
    v = str(value or "").strip().lower()[:2]
    return v if v in LANGS else "en"


def translate(text, lang):
    """One string, or the original when there is no translation."""
    if lang == "en" or not isinstance(text, str) or not text:
        return text
    idx = 1 if lang == "uk" else 0
    hit = EXACT.get(text)
    if hit:
        return hit[idx]
    for rx, ru, uk in _PATTERNS:
        m = rx.match(text)
        if m:
            tpl = uk if lang == "uk" else ru
            groups = [translate(g, lang) if g else "" for g in m.groups()]
            return re.sub(r"\{(\d)\}", lambda mm: groups[int(mm.group(1)) - 1], tpl)
    return text


def _walk(obj, lang, key=None, skip=frozenset()):
    if isinstance(obj, dict):
        drop = set()
        for marker, keys in DATA_KEYS_WHEN:
            if marker in obj:
                drop |= keys
        if key == "error" or ("code" in obj and "title" in obj and "message" in obj):
            return _error(obj, lang)
        return {k: _walk(v, lang, k, drop) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_walk(v, lang, key, skip) for v in obj]
    if isinstance(obj, str) and (key in TEXT_KEYS) and key not in skip:
        return translate(obj, lang)
    return obj


def _error(err, lang):
    out = dict(err)
    title, msg = translate(err.get("title"), lang), translate(err.get("message"), lang)
    fb = ERRORS.get(err.get("code"))
    if fb:
        ft, fm = fb[1] if lang == "uk" else fb[0]
        if title == err.get("title"):
            title = ft
        if msg == err.get("message"):
            # Keep the original explanation available (shown small in the UI).
            out.setdefault("original", err.get("message"))
            msg = fm
    out["title"], out["message"] = title, msg
    return out


def localize(payload, lang):
    """Translate the UI text of an API payload (a dict) for `lang`."""
    lang = pick_lang(lang)
    if lang == "en":
        return payload
    out = _walk(payload, lang)
    # The intents map holds UI labels as values under arbitrary keys.
    if isinstance(out, dict) and isinstance(out.get("intents"), dict):
        out["intents"] = {k: translate(v, lang) for k, v in out["intents"].items()}
    return out
