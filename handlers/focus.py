import logging
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from db.database import Database
from keyboards import focus_keyboard, premium_keyboard

logger = logging.getLogger(__name__)
router = Router()


class FocusStates(StatesGroup):
    waiting_for_goal = State()
    in_session = State()


T = {
    "no_profile": {
        "uk": "Спочатку пройди онбординг — /start",
        "ru": "Сначала пройди онбординг — /start",
        "en": "Complete onboarding first — /start",
    },
    "limit_reached": {
        "uk": "🧠 Режим Фокус у безкоштовній версії — 2 сесії на тиждень.\n\nЗ *Преміумом* — необмежено + кастомні техніки ⭐\n/support",
        "ru": "🧠 Режим Фокус в бесплатной версии — 2 сессии в неделю.\n\nС *Премиумом* — неограниченно + кастомные техники ⭐\n/support",
        "en": "🧠 Focus mode in free tier — 2 sessions per week.\n\nWith *Premium* — unlimited + custom techniques ⭐\n/support",
    },
    "ask_goal": {
        "uk": "🎯 *Режим Фокус*\n\nРозкажи, над чим плануєш працювати в цій сесії? Що конкретно хочеш зробити або обдумати?",
        "ru": "🎯 *Режим Фокус*\n\nРасскажи, над чем планируешь работать в этой сессии? Что конкретно хочешь сделать или обдумать?",
        "en": "🎯 *Focus Mode*\n\nWhat are you planning to work on in this session? What specifically do you want to do or think through?",
    },
    "session_started": {
        "uk": "✅ Відмінно! Сесія розпочата.\n\nКоли завершиш — натисни «Завершити сесію» або напиши /done.",
        "ru": "✅ Отлично! Сессия начата.\n\nКогда завершишь — нажми «Завершить сессию» или напиши /done.",
        "en": "✅ Great! Session started.\n\nWhen you're done — press 'End session' or type /done.",
    },
    "done_prompt": {
        "uk": "Як пройшла сесія? Що вдалося зробити?",
        "ru": "Как прошла сессия? Что удалось сделать?",
        "en": "How did the session go? What did you accomplish?",
    },
}


def t(key: str, lang: str) -> str:
    return T.get(key, {}).get(lang, T.get(key, {}).get("uk", key))


async def generate_focus_session(goal: str, profile: dict, lang: str) -> str:
    """Generate a personalized focus session plan"""
    name = profile.get("name", "")
    mindset = profile.get("mindset", "mixed")
    big_five = profile.get("big_five", {})
    fears = profile.get("fears", [])

    lang_instruction = {
        "uk": "Відповідай українською.",
        "ru": "Отвечай на русском.",
        "en": "Reply in English."
    }.get(lang, "Відповідай українською.")

    prompt = f"""
{lang_instruction}

Ти — AI-Куратор InsightSphere. Користувач розпочинає сесію фокусу.

Профіль:
- Ім'я: {name}
- Mindset: {mindset}
- Big Five: O={big_five.get('O',5)} C={big_five.get('C',5)} N={big_five.get('N',5)}
- Бар'єри: {', '.join(fears) if isinstance(fears, list) else fears}

Мета сесії: {goal}

Створи персональний план фокус-сесії (5-15 хвилин):
1. Коротка перевірка стану (1 речення) — Affirmation + Reflection по MI
2. Розбивка завдання на 2-3 мікрокроки (конкретно)
3. Одна техніка для зняття стресу/налаштування (адаптована під його Big Five)
4. Мотиваційний фінал (1 речення, персоналізовано)

Стиль: живий, впевнений, як найкращий коуч.
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Focus session generation error: {e}")
        return goal


async def generate_session_summary(goal: str, result: str, profile: dict, lang: str) -> str:
    """Generate a closing summary after focus session"""
    name = profile.get("name", "")
    lang_instruction = {
        "uk": "Відповідай українською.",
        "ru": "Отвечай на русском.",
        "en": "Reply in English."
    }.get(lang, "Відповідай українською.")

    prompt = f"""
{lang_instruction}

Ім'я: {name}. Сесія фокусу завершена.
Мета: {goal}
Результат: {result}

Зроби:
1. Affirmation + Reflection (1-2 речення по MI)
2. Підсумок того, що зроблено (коротко)
3. Наступний крок на завтра (1 конкретна дія)
4. Мотиваційне закінчення (1 речення)
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Focus summary error: {e}")
        return result


@router.message(Command("focus"))
async def cmd_focus(message: Message, db: Database, state: FSMContext):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)

    if not profile or not profile.get("onboarding_complete"):
        await message.answer(t("no_profile", lang))
        return

    is_prem = await db.is_premium(user_id)
    count, limit_reached = await db.check_focus_limit(user_id)

    if limit_reached:
        await message.answer(
            t("limit_reached", lang),
            parse_mode="Markdown",
            reply_markup=premium_keyboard(lang)
        )
        return

    await state.set_state(FocusStates.waiting_for_goal)
    await message.answer(t("ask_goal", lang), parse_mode="Markdown")


@router.message(FocusStates.waiting_for_goal)
async def focus_goal_received(message: Message, db: Database, state: FSMContext):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)
    goal = message.text.strip()

    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")

    session_id = await db.start_focus_session(user_id, goal, 15)
    await state.update_data(session_id=session_id, goal=goal)
    await state.set_state(FocusStates.in_session)

    plan = await generate_focus_session(goal, profile or {}, lang)

    end_btns = {
        "uk": "✅ Завершити сесію",
        "ru": "✅ Завершить сессию",
        "en": "✅ End session",
    }
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=end_btns.get(lang, end_btns["uk"]), callback_data="focus_done")
    ]])

    await message.answer(plan, parse_mode="Markdown", reply_markup=kb)

    # XP for starting session
    await db.add_xp(user_id, 5)


@router.callback_query(F.data == "focus_done")
async def cb_focus_done(query: CallbackQuery, db: Database, state: FSMContext):
    await query.answer()
    lang = await db.get_language(query.from_user.id)
    await query.message.answer(t("done_prompt", lang))
    await state.set_state(FocusStates.in_session)


@router.message(Command("done"))
@router.message(FocusStates.in_session)
async def focus_session_done(message: Message, db: Database, state: FSMContext):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)
    data = await state.get_data()

    if not data.get("session_id"):
        await state.clear()
        return

    result = message.text.strip()
    goal = data.get("goal", "")
    session_id = data["session_id"]

    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")
    summary = await generate_session_summary(goal, result, profile or {}, lang)

    await db.complete_focus_session(session_id, summary)
    await state.clear()

    # XP for completing session
    xp_result = await db.add_xp(user_id, 20)

    headers = {
        "uk": "🎯 *Сесія завершена!*\n\n",
        "ru": "🎯 *Сессия завершена!*\n\n",
        "en": "🎯 *Session complete!*\n\n",
    }
    await message.answer(
        headers.get(lang, headers["uk"]) + summary,
        parse_mode="Markdown"
    )

    if xp_result["leveled_up"]:
        level_msgs = {
            "uk": f"🎖 Новий рівень {xp_result['new_level']}! Фокус і постійність творять дива.",
            "ru": f"🎖 Новый уровень {xp_result['new_level']}! Фокус и постоянство творят чудеса.",
            "en": f"🎖 Level {xp_result['new_level']}! Focus and consistency work wonders.",
        }
        await message.answer(level_msgs.get(lang, level_msgs["uk"]))

    # Achievement: first focus session
    is_new = await db.grant_achievement(user_id, "first_focus")
    if is_new:
        ach_msgs = {
            "uk": "🏆 Досягнення: *«Перший фокус»*! Ти зробив перший крок до глибокої роботи.",
            "ru": "🏆 Достижение: *«Первый фокус»*! Ты сделал первый шаг к глубокой работе.",
            "en": "🏆 Achievement: *'First Focus'*! You took the first step toward deep work.",
        }
        await message.answer(ach_msgs.get(lang, ach_msgs["uk"]), parse_mode="Markdown")

    # Achievement: 10 focus sessions
    hit_10 = await db.check_focus_achievement(user_id)
    if hit_10:
        ach10_msgs = {
            "uk": "🧘 Досягнення: *«Майстер фокусу»*! 10 завершених сесій — ти опанував мистецтво глибокої роботи.",
            "ru": "🧘 Достижение: *«Мастер фокуса»*! 10 завершённых сессий — ты освоил искусство глубокой работы.",
            "en": "🧘 Achievement: *'Focus Master'*! 10 completed sessions — you've mastered the art of deep work.",
        }
        await message.answer(ach10_msgs.get(lang, ach10_msgs["uk"]), parse_mode="Markdown")
