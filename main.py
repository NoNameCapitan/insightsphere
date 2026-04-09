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
