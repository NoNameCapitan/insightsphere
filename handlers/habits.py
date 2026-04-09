import logging
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from db.database import Database
from keyboards import habit_keyboard, habit_list_keyboard, premium_keyboard

logger = logging.getLogger(__name__)
router = Router()

FREE_HABIT_LIMIT = 1


class HabitStates(StatesGroup):
    waiting_for_name = State()
    waiting_for_missed_reason = State()


T = {
    "no_profile": {
        "uk": "Спочатку пройди онбординг — /start",
        "ru": "Сначала пройди онбординг — /start",
        "en": "Complete onboarding first — /start",
    },
    "limit_reached": {
        "uk": "🌱 У безкоштовній версії — 1 активна звичка.\n\nЗ *Преміумом* — необмежено + детальна статистика ⭐\n/support",
        "ru": "🌱 В бесплатной версии — 1 активная привычка.\n\nС *Премиумом* — неограниченно + детальная статистика ⭐\n/support",
        "en": "🌱 Free tier allows 1 active habit.\n\nWith *Premium* — unlimited + detailed stats ⭐\n/support",
    },
    "logged": {
        "uk": "✅ Звичка «{name}» виконана! Стрік: {streak} 🔥",
        "ru": "✅ Привычка «{name}» выполнена! Стрик: {streak} 🔥",
        "en": "✅ Habit '{name}' logged! Streak: {streak} 🔥",
    },
    "streak_7": {
        "uk": "🎉 *7-денний стрік* зі звичкою «{name}»!\n\nТи справжній чемпіон постійності. Ще 23 дні — і отримаєш нагороду за 30-денний стрік 💎",
        "ru": "🎉 *7-дневный стрик* по привычке «{name}»!\n\nТы настоящий чемпион постоянства. Ещё 23 дня — и получишь награду за 30-дневный стрик 💎",
        "en": "🎉 *7-day streak* on habit '{name}'!\n\nYou're a true consistency champion. 23 more days — and you'll earn the 30-day reward 💎",
    },
    "streak_30": {
        "uk": "💎 *30-денний стрік* зі звичкою «{name}»! Це справді вражає.\n\nТвоя нагорода вже надіслана 🎁",
        "ru": "💎 *30-дневный стрик* по привычке «{name}»! Это по-настоящему впечатляет.\n\nТвоя награда уже отправлена 🎁",
        "en": "💎 *30-day streak* on habit '{name}'! That's truly impressive.\n\nYour reward has been sent 🎁",
    },
    "deleted": {
        "uk": "🗑 Звичку видалено.",
        "ru": "🗑 Привычка удалена.",
        "en": "🗑 Habit deleted.",
    },
    "ask_habit_name": {
        "uk": "Як назвемо звичку? Напиши коротку назву (наприклад: «Медитація 10 хв» або «Читання перед сном»).",
        "ru": "Как назовём привычку? Напиши короткое название (например: «Медитация 10 мин» или «Чтение перед сном»).",
        "en": "What shall we name the habit? (e.g. '10-min meditation' or 'Evening reading')",
    },
    "habit_added": {
        "uk": "✅ Звичка «{name}» додана! Відмічай виконання щодня — і твій стрік зростатиме 🌱",
        "ru": "✅ Привычка «{name}» добавлена! Отмечай выполнение каждый день — и твой стрик будет расти 🌱",
        "en": "✅ Habit '{name}' added! Log it every day — and your streak will grow 🌱",
    },
    "missed_reason_ask": {
        "uk": "Що завадило виконати звичку «{name}» вчора? Розкажи — я допоможу знайти рішення або адаптувати її під твій ритм.",
        "ru": "Что помешало выполнить привычку «{name}» вчера? Расскажи — я помогу найти решение или адаптировать её под твой ритм.",
        "en": "What got in the way of doing '{name}' yesterday? Tell me — I'll help find a solution or adapt it to your rhythm.",
    },
}


def t(key: str, lang: str, **kwargs) -> str:
    text = T.get(key, {}).get(lang, T.get(key, {}).get("uk", key))
    return text.format(**kwargs) if kwargs else text


async def suggest_habits(profile: dict, lang: str) -> str:
    name = profile.get("name", "")
    interests = profile.get("interests", [])
    values = profile.get("values", [])
    fears = profile.get("fears", [])
    mindset = profile.get("mindset", "mixed")
    big_five = profile.get("big_five", {})

    lang_instruction = {
        "uk": "Відповідай виключно українською мовою.",
        "ru": "Отвечай исключительно на русском языке.",
        "en": "Reply exclusively in English.",
    }.get(lang, "Відповідай виключно українською мовою.")

    prompt = f"""
{lang_instruction}

Ти — AI-Куратор InsightSphere. На основі профілю запропонуй 2 персональні звички.

Профіль: {name}, інтереси={interests}, цінності={values}, бар'єри={fears}, mindset={mindset},
Big Five: O={big_five.get('O',5)} C={big_five.get('C',5)} E={big_five.get('E',5)} A={big_five.get('A',5)} N={big_five.get('N',5)}

Для кожної звички:
1. Назва (до 5 слів)
2. Чому саме ця звичка підходить цій людині (1-2 речення, персоналізовано, пов'язано з Big Five і цінностями)
3. Мінімальний перший крок (що зробити сьогодні, дуже конкретно)

Формат:
🌱 **[Назва 1]**
[Обґрунтування]
Перший крок: [дія]

🌱 **[Назва 2]**
[Обґрунтування]
Перший крок: [дія]
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Habit suggestion error: {e}")
        return ""


async def analyze_missed_barrier(
    habit_name: str, reason: str, profile: dict, lang: str
) -> str:
    """Generate empathetic barrier analysis and adaptation suggestion"""
    lang_instruction = {
        "uk": "Відповідай виключно українською.",
        "ru": "Отвечай исключительно на русском.",
        "en": "Reply exclusively in English.",
    }.get(lang, "Відповідай виключно українською.")

    name = profile.get("name", "")
    mindset = profile.get("mindset", "mixed")
    big_five = profile.get("big_five", {})

    prompt = f"""
{lang_instruction}

Ти — AI-Куратор InsightSphere. Користувач {name} пропустив звичку «{habit_name}».

Причина: {reason}

Профіль: mindset={mindset}, N={big_five.get('N',5)} (невротизм), C={big_five.get('C',5)} (сумлінність)

Зроби:
1. Affirmation (1 речення — підтримай, НЕ критикуй)
2. Reflection — поверни причину у нейтральному ключі (1 речення)
3. Аналіз бар'єру (1-2 речення — що насправді заважає, без психологічного жаргону)
4. Конкретна адаптація звички (1-2 варіанти, дуже практично)
5. Мотиваційне закінчення (1 речення)

Стиль: живий, теплий, як найкращий друг-коуч.
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Barrier analysis error: {e}")
        return reason


@router.message(Command("habit"))
async def cmd_habit(message: Message, db: Database):
    user_id = message.from_user.id
    profile = await db.get_profile(user_id)
    lang = await db.get_language(user_id)

    if not profile or not profile.get("onboarding_complete"):
        await message.answer(t("no_profile", lang))
        return

    is_prem = await db.is_premium(user_id)
    habits = await db.get_habits(user_id)

    if not habits:
        await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")
        suggestion = await suggest_habits(profile, lang)

        headers = {
            "uk": "🌱 *AI-Трекер звичок*\n\nНа основі твого профілю рекомендую:\n\n",
            "ru": "🌱 *AI-Трекер привычек*\n\nНа основе твоего профиля рекомендую:\n\n",
            "en": "🌱 *AI Habit Tracker*\n\nBased on your profile, I recommend:\n\n",
        }
        footers = {
            "uk": "\n\nЯку звичку починаємо відстежувати? Напиши її назву.",
            "ru": "\n\nКакую привычку начинаем отслеживать? Напиши её название.",
            "en": "\n\nWhich habit shall we track? Type its name.",
        }
        await message.answer(
            headers.get(lang, headers["uk"]) + suggestion + footers.get(lang, footers["uk"]),
            parse_mode="Markdown",
            reply_markup=habit_keyboard(lang)
        )
    else:
        await _show_habit_list(message, habits, is_prem, lang)


async def _show_habit_list(message, habits, is_prem, lang):
    headers = {
        "uk": f"🌱 *Твої звички* ({'⭐ Преміум' if is_prem else 'Free'})\n\n",
        "ru": f"🌱 *Твои привычки* ({'⭐ Премиум' if is_prem else 'Free'})\n\n",
        "en": f"🌱 *Your habits* ({'⭐ Premium' if is_prem else 'Free'})\n\n",
    }
    lines = [headers.get(lang, headers["uk"])]
    for h in habits:
        icon = "🔥" if h["streak"] > 0 else "○"
        lines.append(f"{icon} *{h['name']}* — {h['streak']} дн.")

    await message.answer("\n".join(lines), parse_mode="Markdown", reply_markup=habit_list_keyboard(habits, lang))


@router.callback_query(F.data == "habit_add")
async def cb_habit_add(query: CallbackQuery, db: Database, state: FSMContext):
    await query.answer()
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    is_prem = await db.is_premium(user_id)
    count = await db.count_active_habits(user_id)

    if not is_prem and count >= FREE_HABIT_LIMIT:
        await query.message.answer(t("limit_reached", lang), parse_mode="Markdown", reply_markup=premium_keyboard(lang))
        return

    await state.set_state(HabitStates.waiting_for_name)
    await query.message.answer(t("ask_habit_name", lang))


@router.message(HabitStates.waiting_for_name)
async def habit_name_received(message: Message, db: Database, state: FSMContext):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    name = message.text.strip()[:100]

    await db.add_habit(user_id, name)
    await state.clear()
    await message.answer(t("habit_added", lang, name=name), parse_mode="Markdown")
    await db.add_xp(user_id, 5)


@router.callback_query(F.data.startswith("habit_log:"))
async def cb_habit_log(query: CallbackQuery, db: Database):
    await query.answer()
    habit_id = int(query.data.split(":", 1)[1])
    user_id = query.from_user.id
    lang = await db.get_language(user_id)

    await db.log_habit(habit_id, user_id)
    hab = await db.get_habit_by_id(habit_id, user_id)
    if not hab:
        return

    streak = hab["streak"]
    await query.message.answer(t("logged", lang, name=hab["name"], streak=streak), parse_mode="Markdown")

    # XP
    xp_result = await db.add_xp(user_id, 10)
    if xp_result["leveled_up"]:
        lvl_msgs = {
            "uk": f"🎖 Новий рівень {xp_result['new_level']}!",
            "ru": f"🎖 Новый уровень {xp_result['new_level']}!",
            "en": f"🎖 Level {xp_result['new_level']} reached!",
        }
        await query.message.answer(lvl_msgs.get(lang, lvl_msgs["uk"]))

    # Streak milestones
    if streak == 7:
        await query.message.answer(t("streak_7", lang, name=hab["name"]), parse_mode="Markdown")
        await db.grant_achievement(user_id, "habit_streak_7")
    elif streak == 30:
        await query.message.answer(t("streak_30", lang, name=hab["name"]), parse_mode="Markdown")
        await db.grant_achievement(user_id, "streak_30")
        await db.grant_bonus_reports(user_id, 3)


@router.callback_query(F.data.startswith("habit_missed:"))
async def cb_habit_missed(query: CallbackQuery, db: Database, state: FSMContext):
    """User acknowledges a missed habit — ask for barrier analysis"""
    await query.answer()
    habit_id = int(query.data.split(":", 1)[1])
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    hab = await db.get_habit_by_id(habit_id, user_id)
    if not hab:
        return

    await state.set_state(HabitStates.waiting_for_missed_reason)
    await state.update_data(habit_id=habit_id, habit_name=hab["name"])
    await query.message.answer(t("missed_reason_ask", lang, name=hab["name"]), parse_mode="Markdown")


@router.message(HabitStates.waiting_for_missed_reason)
async def missed_reason_received(message: Message, db: Database, state: FSMContext):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)
    data = await state.get_data()
    habit_name = data.get("habit_name", "")
    reason = message.text.strip()

    await state.clear()
    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")

    analysis = await analyze_missed_barrier(habit_name, reason, profile or {}, lang)
    await message.answer(analysis, parse_mode="Markdown")


@router.callback_query(F.data.startswith("habit_delete:"))
async def cb_habit_delete(query: CallbackQuery, db: Database):
    await query.answer()
    habit_id = int(query.data.split(":", 1)[1])
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    await db.deactivate_habit(habit_id, user_id)
    await query.message.answer(t("deleted", lang))
