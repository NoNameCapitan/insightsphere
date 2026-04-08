import asyncio
import json
import logging
import re
from datetime import datetime, timezone, date, timedelta
from anthropic import AsyncAnthropic
from aiogram import Bot

from db.database import Database
from handlers.report import send_daily_report

logger = logging.getLogger(__name__)

# ─── Multilingual strings ──────────────────────────────────────────────────────

WEEKLY_TEXTS = {
    "uk": {
        "greeting": "👋 Привіт{name_part}!\n\n🗓 *Тижневе розширення тем*\n\n",
        "name_part": ", {name}",
        "add_prompt": "\n\n*Ось що я пропоную додати до твоєї стрічки:*\n",
        "footer": "\n\nОбери теми, які хочеш отримувати у звітах 👇\n_(або пропусти — оновлю пропозиції наступного тижня)_",
    },
    "ru": {
        "greeting": "👋 Привет{name_part}!\n\n🗓 *Еженедельное расширение тем*\n\n",
        "name_part": ", {name}",
        "add_prompt": "\n\n*Вот что я предлагаю добавить в твою ленту:*\n",
        "footer": "\n\nВыбери темы, которые хочешь получать в отчётах 👇\n_(или пропусти — обновлю предложения на следующей неделе)_",
    },
    "en": {
        "greeting": "👋 Hey{name_part}!\n\n🗓 *Weekly Topic Expansion*\n\n",
        "name_part": " {name}",
        "add_prompt": "\n\n*Here's what I suggest adding to your feed:*\n",
        "footer": "\n\nChoose the topics you'd like in your reports 👇\n_(or skip — I'll update suggestions next week)_",
    },
}

HABIT_REMINDER_TEXTS = {
    "uk": "🌱 *Нагадування про звички*\n\nСьогодні ти ще не відмітив{fem} жодної звички. Не забудь — послідовність це суперсила! /habit",
    "ru": "🌱 *Напоминание о привычках*\n\nСегодня ты ещё не отметил ни одной привычки. Не забудь — постоянство это суперсила! /habit",
    "en": "🌱 *Habit Reminder*\n\nYou haven't logged any habits today. Don't forget — consistency is your superpower! /habit",
}

MISSED_HABIT_TEXTS = {
    "uk": "💙 Я помітив, що звичка *«{name}»* не була виконана вчора.\n\nЦе нормально — пропуски бувають у всіх. Що завадило? Розкажи, і ми разом знайдемо рішення або адаптуємо звичку під твій ритм.",
    "ru": "💙 Я заметил, что привычка *«{name}»* не была выполнена вчера.\n\nЭто нормально — пропуски бывают у всех. Что помешало? Расскажи, и мы вместе найдём решение или адаптируем привычку под твой ритм.",
    "en": "💙 I noticed that the habit *'{name}'* wasn't completed yesterday.\n\nThat's okay — everyone misses sometimes. What got in the way? Tell me and we'll find a solution or adapt the habit to your rhythm.",
}

STREAK_REWARD_TEXTS = {
    7: {
        "uk": "🔥 *7-денний стрік!* Неймовірно — ти тримаєш темп цілий тиждень!\n\n🎁 *Нагорода:* Сьогоднішній звіт буде на рівні Deep — більше глибини, більше інсайтів. Заслужено!",
        "ru": "🔥 *7-дневный стрик!* Невероятно — ты держишь темп целую неделю!\n\n🎁 *Награда:* Сегодняшний отчёт будет уровня Deep — больше глубины, больше инсайтов. Заслуженно!",
        "en": "🔥 *7-day streak!* Incredible — you've kept the pace for a full week!\n\n🎁 *Reward:* Today's report will be Deep level — more depth, more insights. You earned it!",
    },
    30: {
        "uk": "💎 *30-денний стрік!* Ти — легенда послідовності. Місяць без зупинок.\n\n🎁 *Нагорода:* Отримай 3 безкоштовних Premium-звіти цього тижня. Це твій бонус за силу волі!",
        "ru": "💎 *30-дневный стрик!* Ты — легенда постоянства. Месяц без остановок.\n\n🎁 *Награда:* Получи 3 бесплатных Premium-отчёта на этой неделе. Это твой бонус за силу воли!",
        "en": "💎 *30-day streak!* You're a legend of consistency. A full month without stopping.\n\n🎁 *Reward:* Get 3 free Premium reports this week. That's your bonus for willpower!",
    },
    100: {
        "uk": "🏆 *100-ДЕННИЙ СТРІК!!!* Це абсолютно неймовірно. Ти — 1% людей на планеті, які досягають такого рівня послідовності.\n\n🎁 *Нагорода:* 1 місяць Premium безкоштовно. Ти це заслужив повністю.",
        "ru": "🏆 *100-ДНЕВНЫЙ СТРИК!!!* Это абсолютно невероятно. Ты — 1% людей на планете, достигающих такого уровня постоянства.\n\n🎁 *Награда:* 1 месяц Premium бесплатно. Ты это полностью заслужил.",
        "en": "🏆 *100-DAY STREAK!!!* This is absolutely incredible. You're in the top 1% of people who reach this level of consistency.\n\n🎁 *Reward:* 1 month of Premium for free. You fully deserve this.",
    },
}

CHALLENGE_COMPLETE_TEXTS = {
    "uk": "🏅 *Виклик завершено!*\n\n«{challenge}»\n\nТи довів собі, що можеш. Це не просто виконане завдання — це нове знання про себе. Спеціальний звіт вже готується...",
    "ru": "🏅 *Вызов завершён!*\n\n«{challenge}»\n\nТы доказал себе, что можешь. Это не просто выполненное задание — это новое знание о себе. Специальный отчёт уже готовится...",
    "en": "🏅 *Challenge Complete!*\n\n'{challenge}'\n\nYou proved to yourself that you can. This isn't just a completed task — it's new self-knowledge. Special report is being prepared...",
}


# ─── Main scheduler ───────────────────────────────────────────────────────────

async def run_scheduler(bot: Bot, db: Database, claude: AsyncAnthropic):
    logger.info("Scheduler v6 started")
    last_hour_run = -1
    last_weekly_day = -1
    last_reminder_hour = -1

    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            h = now_utc.hour
            m = now_utc.minute
            wd = now_utc.weekday()  # 0=Mon, 6=Sun

            # ── Daily reports at :00 ───────────────────────────────────────
            if m == 0 and h != last_hour_run:
                last_hour_run = h
                await dispatch_daily_reports(bot, db, claude, h)

            # ── Habit reminders at 19:00 UTC ───────────────────────────────
            if h == 19 and m == 0 and h != last_reminder_hour:
                last_reminder_hour = h
                await dispatch_habit_reminders(bot, db)

            # ── Missed habit check at 08:00 UTC ───────────────────────────
            if h == 8 and m == 0:
                await dispatch_missed_habit_check(bot, db, claude)

            # ── Weekly topics every Sunday at 10:00 UTC ───────────────────
            if wd == 6 and h == 10 and m == 0 and wd != last_weekly_day:
                last_weekly_day = wd
                await dispatch_weekly_topics(bot, db, claude)

        except Exception as e:
            logger.error(f"Scheduler error: {e}")

        await asyncio.sleep(60)


# ─── Daily reports ────────────────────────────────────────────────────────────

async def dispatch_daily_reports(bot: Bot, db: Database, claude: AsyncAnthropic, utc_hour: int):
    users = await db.get_users_for_daily(utc_hour)
    logger.info(f"Daily reports: {len(users)} users at UTC {utc_hour}")

    for user in users:
        try:
            profile = dict(user["profile"]) if isinstance(user["profile"], dict) else {}
            if not profile:
                continue
            count, limit_reached = await db.check_daily_limit(user["user_id"])
            if limit_reached:
                continue

            is_prem = user["is_premium"]

            # Check streak reward — temporarily boost depth
            streak_info = await db.get_gamification_status(user["user_id"])
            streak = streak_info.get("streak_days", 0)
            force_deep = streak in (7,) and not is_prem  # 7-day reward: deep report

            await send_daily_report(
                chat_id=user["user_id"],
                profile=profile,
                db=db,
                claude=claude,
                bot=bot,
                is_premium=is_prem or force_deep,
                scheduled=True
            )

            # Update activity streak
            streak_result = await db.update_streak(user["user_id"])
            await _handle_streak_milestone(bot, db, user["user_id"], streak_result, user.get("language", "uk"))

            await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Daily report error for {user['user_id']}: {e}")


# ─── Habit reminders ──────────────────────────────────────────────────────────

async def dispatch_habit_reminders(bot: Bot, db: Database):
    """Remind users who have active habits but haven't logged today"""
    users = await db.get_users_with_unlogged_habits_today()
    logger.info(f"Habit reminders: {len(users)} users")

    for user in users:
        try:
            lang = user.get("language", "uk")
            text = HABIT_REMINDER_TEXTS.get(lang, HABIT_REMINDER_TEXTS["uk"])
            # Simple gender-neutral form for Ukrainian
            text = text.replace("{fem}", "а" if lang == "uk" else "")
            await bot.send_message(
                chat_id=user["user_id"],
                text=text,
                parse_mode="Markdown"
            )
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Habit reminder error for {user['user_id']}: {e}")


async def dispatch_missed_habit_check(bot: Bot, db: Database, claude: AsyncAnthropic):
    """Check for habits missed yesterday and send empathetic message"""
    users = await db.get_users_with_missed_habits_yesterday()
    logger.info(f"Missed habit check: {len(users)} users")

    for user in users:
        try:
            lang = user.get("language", "uk")
            for habit_name in user.get("missed_habits", []):
                text = MISSED_HABIT_TEXTS.get(lang, MISSED_HABIT_TEXTS["uk"]).format(name=habit_name)
                await bot.send_message(
                    chat_id=user["user_id"],
                    text=text,
                    parse_mode="Markdown"
                )
                await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Missed habit check error for {user['user_id']}: {e}")


# ─── Streak milestones ────────────────────────────────────────────────────────

async def _handle_streak_milestone(bot: Bot, db: Database, user_id: int, streak_result: dict, lang: str):
    milestone = streak_result.get("milestone_hit")
    if not milestone:
        return

    text = STREAK_REWARD_TEXTS.get(milestone, {}).get(lang)
    if not text:
        return

    await bot.send_message(chat_id=user_id, text=text, parse_mode="Markdown")

    # Grant achievement
    ach_map = {7: "streak_7", 30: "streak_30", 100: "streak_100"}
    if milestone in ach_map:
        await db.grant_achievement(user_id, ach_map[milestone])

    # 30-day reward: grant 3 bonus premium reports
    if milestone == 30:
        await db.grant_bonus_reports(user_id, 3)

    # 100-day reward: grant 1 month premium
    if milestone == 100:
        await db.grant_temporary_premium(user_id, days=30)


# ─── Weekly topics ────────────────────────────────────────────────────────────

async def dispatch_weekly_topics(bot: Bot, db: Database, claude: AsyncAnthropic):
    users = await db.get_users_for_weekly()
    logger.info(f"Weekly topics: {len(users)} users")

    for user in users:
        try:
            profile = dict(user["profile"]) if isinstance(user["profile"], dict) else {}
            if not profile:
                continue
            lang = user.get("language", profile.get("language", "uk"))
            await send_weekly_expansion(bot, db, claude, user["user_id"], profile, lang)
            await db.update_last_weekly(user["user_id"])
            await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Weekly topics error for {user['user_id']}: {e}")


async def send_weekly_expansion(bot: Bot, db: Database, claude: AsyncAnthropic,
                                 chat_id: int, profile: dict, lang: str):
    name = profile.get("name", "")
    interests = profile.get("interests", [])
    values = profile.get("values", [])
    current_topics = await db.get_weekly_topics(chat_id)

    lang_instruction = {
        "uk": "Відповідай виключно українською мовою.",
        "ru": "Отвечай исключительно на русском языке.",
        "en": "Reply exclusively in English.",
    }.get(lang, "Відповідай виключно українською мовою.")

    prompt = f"""
{lang_instruction}

Користувач {name} отримує персональні інсайт-звіти від InsightSphere.
Його поточні інтереси: {', '.join(interests) if isinstance(interests, list) else interests}
Його цінності: {', '.join(values) if isinstance(values, list) else values}
Теми, що вже були запропоновані: {', '.join(current_topics) if current_topics else 'немає'}

Запропонуй 4 нові теми, які:
1. Логічно розширюють його поточні інтереси
2. Пов'язані з його цінностями та цілями
3. Ще не були в його профілі
4. Достатньо конкретні (не «психологія», а «когнітивні викривлення у переговорах»)

Відповідай СТРОГО у форматі JSON (лише JSON, без пояснень):
{{"topics": ["тема 1", "тема 2", "тема 3", "тема 4"], "message": "коротке персональне повідомлення 2-3 речення чому ці теми підійдуть саме йому"}}
"""

    try:
        response = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if not json_match:
            return

        data = json.loads(json_match.group())
        topics = data.get("topics", [])
        message = data.get("message", "")
        if not topics:
            return

        await db.save_weekly_topics(chat_id, topics)

        strings = WEEKLY_TEXTS.get(lang, WEEKLY_TEXTS["uk"])
        name_part = strings["name_part"].format(name=name) if name else ""
        topics_text = "\n".join([f"  {i+1}. {t}" for i, t in enumerate(topics)])

        text_out = (
            strings["greeting"].format(name_part=name_part)
            + message
            + strings["add_prompt"]
            + topics_text
            + strings["footer"]
        )

        from keyboards import weekly_topics_keyboard
        await bot.send_message(
            chat_id=chat_id,
            text=text_out,
            parse_mode="Markdown",
            reply_markup=weekly_topics_keyboard(topics, lang)
        )
    except Exception as e:
        logger.error(f"Weekly expansion error: {e}")


# ─── Challenges ───────────────────────────────────────────────────────────────

async def dispatch_challenge_check(bot: Bot, db: Database, claude: AsyncAnthropic):
    """Check completed challenges and send special reports"""
    completed = await db.get_completed_challenges()
    for item in completed:
        try:
            lang = item.get("language", "uk")
            challenge_name = item.get("challenge_name", "")
            user_id = item["user_id"]
            profile = item.get("profile", {})

            # Send completion message
            text = CHALLENGE_COMPLETE_TEXTS.get(lang, CHALLENGE_COMPLETE_TEXTS["uk"]).format(
                challenge=challenge_name
            )
            await bot.send_message(chat_id=user_id, text=text, parse_mode="Markdown")

            # Generate special challenge report
            await asyncio.sleep(2)
            await send_challenge_report(bot, db, claude, user_id, profile, challenge_name, lang)

            await db.mark_challenge_reported(user_id, challenge_name)
            await db.grant_achievement(user_id, f"challenge_{challenge_name[:20].replace(' ', '_').lower()}")

        except Exception as e:
            logger.error(f"Challenge check error for {item.get('user_id')}: {e}")


async def send_challenge_report(bot: Bot, db: Database, claude: AsyncAnthropic,
                                  chat_id: int, profile: dict, challenge: str, lang: str):
    from prompts.daily_report import DAILY_REPORT_SYSTEM_PROMPT
    from handlers.report import build_report_prompt

    lang_instruction = {
        "uk": "Відповідай українською.",
        "ru": "Отвечай на русском.",
        "en": "Reply in English.",
    }.get(lang, "Відповідай українською.")

    special_prompt = (
        f"{lang_instruction}\n\n"
        f"Користувач щойно завершив особистий виклик: «{challenge}».\n"
        f"Згенеруй спеціальний інсайт-звіт, присвячений цьому досягненню.\n"
        f"Підкресли що він зробив, що це означає для його зростання, і який наступний рівень виклику.\n\n"
        + build_report_prompt(profile, is_premium=True)
    )

    try:
        response = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=DAILY_REPORT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": special_prompt}]
        )
        report = response.content[0].text
        await bot.send_message(chat_id=chat_id, text=report, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Challenge report error: {e}")
