import logging
import google.generativeai as genai
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command

from db.database import Database

logger = logging.getLogger(__name__)
router = Router()

ACHIEVEMENTS = {
    "first_report": {
        "uk": ("📊 Перший інсайт", "Отримано перший персональний звіт"),
        "ru": ("📊 Первый инсайт", "Получен первый персональный отчёт"),
        "en": ("📊 First Insight", "Received your first personal report"),
    },
    "first_focus": {
        "uk": ("🎯 Перший фокус", "Завершена перша сесія фокусу"),
        "ru": ("🎯 Первый фокус", "Завершена первая сессия фокуса"),
        "en": ("🎯 First Focus", "Completed first focus session"),
    },
    "focus_10": {
        "uk": ("🧘 Майстер фокусу", "Завершено 10 сесій фокусу"),
        "ru": ("🧘 Мастер фокуса", "Завершено 10 сессий фокуса"),
        "en": ("🧘 Focus Master", "Completed 10 focus sessions"),
    },
    "streak_7": {
        "uk": ("🔥 Тижневий воїн", "7 днів поспіль активності"),
        "ru": ("🔥 Недельный воин", "7 дней подряд активности"),
        "en": ("🔥 Weekly Warrior", "7-day activity streak"),
    },
    "streak_30": {
        "uk": ("💎 Місяць сили", "30 днів поспіль"),
        "ru": ("💎 Месяц силы", "30 дней подряд"),
        "en": ("💎 Month of Power", "30-day streak"),
    },
    "streak_100": {
        "uk": ("🏆 Легенда", "100 днів поспіль — ти у топ-1%"),
        "ru": ("🏆 Легенда", "100 дней подряд — ты в топ-1%"),
        "en": ("🏆 Legend", "100-day streak — you're in the top 1%"),
    },
    "level_5": {
        "uk": ("⭐ Рівень 5", "Досягнуто 5-го рівня"),
        "ru": ("⭐ Уровень 5", "Достигнут 5-й уровень"),
        "en": ("⭐ Level 5", "Reached level 5"),
    },
    "techniques_explorer": {
        "uk": ("📚 Дослідник", "Вивчено 5 технік"),
        "ru": ("📚 Исследователь", "Изучено 5 техник"),
        "en": ("📚 Explorer", "Learned 5 techniques"),
    },
    "habit_streak_7": {
        "uk": ("🌱 Зеленый палець", "7-денний стрік звички"),
        "ru": ("🌱 Зелёный палец", "7-дневный стрик привычки"),
        "en": ("🌱 Green Thumb", "7-day habit streak"),
    },
}

LEVEL_TITLES = {
    "uk": {1: "Початківець", 2: "Учень", 3: "Практик", 4: "Дослідник", 5: "Майстер",
           6: "Наставник", 7: "Гуру", 8: "Провидець", 9: "Архітектор", 10: "Мудрець"},
    "ru": {1: "Новичок", 2: "Ученик", 3: "Практик", 4: "Исследователь", 5: "Мастер",
           6: "Наставник", 7: "Гуру", 8: "Провидец", 9: "Архитектор", 10: "Мудрец"},
    "en": {1: "Beginner", 2: "Learner", 3: "Practitioner", 4: "Explorer", 5: "Master",
           6: "Mentor", 7: "Guru", 8: "Visionary", 9: "Architect", 10: "Sage"},
}

CHALLENGE_TEMPLATES = {
    "uk": [
        {"name": "7 днів медитації",         "desc": "Медитуй щонайменше 5 хв кожен день протягом тижня",    "days": 7},
        {"name": "Читай 20 хв щодня",        "desc": "Читай корисну книгу або статтю 20 хвилин щодня",      "days": 7},
        {"name": "Цифровий детокс вечорами", "desc": "Не користуйся телефоном після 21:00 протягом тижня",   "days": 7},
        {"name": "Ранкові нотатки",           "desc": "Записуй 3 думки або плани щоранку протягом 2 тижнів", "days": 14},
        {"name": "30 хв руху щодня",         "desc": "Будь-яка фізична активність 30 хвилин кожного дня",    "days": 14},
    ],
    "ru": [
        {"name": "7 дней медитации",         "desc": "Медитируй минимум 5 мин каждый день в течение недели", "days": 7},
        {"name": "Читай 20 мин в день",      "desc": "Читай полезную книгу или статью 20 минут каждый день", "days": 7},
        {"name": "Цифровой детокс вечером",  "desc": "Не пользуйся телефоном после 21:00 в течение недели",  "days": 7},
        {"name": "Утренние заметки",         "desc": "Записывай 3 мысли или плана каждое утро 2 недели",     "days": 14},
        {"name": "30 мин движения в день",   "desc": "Любая физическая активность 30 минут каждый день",     "days": 14},
    ],
    "en": [
        {"name": "7-day meditation",         "desc": "Meditate at least 5 min every day for a week",         "days": 7},
        {"name": "Read 20 min daily",        "desc": "Read a useful book or article for 20 minutes each day", "days": 7},
        {"name": "Evening digital detox",    "desc": "No phone after 9 PM for a week",                       "days": 7},
        {"name": "Morning journaling",       "desc": "Write 3 thoughts or plans each morning for 2 weeks",    "days": 14},
        {"name": "30 min movement daily",    "desc": "Any physical activity for 30 minutes each day",         "days": 14},
    ],
}


def get_level_title(level: int, lang: str) -> str:
    titles = LEVEL_TITLES.get(lang, LEVEL_TITLES["uk"])
    return titles.get(min(level, 10), titles[10])


def xp_to_next(xp: int) -> int:
    current_level = 1 + xp // 100
    return current_level * 100 - xp


def build_xp_bar(xp: int) -> str:
    progress = xp % 100
    filled = progress // 10
    return "█" * filled + "░" * (10 - filled) + f" {progress}/100 XP"


async def suggest_challenge(profile: dict, lang: str) -> dict:    """Pick the most relevant challenge for this profile"""
    templates = CHALLENGE_TEMPLATES.get(lang, CHALLENGE_TEMPLATES["uk"])
    interests = profile.get("interests", [])
    values = profile.get("values", [])
    mindset = profile.get("mindset", "mixed")

    lang_instruction = {
        "uk": "Відповідай українською.",
        "ru": "Отвечай на русском.",
        "en": "Reply in English.",
    }.get(lang, "Відповідай українською.")

    templates_str = "\n".join([f"- {t['name']}: {t['desc']} ({t['days']} дн.)" for t in templates])

    prompt = f"""
{lang_instruction}

Профіль: інтереси={interests}, цінності={values}, mindset={mindset}

Доступні виклики:
{templates_str}

Обери ОДИН виклик, який найкраще підходить цьому профілю. Поясни чому (1-2 речення, персоналізовано).
Відповідай JSON:
{{"name": "назва виклику", "why": "персональне пояснення"}}
"""
    try:
        # Gemini request
        response = await model.generate_content_async(prompt)
        ai_text = response.text

        import json, re
        match = re.search(r'\{.*\}', ai_text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            # Find matching template
            for t in templates:
                if t["name"] == data.get("name"):
                    return {**t, "why": data.get("why", "")}
    except Exception as e:
        print(f"Challenge suggestion error: {e}")

    # Fallback: first template
    t = templates[0]
    return {**t, "why": ""}


@router.message(Command("stats"))
async def cmd_stats(message: Message, db: Database):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)

    if not profile or not profile.get("onboarding_complete"):
        msgs = {"uk": "Спочатку пройди онбординг — /start",
                "ru": "Сначала пройди онбординг — /start",
                "en": "Complete onboarding first — /start"}
        await message.answer(msgs.get(lang, msgs["uk"]))
        return

    await send_stats(message.chat.id, message.bot, db, user_id, lang)


async def send_stats(chat_id: int, bot, db: Database, user_id: int, lang: str):
    gam = await db.get_gamification_status(user_id)
    habits = await db.get_habits(user_id)
    is_prem = await db.is_premium(user_id)
    focus_count = await db.get_focus_session_count(user_id)

    level = gam["level"]
    xp = gam["xp"]
    streak = gam["streak_days"]
    achievements_list = gam["achievements"]
    active_challenges = gam.get("active_challenges", [])
    title = get_level_title(level, lang)
    xp_bar = build_xp_bar(xp)
    next_xp = xp_to_next(xp)

    ach_display = []
    for ach_id in achievements_list:
        if ach_id in ACHIEVEMENTS:
            name_ach, _ = ACHIEVEMENTS[ach_id].get(lang, ACHIEVEMENTS[ach_id].get("uk", ("", "")))
            ach_display.append(f"• {name_ach}")

    H = {
        "uk": f"🏆 *Твоя статистика InsightSphere*\n━━━━━━━━━━━━━━━━━━━━━\n\n",
        "ru": f"🏆 *Твоя статистика InsightSphere*\n━━━━━━━━━━━━━━━━━━━━━\n\n",
        "en": f"🏆 *Your InsightSphere Stats*\n━━━━━━━━━━━━━━━━━━━━━\n\n",
    }
    LVL = {
        "uk": f"⭐ *Рівень {level}* — {title}\n{xp_bar}\nДо наступного: {next_xp} XP\n\n",
        "ru": f"⭐ *Уровень {level}* — {title}\n{xp_bar}\nДо следующего: {next_xp} XP\n\n",
        "en": f"⭐ *Level {level}* — {title}\n{xp_bar}\nTo next level: {next_xp} XP\n\n",
    }
    STR = {
        "uk": f"🔥 *Стрік:* {streak} дн.  |  🎯 *Сесій фокусу:* {focus_count}\n\n",
        "ru": f"🔥 *Стрик:* {streak} дн.  |  🎯 *Сессий фокуса:* {focus_count}\n\n",
        "en": f"🔥 *Streak:* {streak} days  |  🎯 *Focus sessions:* {focus_count}\n\n",
    }
    ACH_H = {
        "uk": f"🏅 *Досягнення ({len(achievements_list)}):*\n",
        "ru": f"🏅 *Достижения ({len(achievements_list)}):*\n",
        "en": f"🏅 *Achievements ({len(achievements_list)}):*\n",
    }
    HAB_H = {
        "uk": "\n🌱 *Активні звички:*\n",
        "ru": "\n🌱 *Активные привычки:*\n",
        "en": "\n🌱 *Active habits:*\n",
    }
    CHAL_H = {
        "uk": "\n💪 *Активні виклики:*\n",
        "ru": "\n💪 *Активные вызовы:*\n",
        "en": "\n💪 *Active challenges:*\n",
    }

    text = (
        H.get(lang, H["uk"])
        + LVL.get(lang, LVL["uk"])
        + STR.get(lang, STR["uk"])
        + ACH_H.get(lang, ACH_H["uk"])
        + ("\n".join(ach_display) if ach_display else "—")
    )

    if habits:
        hab_lines = "\n".join([f"  🌱 {h['name']} — стрік {h['streak']}д." for h in habits])
        text += HAB_H.get(lang, HAB_H["uk"]) + hab_lines

    if active_challenges:
        chal_lines = "\n".join([f"  💪 {c}" for c in active_challenges[:3]])
        text += CHAL_H.get(lang, CHAL_H["uk"]) + chal_lines

    if is_prem:
        prem = {"uk": "\n\n⭐ *Статус:* Преміум", "ru": "\n\n⭐ *Статус:* Премиум", "en": "\n\n⭐ *Status:* Premium"}
        text += prem.get(lang, prem["uk"])

    from keyboards import main_keyboard
    await bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown", reply_markup=main_keyboard(lang))


@router.message(Command("challenge"))
async def cmd_challenge(message: Message, db: Database, claude: AsyncAnthropic):
    """Suggest and start a personalized challenge"""
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)

    if not profile or not profile.get("onboarding_complete"):
        msgs = {"uk": "Спочатку пройди онбординг — /start", "ru": "Сначала пройди онбординг — /start", "en": "Complete onboarding first — /start"}
        await message.answer(msgs.get(lang, msgs["uk"]))
        return

    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")
    challenge = await suggest_challenge(profile, lang, claude)

    headers = {
        "uk": f"💪 *Персональний виклик для тебе*\n\n",
        "ru": f"💪 *Персональный вызов для тебя*\n\n",
        "en": f"💪 *Your Personal Challenge*\n\n",
    }
    body = {
        "uk": f"*{challenge['name']}*\n_{challenge['desc']}_\n📅 Тривалість: {challenge['days']} дн.\n\n{challenge.get('why', '')}\n\nПочинаємо?",
        "ru": f"*{challenge['name']}*\n_{challenge['desc']}_\n📅 Длительность: {challenge['days']} дн.\n\n{challenge.get('why', '')}\n\nНачинаем?",
        "en": f"*{challenge['name']}*\n_{challenge['desc']}_\n📅 Duration: {challenge['days']} days\n\n{challenge.get('why', '')}\n\nReady to start?",
    }

    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    safe_name = challenge["name"][:40]
    start_btns = {"uk": "✅ Приймаю виклик!", "ru": "✅ Принимаю вызов!", "en": "✅ Accept challenge!"}
    skip_btns = {"uk": "Інший виклик →", "ru": "Другой вызов →", "en": "Another challenge →"}
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=start_btns.get(lang, start_btns["uk"]), callback_data=f"challenge_start:{safe_name}"),
        InlineKeyboardButton(text=skip_btns.get(lang, skip_btns["uk"]),   callback_data="challenge_skip"),
    ]])

    await message.answer(
        headers.get(lang, headers["uk"]) + body.get(lang, body["uk"]),
        parse_mode="Markdown",
        reply_markup=kb
    )


@router.callback_query(F.data.startswith("challenge_start:"))
async def cb_challenge_start(query: CallbackQuery, db: Database):
    await query.answer()
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    challenge_name = query.data.split("challenge_start:", 1)[1]

    await db.add_active_challenge(user_id, challenge_name)

    msgs = {
        "uk": f"💪 Виклик «{challenge_name}» розпочато!\n\nЯ слідкуватиму за твоїм прогресом і підтримуватиму тебе. Після завершення — отримаєш спеціальний звіт і досягнення 🏅",
        "ru": f"💪 Вызов «{challenge_name}» начат!\n\nЯ буду следить за твоим прогрессом и поддерживать тебя. После завершения — получишь специальный отчёт и достижение 🏅",
        "en": f"💪 Challenge '{challenge_name}' started!\n\nI'll track your progress and support you. After completion — you'll get a special report and achievement 🏅",
    }
    await query.message.answer(msgs.get(lang, msgs["uk"]), parse_mode="Markdown")
    await db.add_xp(user_id, 10)


@router.callback_query(F.data == "challenge_skip")
async def cb_challenge_skip(query: CallbackQuery, db: Database, claude: AsyncAnthropic):
    await query.answer()
    # Re-trigger challenge command
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)
    if not profile:
        return

    challenge = await suggest_challenge(profile, lang, claude)
    safe_name = challenge["name"][:40]
    start_btns = {"uk": "✅ Приймаю!", "ru": "✅ Принимаю!", "en": "✅ Accept!"}
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=start_btns.get(lang, start_btns["uk"]), callback_data=f"challenge_start:{safe_name}"),
    ]])
    body = f"*{challenge['name']}*\n_{challenge['desc']}_\n\n{challenge.get('why', '')}"
    await query.message.answer(body, parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data == "stats_cb")
async def cb_stats(query: CallbackQuery, db: Database):
    await query.answer()
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    await send_stats(query.message.chat.id, query.bot, db, user_id, lang)
