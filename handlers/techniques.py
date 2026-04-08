import logging
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command

from db.database import Database
from keyboards import techniques_keyboard, premium_keyboard

logger = logging.getLogger(__name__)
router = Router()

# ─── Base techniques library ──────────────────────────────────────────────────
FREE_TECHNIQUES = {
    "uk": [
        {"id": "pomodoro",    "name": "🍅 Техніка Помодоро",      "tag": "фокус"},
        {"id": "box_breath",  "name": "📦 Квадратне дихання",      "tag": "стрес"},
        {"id": "5why",        "name": "❓ Метод «5 Чому»",          "tag": "мислення"},
        {"id": "journaling",  "name": "📓 Рефлексивний журнал",    "tag": "самоусвідомлення"},
    ],
    "ru": [
        {"id": "pomodoro",    "name": "🍅 Техника Помодоро",       "tag": "фокус"},
        {"id": "box_breath",  "name": "📦 Квадратное дыхание",     "tag": "стресс"},
        {"id": "5why",        "name": "❓ Метод «5 Почему»",         "tag": "мышление"},
        {"id": "journaling",  "name": "📓 Рефлексивный журнал",    "tag": "самоосознание"},
    ],
    "en": [
        {"id": "pomodoro",    "name": "🍅 Pomodoro Technique",     "tag": "focus"},
        {"id": "box_breath",  "name": "📦 Box Breathing",          "tag": "stress"},
        {"id": "5why",        "name": "❓ 5 Whys Method",           "tag": "thinking"},
        {"id": "journaling",  "name": "📓 Reflective Journaling",  "tag": "awareness"},
    ],
}

PREMIUM_TECHNIQUES = {
    "uk": [
        {"id": "cbt_thought", "name": "🧠 КПТ: Запис думок",       "tag": "КПТ"},
        {"id": "ikigai",      "name": "⛩ Ікігай",                  "tag": "сенс"},
        {"id": "woop",        "name": "🎯 WOOP-метод",              "tag": "цілі"},
        {"id": "stoic_eve",   "name": "🏛 Стоїчна вечірня рефлексія","tag": "стоїцизм"},
        {"id": "flow_state",  "name": "🌊 Стан потоку",             "tag": "продуктивність"},
    ],
    "ru": [
        {"id": "cbt_thought", "name": "🧠 КПТ: Запись мыслей",     "tag": "КПТ"},
        {"id": "ikigai",      "name": "⛩ Икигай",                  "tag": "смысл"},
        {"id": "woop",        "name": "🎯 WOOP-метод",              "tag": "цели"},
        {"id": "stoic_eve",   "name": "🏛 Стоическая вечерняя рефлексия","tag": "стоицизм"},
        {"id": "flow_state",  "name": "🌊 Состояние потока",        "tag": "продуктивность"},
    ],
    "en": [
        {"id": "cbt_thought", "name": "🧠 CBT Thought Record",     "tag": "CBT"},
        {"id": "ikigai",      "name": "⛩ Ikigai",                  "tag": "meaning"},
        {"id": "woop",        "name": "🎯 WOOP Method",             "tag": "goals"},
        {"id": "stoic_eve",   "name": "🏛 Stoic Evening Review",    "tag": "stoicism"},
        {"id": "flow_state",  "name": "🌊 Flow State",              "tag": "productivity"},
    ],
}

HEADERS = {
    "uk": "📚 *Бібліотека технік*\n\nОбери техніку — і я поясню, як застосувати її саме тобі:\n\n",
    "ru": "📚 *Библиотека техник*\n\nВыбери технику — и я объясню, как применить её именно тебе:\n\n",
    "en": "📚 *Techniques Library*\n\nChoose a technique — I'll explain how to apply it specifically to you:\n\n",
}
PREMIUM_LOCK = {
    "uk": "\n🔒 *Преміум-техніки* (доступні з ⭐ /support):\n",
    "ru": "\n🔒 *Премиум-техники* (доступны с ⭐ /support):\n",
    "en": "\n🔒 *Premium techniques* (available with ⭐ /support):\n",
}


@router.message(Command("techniques"))
async def cmd_techniques(message: Message, db: Database):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    is_prem = await db.is_premium(user_id)

    free = FREE_TECHNIQUES.get(lang, FREE_TECHNIQUES["uk"])
    premium = PREMIUM_TECHNIQUES.get(lang, PREMIUM_TECHNIQUES["uk"])

    header = HEADERS.get(lang, HEADERS["uk"])
    free_list = "\n".join([f"• {t['name']} _({t['tag']})_" for t in free])

    text = header + free_list
    if not is_prem:
        prem_list = "\n".join([f"• {t['name']} _({t['tag']})_" for t in premium])
        text += PREMIUM_LOCK.get(lang, PREMIUM_LOCK["uk"]) + prem_list

    all_techs = free + (premium if is_prem else [])
    await message.answer(text, parse_mode="Markdown", reply_markup=techniques_keyboard(all_techs, lang))


@router.callback_query(F.data.startswith("technique:"))
async def cb_technique(query: CallbackQuery, db: Database):
    await query.answer()
    tech_id = query.data.split(":", 1)[1]
    user_id = query.from_user.id
    lang = await db.get_language(user_id)
    is_prem = await db.is_premium(user_id)
    profile = await db.get_profile(user_id)

    # Check if premium technique requested by free user
    all_premium_ids = [t["id"] for t in PREMIUM_TECHNIQUES.get("uk", [])]
    if tech_id in all_premium_ids and not is_prem:
        lock_msg = {
            "uk": "🔒 Ця техніка доступна з Преміумом ⭐\n/support",
            "ru": "🔒 Эта техника доступна с Премиумом ⭐\n/support",
            "en": "🔒 This technique requires Premium ⭐\n/support",
        }
        await query.message.answer(lock_msg.get(lang, lock_msg["uk"]))
        return

    await query.bot.send_chat_action(chat_id=query.message.chat.id, action="typing")
    explanation = await generate_technique_explanation(tech_id, profile or {}, lang, claude)
    await query.message.answer(explanation, parse_mode="Markdown")

    # XP for learning a technique
    await db.add_xp(user_id, 5)


async def generate_technique_explanation(tech_id: str, profile: dict, lang: str, claude: AsyncAnthropic) -> str:
    name = profile.get("name", "")
    big_five = profile.get("big_five", {})
    mindset = profile.get("mindset", "mixed")
    fears = profile.get("fears", [])

    lang_instruction = {
        "uk": "Відповідай українською.", "ru": "Отвечай на русском.", "en": "Reply in English."
    }.get(lang, "Відповідай українською.")

    prompt = f"""
{lang_instruction}

Ти — AI-Куратор InsightSphere. Поясни техніку «{tech_id}» для конкретного користувача.

Профіль:
- Ім'я: {name}
- Mindset: {mindset}
- Big Five: O={big_five.get('O',5)} C={big_five.get('C',5)} N={big_five.get('N',5)}
- Бар'єри: {', '.join(fears) if isinstance(fears, list) else fears}

Формат:
**[Назва техніки]**

📖 Суть: [1-2 речення — що це і звідки]

🎯 Чому підходить саме тобі: [1-2 речення, персоналізовано під профіль]

⚡ Як застосувати прямо зараз:
1. [крок]
2. [крок]
3. [крок]

💡 Порада від куратора: [1 речення, персоналізована інсайт]
"""
    try:
        response = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    except Exception as e:
        logger.error(f"Technique explanation error: {e}")
        return tech_id
