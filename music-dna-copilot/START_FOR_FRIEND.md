# Music DNA Copilot — старт для друга / start for a friend

*(English below.)*

## По-русски

Music DNA Copilot собирает твою музыку из разных сервисов в один личный «музыкальный ДНК»
и подбирает капсулы треков под настроение. Всё работает **на твоём компьютере**: без
регистрации, данные никуда не отправляются.

### Вариант 1 — программа (проще всего, Python не нужен)
Скачай файл для своей системы со страницы релиза:
**https://github.com/NoNameCapitan/insightsphere/releases/tag/music-dna-v3.2.0**

| Система | Файл | Запуск |
|---|---|---|
| Windows 10/11 | `music-dna-copilot-3.2.0-windows-x64.zip` | распаковать → `Music DNA Copilot\Music DNA Copilot.exe` |
| macOS (M1 и новее) | `music-dna-copilot-3.2.0-macos-arm64.zip` | распаковать → перетащить в «Программы» |
| Linux | `music-dna-copilot-3.2.0-linux-x64.tar.gz` | распаковать → `music-dna-copilot/music-dna-copilot` |

Первый запуск: программа без цифровой подписи.
- **Windows:** в синем окне SmartScreen нажми «Подробнее» → «Выполнить в любом случае».
- **macOS:** правый клик по программе → «Открыть» → «Открыть».

### Вариант 2 — из этого архива (нужен Python 3.10+)
1. Установи Python с https://www.python.org/downloads/ (на Windows отметь «Add Python to PATH»).
2. Распакуй архив и дважды кликни:
   - Windows: `RUN_APP_WINDOWS.bat`
   - macOS: `RUN_APP_MAC.command`
   - Linux: `RUN_APP_LINUX.sh`
3. Приложение откроется в браузере по адресу `http://127.0.0.1:8765/`. Закрыть — окно терминала.

   Или в отдельном окне, как программа: `python desktop_app.py`.

### Первые шаги
1. **Попробуй демо:** на первом экране выбери демо-библиотеку и посмотри свой DNA и капсулы.
2. **Своя музыка:** страница **Sources**.
   - Проще всего **ListenBrainz** (только имя пользователя) или **Last.fm** (имя + бесплатный API-ключ).
   - Любой сервис можно загрузить файлом экспорта кнопкой **Import**: Spotify, Apple, Google Takeout для YouTube, CSV.
   - Spotify, YouTube Music, Deezer и Apple Music подключаются вживую после разовой настройки: шаги написаны прямо на карточке.
3. Нажми **Rebuild DNA** и открой **Capsules**: выбери настроение и получи подборку.
4. Отмечай треки (❤️, «не моё», «слишком похоже»), и DNA будет учиться.

Данные хранятся только у тебя.
- **Программа:** в папке пользователя, в `%APPDATA%\Music DNA Copilot` на Windows.
- **Из архива:** в папке `outputs/`.

Удалить всё можно в **Settings → Privacy & Data**.

---

## In English

Music DNA Copilot combines your listening from several services into one private Music DNA
and builds track capsules for your mood. It runs **on your own computer**: no account, and
nothing is uploaded.

**Option 1 — desktop app (no Python needed):** download the file for your system from
https://github.com/NoNameCapitan/insightsphere/releases/tag/music-dna-v3.2.0 and start it.
- Windows: `Music DNA Copilot.exe`. If SmartScreen appears, choose More info → Run anyway.
- macOS: right-click the app → Open.

**Option 2 — from this archive (Python 3.10+):**
1. Unzip.
2. Double-click `RUN_APP_WINDOWS.bat`, `RUN_APP_MAC.command` or `RUN_APP_LINUX.sh`, or run `python run_app.py`.
3. The app opens at `http://127.0.0.1:8765/`. For its own window, run `python desktop_app.py`.

**First steps:**
1. Try the demo.
2. Go to **Sources**:
   - ListenBrainz (user name only) or Last.fm connect with no developer app.
   - Import an export file from any service.
   - Spotify, YouTube Music, Deezer and Apple Music connect live after a one-time setup shown on their card.
3. **Rebuild DNA**, then open **Capsules**.

More: `README.md`, `DESKTOP_APP.md`, `CONNECTORS.md`, `KNOWN_LIMITATIONS.md`.
