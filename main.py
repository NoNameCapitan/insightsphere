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
from handlers import onboarding, report, profile, callbacks, monetization
from handlers.habits import router as habits_router
from handlers.focus import router as focus_router
from handlers.techniques import router as techniques_router
from handlers.gamification import router as gamification_router
from utils.scheduler import run_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

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

    # Register routers — order matters (most specific first)
    dp.include_router(onboarding.router)    # /start + onboarding dialog
    dp.include_router(report.router)        # /daily
    dp.include_router(profile.router)       # /profile
    dp.include_router(monetization.router)  # /support + Stars payments + /ask
    dp.include_router(habits_router)        # /habit
    dp.include_router(focus_router)         # /focus + /done (FSM)
    dp.include_router(techniques_router)    # /techniques
    dp.include_router(gamification_router)  # /stats + /challenge
    dp.include_router(callbacks.router)     # all inline button callbacks (last)

    # Background scheduler: daily reports, habit reminders, weekly topics
    asyncio.create_task(run_scheduler(bot, db))

    logger.info("InsightSphere bot started ✅")

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
