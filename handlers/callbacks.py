import logging
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

from aiogram import Router, F
from aiogram.types import CallbackQuery

from db.database import Database
from handlers.report import send_daily_report
from handlers.profile import format_profile
from handlers.monetization import show_support
from keyboards import (
    profile_keyboard, main_keyboard, report_keyboard,
    settings_keyboard, time_picker_keyboard, weekly_topics_keyboard
)

logger = logging.getLogger(__name__)
router = Router()


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _lang(query: CallbackQuery, db: Database) -> str:
    return await db.get_language(query.from_user.id)


# ─── Daily report ─────────────────────────────────────────────────────────────

@router.callback_query(F.data == "daily")
async def cb_daily(query: CallbackQuery, db: Database):

    await query.answer()
    user_id = query.from_user.id
    lang = await _lang(query, db)
    profile = await db.get_profile(user_id)
    is_prem = await db.is_premium(user_id)

    if not profile:
        no_profile = {"uk": "Спочатку пройди онбординг — /start",
                      "ru": "Сначала пройди онбординг — /start",
                      "en": "Complete onboarding first — /start"}
        await query.message.answer(no_profile.get(lang, no_profile["uk"]))
        return

    count, limit_reached = await db.check_daily_limit(user_id)
    if limit_reached:
        msgs = {
            "uk": "📊 Сьогоднішній інсайт вже надіслано.\n\nЗ *Преміумом* — безліміт ⭐\n/support",
            "ru": "📊 Сегодняшний инсайт уже отправлен.\n\nС *Премиумом* — безлимит ⭐\n/support",
            "en": "📊 Today's insight was already sent.\n\nWith *Premium* — unlimited ⭐\n/support",
        }
        await query.message.answer(msgs.get(lang, msgs["uk"]), parse_mode="Markdown")
        return

    await send_daily_report(
        chat_id=query.message.chat.id, profile=profile,
        db=db, bot=query.bot,
        is_premium=is_prem, lang=lang,
    )


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "profile")
async def cb_profile(query: CallbackQuery, db: Database):
    await query.answer()
    user_id = query.from_user.id
    lang = await _lang(query, db)
    profile = await db.get_profile(user_id)
    is_prem = await db.is_premium(user_id)

    if not profile:
        return
    text = format_profile(profile, lang)
    if is_prem:
        prem_badge = {"uk": "\n\n⭐ *Статус: Преміум*", "ru": "\n\n⭐ *Статус: Премиум*", "en": "\n\n⭐ *Status: Premium*"}
        text += prem_badge.get(lang, prem_badge["uk"])
    await query.message.answer(text, parse_mode="Markdown", reply_markup=profile_keyboard(lang))


# ─── Reset profile ────────────────────────────────────────────────────────────

@router.callback_query(F.data == "reset")
async def cb_reset(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    await db.reset_user(query.from_user.id)
    msgs = {"uk": "Профіль скинуто. Починаємо заново — /start 🚀",
            "ru": "Профиль сброшен. Начнём заново — /start 🚀",
            "en": "Profile reset. Let's start fresh — /start 🚀"}
    await query.message.answer(msgs.get(lang, msgs["uk"]))


# ─── Deeper / PDF ─────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("deeper:"))
async def cb_deeper(query: CallbackQuery, db: Database):
    await query.answer()
    topic = query.data.split("deeper:", 1)[1]
    user_id = query.from_user.id
    lang = await _lang(query, db)
    profile = await db.get_profile(user_id)
    is_prem = await db.is_premium(user_id)

    if profile:
        await send_daily_report(
            chat_id=query.message.chat.id, profile=profile,

            is_premium=is_prem, deeper_topic=topic, lang=lang,
        )


@router.callback_query(F.data == "pdf")
async def cb_pdf(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    msgs = {
        "uk": "📄 *PDF-версія*\n\nСкопіюй текст звіту та встав на [smallpdf.com](https://smallpdf.com/ru/txt-to-pdf).\nПовноцінний PDF-експорт — у наступному оновленні 🔜",
        "ru": "📄 *PDF-версия*\n\nСкопируй текст отчёта и вставь на [smallpdf.com](https://smallpdf.com/ru/txt-to-pdf).\nПолноценный PDF-экспорт — в следующем обновлении 🔜",
        "en": "📄 *PDF version*\n\nCopy the report text and paste it at [smallpdf.com](https://smallpdf.com/ru/txt-to-pdf).\nFull PDF export coming in next update 🔜",
    }
    await query.message.answer(msgs.get(lang, msgs["uk"]), parse_mode="Markdown")


# ─── History ──────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "history")
async def cb_history(query: CallbackQuery, db: Database):
    await query.answer()
    user_id = query.from_user.id
    lang = await _lang(query, db)
    is_prem = await db.is_premium(user_id)
    reports = await db.get_report_history(user_id, is_premium=is_prem)

    if not reports:
        empty = {"uk": "Звітів поки немає. /daily — отримай перший.",
                 "ru": "Отчётов пока нет. /daily — получи первый.",
                 "en": "No reports yet. /daily — get your first one."}
        await query.message.answer(empty.get(lang, empty["uk"]))
        return

    limit_note = {
        "uk": f"{'30 останніх' if is_prem else '5 останніх (Преміум — 30)'}",
        "ru": f"{'30 последних' if is_prem else '5 последних (Премиум — 30)'}",
        "en": f"{'last 30' if is_prem else 'last 5 (Premium — 30)'}",
    }
    headers = {
        "uk": f"📚 *Історія звітів ({limit_note['uk']}):*\n",
        "ru": f"📚 *История отчётов ({limit_note['ru']}):*\n",
        "en": f"📚 *Report history ({limit_note['en']}):*\n",
    }
    lines = [headers.get(lang, headers["uk"])]
    depth_icon = {"surface": "○", "medium": "◉", "deep": "●", "phd": "★"}
    for i, r in enumerate(reports, 1):
        date_str = r["created_at"].strftime("%d.%m %H:%M") if r.get("created_at") else "—"
        topic = r.get("topic") or "—"
        icon = depth_icon.get(r.get("depth", ""), "◉")
        lines.append(f"{i}. {date_str} {icon} {topic}")

    await query.message.answer("\n".join(lines), parse_mode="Markdown", reply_markup=main_keyboard(lang))


# ─── Support / Stars ──────────────────────────────────────────────────────────

@router.callback_query(F.data == "support")
async def cb_support(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    await show_support(query.message.chat.id, query.from_user.id, db, query.bot, lang)


@router.callback_query(F.data == "back_main")
async def cb_back_main(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    menu = {"uk": "Головне меню:", "ru": "Главное меню:", "en": "Main menu:"}
    await query.message.answer(menu.get(lang, menu["uk"]), reply_markup=main_keyboard(lang))


# ─── Settings ────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "settings")
async def cb_settings(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    user = await db.get_user_full(query.from_user.id)
    if not user:
        return

    titles = {
        "uk": f"⚙️ *Налаштування InsightSphere*\n\nПоточний час розсилки: *{user['daily_hour']:02d}:00 UTC*\n_(додай свій часовий пояс)_",
        "ru": f"⚙️ *Настройки InsightSphere*\n\nТекущее время рассылки: *{user['daily_hour']:02d}:00 UTC*\n_(прибавь свой часовой пояс)_",
        "en": f"⚙️ *InsightSphere Settings*\n\nCurrent delivery time: *{user['daily_hour']:02d}:00 UTC*\n_(add your timezone offset)_",
    }
    await query.message.answer(
        titles.get(lang, titles["uk"]),
        parse_mode="Markdown",
        reply_markup=settings_keyboard(user["daily_enabled"], user["daily_hour"], lang)
    )


@router.callback_query(F.data == "toggle_daily")
async def cb_toggle_daily(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    user = await db.get_user_full(query.from_user.id)
    if not user:
        return
    new_state = not user["daily_enabled"]
    await db.set_daily_time(query.from_user.id, user["daily_hour"], new_state)
    msgs = {
        "uk": f"Щоденна розсилка {'увімкнена ✅' if new_state else 'вимкнена ❌'}.",
        "ru": f"Ежедневная рассылка {'включена ✅' if new_state else 'выключена ❌'}.",
        "en": f"Daily reports {'enabled ✅' if new_state else 'disabled ❌'}.",
    }
    await query.message.answer(
        msgs.get(lang, msgs["uk"]),
        reply_markup=settings_keyboard(new_state, user["daily_hour"], lang)
    )


@router.callback_query(F.data == "set_time")
async def cb_set_time(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    msgs = {
        "uk": "🕐 *Вибери час розсилки (UTC)*\n\nНаприклад, Київ = UTC+3, для 8:00 вибери 05:00",
        "ru": "🕐 *Выбери время рассылки (UTC)*\n\nНапример, Москва = UTC+3, для 8:00 МСК выбери 05:00",
        "en": "🕐 *Choose delivery time (UTC)*\n\nFor example, London = UTC+1, for 8:00 AM choose 07:00",
    }
    await query.message.answer(
        msgs.get(lang, msgs["uk"]),
        parse_mode="Markdown",
        reply_markup=time_picker_keyboard(lang)
    )


@router.callback_query(F.data.startswith("set_hour:"))
async def cb_set_hour(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    hour = int(query.data.split("set_hour:", 1)[1])
    user = await db.get_user_full(query.from_user.id)
    await db.set_daily_time(query.from_user.id, hour, user["daily_enabled"] if user else True)
    msgs = {
        "uk": f"✅ Час розсилки встановлено: *{hour:02d}:00 UTC*",
        "ru": f"✅ Время рассылки установлено: *{hour:02d}:00 UTC*",
        "en": f"✅ Delivery time set to *{hour:02d}:00 UTC*",
    }
    await query.message.answer(
        msgs.get(lang, msgs["uk"]),
        parse_mode="Markdown",
        reply_markup=main_keyboard(lang)
    )


# ─── Habit menu shortcut ──────────────────────────────────────────────────────

@router.callback_query(F.data == "habit_menu")
async def cb_habit_menu(query: CallbackQuery, db: Database):
    """Redirect habit_menu callback to the habit command handler"""
    await query.answer()
    from handlers.habits import cmd_habit
    await cmd_habit(query.message, db, claude)


# ─── Focus menu shortcut ──────────────────────────────────────────────────────

@router.callback_query(F.data == "focus_menu")
async def cb_focus_menu(query: CallbackQuery, db: Database):
    await query.answer()
    from handlers.focus import cmd_focus
    from aiogram.fsm.context import FSMContext
    # Focus needs FSM — redirect user to type /focus
    lang = await _lang(query, db)
    msgs = {"uk": "Напиши /focus щоб розпочати сесію фокусу 🎯",
            "ru": "Напиши /focus чтобы начать сессию фокуса 🎯",
            "en": "Type /focus to start a focus session 🎯"}
    await query.message.answer(msgs.get(lang, msgs["uk"]))


# ─── Techniques menu shortcut ─────────────────────────────────────────────────

@router.callback_query(F.data == "techniques_menu")
async def cb_techniques_menu(query: CallbackQuery, db: Database):
    await query.answer()
    from handlers.techniques import cmd_techniques
    await cmd_techniques(query.message, db)


# ─── Weekly topics ────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("add_topic:"))
async def cb_add_topic(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    idx = int(query.data.split("add_topic:", 1)[1])
    suggested = await db.get_weekly_topics(query.from_user.id)

    if idx < len(suggested):
        topic = suggested[idx]
        profile = await db.get_profile(query.from_user.id)
        if profile:
            interests = profile.get("interests", [])
            if isinstance(interests, list) and topic not in interests:
                interests.append(topic)
                profile["interests"] = interests
                await db.save_profile(query.from_user.id, profile)
            msgs = {"uk": f"✅ Тему «{topic}» додано до профілю.",
                    "ru": f"✅ Тема «{topic}» добавлена в профиль.",
                    "en": f"✅ Topic '{topic}' added to your profile."}
            await query.message.answer(msgs.get(lang, msgs["uk"]))


@router.callback_query(F.data == "add_all_topics")
async def cb_add_all_topics(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    suggested = await db.get_weekly_topics(query.from_user.id)
    profile = await db.get_profile(query.from_user.id)

    if profile and suggested:
        interests = profile.get("interests", [])
        if isinstance(interests, list):
            for t in suggested:
                if t not in interests:
                    interests.append(t)
            profile["interests"] = interests
            await db.save_profile(query.from_user.id, profile)

        msgs = {
            "uk": f"✅ Додано {len(suggested)} нових тем до профілю. Наступні звіти вже враховуватимуть їх 🎯",
            "ru": f"✅ Добавлено {len(suggested)} новых тем в профиль. Следующие отчёты уже будут их учитывать 🎯",
            "en": f"✅ Added {len(suggested)} new topics to your profile. Next reports will include them 🎯",
        }
        await query.message.answer(msgs.get(lang, msgs["uk"]), reply_markup=main_keyboard(lang))


@router.callback_query(F.data == "skip_weekly")
async def cb_skip_weekly(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    msgs = {
        "uk": "Добре, пропускаємо. Нові пропозиції прийдуть наступного тижня 📅",
        "ru": "Окей, пропускаем. Новые предложения придут на следующей неделе 📅",
        "en": "Got it, skipping. New suggestions will come next week 📅",
    }
    await query.message.answer(msgs.get(lang, msgs["uk"]), reply_markup=main_keyboard(lang))


# ─── Stats shortcut ───────────────────────────────────────────────────────────

@router.callback_query(F.data == "stats_cb")
async def cb_stats(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await _lang(query, db)
    from handlers.gamification import send_stats
    await send_stats(query.message.chat.id, query.bot, db, query.from_user.id, lang)
