import asyncio
import logging
import os
import google.generativeai as genai
from datetime import datetime

# Налаштування логування
logger = logging.getLogger(__name__)

# Ініціалізація Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

# Тексти нагадувань
HABIT_REMINDER_TEXTS = {
    "uk": "Не забудьте відмітити свою звичку сьогодні! 📝",
    "ru": "Не забудьте отметить свою привычку сегодня! 📝",
    "en": "Don't forget to log your habit today! 📝"
}

async def run_scheduler(db, bot):
    """Головний цикл планувальника"""
    logger.info("Scheduler started ✅")
    while True:
        try:
            now = datetime.now()
            # Перевірка щогодини (у 00 хвилин)
            if now.minute == 0:
                await dispatch_daily_reports(bot, db, now.hour)
                await dispatch_habit_reminders(bot, db)
                
            # Перевірка пропущених звичок (наприклад, о 9 ранку)
            if now.hour == 9 and now.minute == 0:
                await dispatch_missed_habit_check(bot, db)
                
            await asyncio.sleep(60) # Перевірка кожну хвилину
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            await asyncio.sleep(60)

async def dispatch_daily_reports(bot, db, utc_hour):
    """Рассилка щоденних звітів"""
    try:
        users = await db.get_users_for_report(utc_hour)
        for user in users:
            try:
                # Тут має бути ваша функція відправки звіту, якщо вона імпортована
                # await send_daily_report(chat_id=user["user_id"], bot=bot, db=db)
                pass 
            except Exception as e:
                logger.error(f"Daily report error for {user.get('user_id')}: {e}")
    except Exception as e:
        logger.error(f"Failed to get users for reports: {e}")

async def dispatch_habit_reminders(bot, db):
    """Нагадування про активні звички"""
    try:
        users = await db.get_users_with_unlogged_habits_today()
        for user in users:
            try:
                lang = user.get("language", "uk")
                text = HABIT_REMINDER_TEXTS.get(lang, HABIT_REMINDER_TEXTS["uk"])
                await bot.send_message(chat_id=user["user_id"], text=text)
                await asyncio.sleep(0.3)
            except Exception as e:
                logger.error(f"Habit reminder error for {user.get('user_id')}: {e}")
    except Exception as e:
        logger.error(f"Failed to get users for habit reminders: {e}")

async def dispatch_missed_habit_check(bot, db):
    """Підтримка користувачів, що пропустили звичку (через Gemini)"""
    try:
        users = await db.get_users_with_missed_habits_yesterday()
        for user in users:
            try:
                lang = user.get("language", "uk")
                prompt = f"Користувач пропустив звичку. Напиши коротке емпатичне повідомлення підтримки мовою {lang}."
                
                response = await model.generate_content_async(prompt)
                await bot.send_message(chat_id=user["user_id"], text=response.text)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"Missed habit support error for {user.get('user_id')}: {e}")
    except Exception as e:
        logger.error(f"Failed to get users for missed habit check: {e}")
