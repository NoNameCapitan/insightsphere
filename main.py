import asyncio
import logging
import os
import google.generativeai as genai
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, BaseMiddleware
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from typing import Callable, Dict, Any, Awaitable
from aiogram.types import TelegramObject

from db.database import Database
from prompts.onboarding_prompts import ONBOARDING_SYSTEM_PROMPT
from handlers.onboarding import router as onboarding_router
from handlers.habits import router as habits_router
from handlers.focus import router as focus_router
from handlers.techniques import router as techniques_router
from handlers.gamification import router as gamification_router
from handlers.monetization import router as monetization_router

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

async def dispatch_daily_reports(bot: Bot, db: Database, utc_hour: int):
    """Тіло функції не може бути порожнім, додаємо заглушку"""
    pass

load_dotenv()
TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
genai.configure(api_key=GEMINI_API_KEY)

class DependencyMiddleware(BaseMiddleware):
    """Injects db into every handler via data dict."""

    def __init__(self, db: Database):
        self.db = db


    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        data["db"] = self.db

        return await handler(event, data)


async def main():
    db = Database()
    await db.connect()
    logger.info("Database connected ✅")



    bot = Bot(
        token=TELEGRAM_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN),
    )
    dp = Dispatcher(storage=MemoryStorage())

    # Attach middleware to messages and callbacks
    middleware = DependencyMiddleware(db)
    dp.message.middleware(middleware)
    dp.callback_query.middleware(middleware)

    # Register routers - order matters
    dp.include_router(onboarding_router)
    dp.include_router(habits_router)
    dp.include_router(focus_router)
    dp.include_router(techniques_router)
    dp.include_router(gamification_router)
    dp.include_router(monetization_router)

    # Background scheduler: daily reports, habit reminders, weekly topics
    asyncio.create_task(run_scheduler(db, bot))
    logger.info("InsightsSphere bot started ✅")

    try:
        await dp.start_polling(
            bot,
            allowed_updates=["message", "callback_query", "pre_checkout_query"],
        )
    finally:
        await db.disconnect()
        await bot.session.close()
        logger.info("Bot stopped cleanly")

if __name__ == "__main__":
    asyncio.run(main())
