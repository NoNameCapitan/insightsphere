import asyncio
import logging
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
from aiogram import Bot, Dispatcher, BaseMiddleware
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from typing import Callable, Dict, Any, Awaitable
from aiogram.types import TelegramObject

from db.database import Database
from handlers import (
    onboarding, focus, techniques, 
    habits, report, callbacks, 
    profile, monetization
)

async def main():
    # Ініціалізація бази даних
    db = Database()
    await db.init()

    # Ініціалізація бота
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())

    # Налаштування Middleware
    dp.update.middleware(DependencyMiddleware(db))

    # Реєстрація роутерів
    dp.include_router(onboarding.router)
    dp.include_router(focus.router)
    dp.include_router(techniques.router)
    dp.include_router(habits.router)
    dp.include_router(report.router)
    dp.include_router(callbacks.router)
    dp.include_router(profile.router)
    dp.include_router(monetization.router)

    try:
        print("Бот запускається...")
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
