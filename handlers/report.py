import logging
from anthropic import AsyncAnthropic
from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

from db.database import Database
from prompts.daily_report import DAILY_REPORT_SYSTEM_PROMPT
from keyboards import report_keyboard, premium_keyboard

logger = logging.getLogger(__name__)
router = Router()

# ─── Localized strings ────────────────────────────────────────────────────────

NO_PROFILE_MSG = {
    "uk": "Спочатку пройди онбординг — /start",
    "ru": "Сначала пройди онбординг — /start",
    "en": "Complete onboarding first — /start",
}

LIMIT_MSG = {
    "uk": "📊 Сьогоднішній інсайт вже надіслано.\n\nЗ *Преміумом* — безліміт + глибина PhD ⭐\n/support",
    "ru": "📊 Сегодняшний инсайт уже был отправлен.\n\nС *Премиумом* — безлимит + глубина PhD ⭐\n/support",
    "en": "📊 Today's insight was already sent.\n\nWith *Premium* — unlimited + PhD depth ⭐\n/support",
}

SCHEDULED_PREFIX = {
    "uk": "🌅 *Твій щоденний інсайт{name_part}*\n\n",
    "ru": "🌅 *Твой ежедневный инсайт{name_part}*\n\n",
    "en": "🌅 *Your daily insight{name_part}*\n\n",
}

TASK_MSG = {
    "uk": {
        "deeper": "Користувач хоче поглибитися по темі: '{topic}'. Дай розширений аналіз з механізмами, джерелами та інструментами.",
        "default": "Обери тему, яка перетинає його інтереси, поточний бар'єр та ключову цінність.",
    },
    "ru": {
        "deeper": "Пользователь хочет углубиться по теме: '{topic}'. Дай расширенный анализ с механизмами, источниками и инструментами.",
        "default": "Выбери тему, которая пересекает его интересы, текущий барьер и ключевую ценность.",
    },
    "en": {
        "deeper": "The user wants to go deeper on: '{topic}'. Provide an expanded analysis with mechanisms, sources and tools.",
        "default": "Choose a topic that intersects their interests, current barrier and key value.",
    },
}

DEPTH_LABEL = {
    "uk": {"surface": "поверхневий", "medium": "середній", "deep": "глибокий", "phd": "PhD"},
    "ru": {"surface": "поверхностный", "medium": "средний", "deep": "глубокий", "phd": "PhD"},
    "en": {"surface": "surface", "medium": "medium", "deep": "deep", "phd": "PhD"},
}

PREMIUM_NOTE = {
    "uk": "(ПРЕМІУМ: максимальна глибина, джерела, механізми)",
    "ru": "(ПРЕМИУМ: максимум глубины, источники, механизмы)",
    "en": "(PREMIUM: maximum depth, sources, mechanisms)",
}

ERROR_MSG = {
    "uk": "Не вдалося згенерувати звіт. Спробуй пізніше.",
    "ru": "Не удалось сгенерировать отчёт. Попробуй позже.",
    "en": "Failed to generate report. Please try again later.",
}


# ─── Core functions ───────────────────────────────────────────────────────────

def build_report_prompt(profile: dict, lang: str = "uk",
                         is_premium: bool = False, deeper_topic: str = None) -> str:
    name = profile.get("name", "")
    interests = profile.get("interests", [])
    fears = profile.get("fears", [])
    values = profile.get("values", [])
    big_five = profile.get("big_five", {})
    mindset = profile.get("mindset", "mixed")
    stage = profile.get("prochaska_stage", "contemplation")
    key_insight = profile.get("key_insight", "")
    biases = profile.get("cognitive_biases", [])
    sdt = profile.get("sdt_dominant", "competence")

    depth = profile.get("preferred_depth", "medium")
    if is_premium and depth not in ("deep", "phd"):
        depth = "deep"

    def to_str(v): return ", ".join(v) if isinstance(v, list) else str(v or "")

    # Language-aware task instruction
    tasks = TASK_MSG.get(lang, TASK_MSG["uk"])
    task = tasks["deeper"].format(topic=deeper_topic) if deeper_topic else tasks["default"]

    # Language-aware depth label
    depth_str = DEPTH_LABEL.get(lang, DEPTH_LABEL["uk"]).get(depth, depth)
    premium_str = PREMIUM_NOTE.get(lang, PREMIUM_NOTE["uk"]) if is_premium else ""

    # Language instruction for Claude
    lang_instruction = {
        "uk": "Відповідай виключно українською мовою.",
        "ru": "Отвечай исключительно на русском языке.",
        "en": "Reply exclusively in English.",
    }.get(lang, "Відповідай виключно українською мовою.")

    return f"""
{lang_instruction}

Name: {name}
Interests: {to_str(interests)}
Values: {to_str(values)}
Barriers/fears: {to_str(fears)}
Cognitive patterns: {to_str(biases)}
Big Five: O={big_five.get('O',5)} C={big_five.get('C',5)} E={big_five.get('E',5)} A={big_five.get('A',5)} N={big_five.get('N',5)}
Mindset: {mindset} | SDT dominant: {sdt} | Prochaska stage: {stage}
Content depth: {depth_str} {premium_str}
Key insight about this person: {key_insight}

Task: {task}
""".strip()


async def send_daily_report(
    chat_id: int,
    profile: dict,
    db: Database,
    claude: AsyncAnthropic,
    bot,
    is_premium: bool = False,
    deeper_topic: str = None,
    scheduled: bool = False,
    lang: str = None,
):
    # Resolve language
    if lang is None:
        lang = profile.get("language", "uk")

    await bot.send_chat_action(chat_id=chat_id, action="typing")
    max_tokens = 2000 if is_premium else 1400
    depth = "deep" if is_premium else profile.get("preferred_depth", "medium")

    # Build scheduled prefix in correct language
    prefix = ""
    if scheduled:
        name = profile.get("name", "")
        name_part = f", {name}" if name else ""
        prefix = SCHEDULED_PREFIX.get(lang, SCHEDULED_PREFIX["uk"]).format(name_part=name_part)

    try:
        response = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=DAILY_REPORT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_report_prompt(
                profile, lang=lang, is_premium=is_premium, deeper_topic=deeper_topic
            )}]
        )
        report_text = response.content[0].text
        topic = report_text.split('\n')[0].strip()[:100] or "Insight"

        await db.save_report(chat_id, report_text, topic, depth)
        await db.increment_reports_today(chat_id)

        # XP for reading a report
        await db.add_xp(chat_id, 5)

        full_text = prefix + ("⭐ " if is_premium else "") + report_text

        kb = report_keyboard(topic, lang)

        # Split if too long for Telegram
        if len(full_text) > 4000:
            split_at = full_text[:4000].rfind('\n\n')
            if split_at == -1:
                split_at = 4000
            await bot.send_message(chat_id=chat_id, text=full_text[:split_at], parse_mode="Markdown")
            await bot.send_message(
                chat_id=chat_id, text=full_text[split_at:].strip(),
                parse_mode="Markdown", reply_markup=kb
            )
        else:
            await bot.send_message(chat_id=chat_id, text=full_text,
                                   parse_mode="Markdown", reply_markup=kb)

        # Grant first_report achievement
        from db.database import Database as _DB
        is_new = await db.grant_achievement(chat_id, "first_report")
        if is_new:
            ach = {
                "uk": "📊 Досягнення: *«Перший інсайт»*! Ласкаво просимо до InsightSphere.",
                "ru": "📊 Достижение: *«Первый инсайт»*! Добро пожаловать в InsightSphere.",
                "en": "📊 Achievement: *'First Insight'*! Welcome to InsightSphere.",
            }
            await bot.send_message(chat_id=chat_id, text=ach.get(lang, ach["uk"]), parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Report error for {chat_id}: {e}")
        err = ERROR_MSG.get(lang, ERROR_MSG["uk"])
        await bot.send_message(chat_id=chat_id, text=err)


# ─── Command handler ──────────────────────────────────────────────────────────

@router.message(Command("daily"))
async def cmd_daily(message: Message, db: Database, claude: AsyncAnthropic):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)

    if not profile or not profile.get("onboarding_complete"):
        await message.answer(NO_PROFILE_MSG.get(lang, NO_PROFILE_MSG["uk"]))
        return

    is_prem = await db.is_premium(user_id)
    _, limit_reached = await db.check_daily_limit(user_id)

    if limit_reached:
        await message.answer(
            LIMIT_MSG.get(lang, LIMIT_MSG["uk"]),
            parse_mode="Markdown",
            reply_markup=premium_keyboard(lang)
        )
        return

    await send_daily_report(
        chat_id=message.chat.id,
        profile=profile,
        db=db,
        claude=claude,
        bot=message.bot,
        is_premium=is_prem,
        lang=lang,
    )
