from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

BTN = {
    "daily":      {"uk": "📊 Отримати інсайт",   "ru": "📊 Получить инсайт",   "en": "📊 Get insight"},
    "history":    {"uk": "📚 Історія",            "ru": "📚 История",           "en": "📚 History"},
    "profile":    {"uk": "👤 Мій профіль",        "ru": "👤 Мой профиль",      "en": "👤 My profile"},
    "settings":   {"uk": "⚙️ Налаштування",       "ru": "⚙️ Настройки",        "en": "⚙️ Settings"},
    "support":    {"uk": "💛 Підтримати",         "ru": "💛 Поддержать",       "en": "💛 Support"},
    "habit":      {"uk": "🌱 Звички",             "ru": "🌱 Привычки",         "en": "🌱 Habits"},
    "focus":      {"uk": "🎯 Фокус",              "ru": "🎯 Фокус",            "en": "🎯 Focus"},
    "techniques": {"uk": "📚 Техніки",            "ru": "📚 Техники",          "en": "📚 Techniques"},
    "stats":      {"uk": "🏆 Моя статистика",     "ru": "🏆 Моя статистика",   "en": "🏆 My stats"},
    "deeper":     {"uk": "🔍 Глибше по темі",     "ru": "🔍 Глубже по теме",   "en": "🔍 Go deeper"},
    "pdf":        {"uk": "📄 PDF",                "ru": "📄 PDF",              "en": "📄 PDF"},
    "new_report": {"uk": "📊 Новий звіт",         "ru": "📊 Новый отчёт",     "en": "📊 New report"},
    "edit":       {"uk": "✏️ Оновити профіль",    "ru": "✏️ Обновить профиль", "en": "✏️ Update profile"},
    "back":       {"uk": "← Назад",              "ru": "← Назад",             "en": "← Back"},
    "add_habit":  {"uk": "➕ Нова звичка",        "ru": "➕ Новая привычка",   "en": "➕ New habit"},
    "toggle_on":  {"uk": "✅ Розсилка: Увімкнена","ru": "✅ Рассылка: Включена","en": "✅ Daily: On"},
    "toggle_off": {"uk": "❌ Розсилка: Вимкнена", "ru": "❌ Рассылка: Выключена","en": "❌ Daily: Off"},
    "set_time":   {"uk": "🕐 Змінити час",        "ru": "🕐 Изменить время",   "en": "🕐 Change time"},
    "add_all":    {"uk": "✅ Додати всі",          "ru": "✅ Добавить все",     "en": "✅ Add all"},
    "skip":       {"uk": "Пропустити →",          "ru": "Пропустить →",        "en": "Skip →"},
    "premium_1m": {"uk": "⭐ 200 ⭐ — Преміум/місяць",   "ru": "⭐ 200 ⭐ — Премиум/месяц",   "en": "⭐ 200 ⭐ — Premium 1 month"},
    "premium_3m": {"uk": "🚀 500 ⭐ — Преміум/3 місяці", "ru": "🚀 500 ⭐ — Премиум/3 месяца","en": "🚀 500 ⭐ — Premium 3 months"},
}


def L(key: str, lang: str) -> str:
    return BTN.get(key, {}).get(lang, BTN.get(key, {}).get("uk", key))


def main_keyboard(lang: str = "uk") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=L("daily", lang),   callback_data="daily"),
            InlineKeyboardButton(text=L("stats", lang),   callback_data="stats_cb"),
        ],
        [
            InlineKeyboardButton(text=L("habit", lang),   callback_data="habit_menu"),
            InlineKeyboardButton(text=L("focus", lang),   callback_data="focus_menu"),
        ],
        [
            InlineKeyboardButton(text=L("techniques", lang), callback_data="techniques_menu"),
            InlineKeyboardButton(text=L("profile", lang),    callback_data="profile"),
        ],
        [
            InlineKeyboardButton(text=L("settings", lang), callback_data="settings"),
            InlineKeyboardButton(text=L("support", lang),  callback_data="support"),
        ],
    ])


def report_keyboard(topic: str = "", lang: str = "uk") -> InlineKeyboardMarkup:
    safe_topic = topic[:50] if topic else "last"
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=L("deeper", lang),     callback_data=f"deeper:{safe_topic}"),
            InlineKeyboardButton(text=L("pdf", lang),        callback_data="pdf"),
        ],
        [
            InlineKeyboardButton(text=L("new_report", lang), callback_data="daily"),
            InlineKeyboardButton(text=L("edit", lang),       callback_data="reset"),
        ],
    ])


def profile_keyboard(lang: str = "uk") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=L("daily", lang),    callback_data="daily"),
            InlineKeyboardButton(text=L("stats", lang),    callback_data="stats_cb"),
        ],
        [InlineKeyboardButton(text=L("edit", lang),        callback_data="reset")],
    ])


def support_keyboard(lang: str = "uk") -> InlineKeyboardMarkup:
    coffee = {"uk": "☕ 50 ⭐ — Кава куратору",   "ru": "☕ 50 ⭐ — Кофе куратору",   "en": "☕ 50 ⭐ — Coffee for curator"}
    pizza  = {"uk": "🍕 150 ⭐ — Піца команді",  "ru": "🍕 150 ⭐ — Пицца команде",  "en": "🍕 150 ⭐ — Pizza for team"}
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=coffee.get(lang, coffee["uk"]), callback_data="buy:support_small")],
        [InlineKeyboardButton(text=pizza.get(lang, pizza["uk"]),   callback_data="buy:support_medium")],
        [InlineKeyboardButton(text=L("premium_1m", lang),          callback_data="buy:premium_month")],
        [InlineKeyboardButton(text=L("premium_3m", lang),          callback_data="buy:premium_three")],
        [InlineKeyboardButton(text=L("back", lang),                callback_data="back_main")],
    ])


def premium_keyboard(lang: str = "uk") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=L("premium_1m", lang), callback_data="buy:premium_month")],
        [InlineKeyboardButton(text=L("premium_3m", lang), callback_data="buy:premium_three")],
    ])


def settings_keyboard(daily_enabled: bool, daily_hour: int, lang: str = "uk") -> InlineKeyboardMarkup:
    toggle = L("toggle_on" if daily_enabled else "toggle_off", lang)
    time_label = {"uk": f"🕐 Час: {daily_hour:02d}:00 UTC", "ru": f"🕐 Время: {daily_hour:02d}:00 UTC", "en": f"🕐 Time: {daily_hour:02d}:00 UTC"}
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=toggle, callback_data="toggle_daily")],
        [InlineKeyboardButton(text=time_label.get(lang, time_label["uk"]), callback_data="set_time")],
        [InlineKeyboardButton(text=L("back", lang), callback_data="back_main")],
    ])


def time_picker_keyboard(lang: str = "uk") -> InlineKeyboardMarkup:
    hours = [5, 6, 7, 8, 9, 10, 12, 17, 18, 19, 20, 21]
    rows = []
    row = []
    for h in hours:
        row.append(InlineKeyboardButton(text=f"{h:02d}:00", callback_data=f"set_hour:{h}"))
        if len(row) == 4:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text=L("back", lang), callback_data="settings")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def weekly_topics_keyboard(topics: list, lang: str = "uk") -> InlineKeyboardMarkup:
    buttons = []
    for i, topic in enumerate(topics):
        short = topic[:35] + "…" if len(topic) > 35 else topic
        buttons.append([InlineKeyboardButton(text=f"➕ {short}", callback_data=f"add_topic:{i}")])
    buttons.append([
        InlineKeyboardButton(text=L("add_all", lang), callback_data="add_all_topics"),
        InlineKeyboardButton(text=L("skip", lang),    callback_data="skip_weekly"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ─── Habit keyboards ──────────────────────────────────────────────────────────

def habit_keyboard(lang: str = "uk", mode: str = "add") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=L("add_habit", lang), callback_data="habit_add")],
        [InlineKeyboardButton(text=L("back", lang),      callback_data="back_main")],
    ])


def habit_list_keyboard(habits: list, lang: str = "uk") -> InlineKeyboardMarkup:
    buttons = []
    log_labels = {"uk": "✅ Відмітити", "ru": "✅ Отметить", "en": "✅ Log"}
    del_labels  = {"uk": "🗑",          "ru": "🗑",           "en": "🗑"}
    for h in habits:
        buttons.append([
            InlineKeyboardButton(
                text=f"{log_labels.get(lang, '✅')} {h['name'][:20]}",
                callback_data=f"habit_log:{h['id']}"
            ),
            InlineKeyboardButton(text=del_labels.get(lang, "🗑"), callback_data=f"habit_delete:{h['id']}"),
        ])
    buttons.append([InlineKeyboardButton(text=L("add_habit", lang), callback_data="habit_add")])
    buttons.append([InlineKeyboardButton(text=L("back", lang),      callback_data="back_main")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ─── Techniques keyboard ──────────────────────────────────────────────────────

def techniques_keyboard(techniques: list, lang: str = "uk") -> InlineKeyboardMarkup:
    buttons = []
    for t in techniques:
        buttons.append([InlineKeyboardButton(text=t["name"], callback_data=f"technique:{t['id']}")])
    buttons.append([InlineKeyboardButton(text=L("back", lang), callback_data="back_main")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ─── Focus keyboard ───────────────────────────────────────────────────────────

def focus_keyboard(lang: str = "uk") -> InlineKeyboardMarkup:
    labels = {"uk": "🎯 Почати сесію фокусу", "ru": "🎯 Начать сессию фокуса", "en": "🎯 Start focus session"}
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=labels.get(lang, labels["uk"]), callback_data="focus_start")],
        [InlineKeyboardButton(text=L("back", lang), callback_data="back_main")],
    ])
