import json
import logging
import re
import os
import google.generativeai as genai

from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command

from db.database import Database
from prompts.onboarding_prompts import ONBOARDING_SYSTEM_PROMPT
from keyboards import main_keyboard

logger = logging.getLogger(__name__)
router = Router()

# ========================== GEMINI CONFIG ==========================
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-lite",
    generation_config={
        "temperature": 0.75,
        "max_output_tokens": 1500,
        "top_p": 0.95,
        "top_k": 40,
    },
    safety_settings=[
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]
)
# ================================================================

RESISTANT_THRESHOLD = 2
SHORT_ANSWER_WORDS = 5

# ─── Language detection ───────────────────────────────────────────────────────
LANG_TRIGGERS = {
    "uk": ["ua", "українська", "украинська", "украінська"],
    "ru": ["ru", "русский", "русский язык"],
    "en": ["en", "english"],
}

WELCOME_MESSAGES = {
    "uk": (
        "Привіт! Я — InsightSphere, твій персональний куратор. 🌐\n\n"
        "Щоб кожен день надавати тобі по-справжньому цінні інсайти, мені важливо "
        "по-справжньому тебе зрозуміти — не просто інтереси, а те, що тебе рухає, "
        "що важливо і що іноді заважає.\n\n"
        "Давай познайомимося? *Розкажи, як тебе звати і що зараз найбільше "
        "хвилює або цікавить — у житті, роботі чи розвитку?*"
    ),
    "ru": (
        "Привет! Я — InsightSphere, твой персональный куратор. 🌐\n\n"
        "Чтобы каждый день давать тебе по-настоящему ценные инсайты, мне важно "
        "по-настоящему тебя понять — не просто интересы, а то, что тебя движет, "
        "что важно и что иногда мешает.\n\n"
        "Давай познакомимся? *Расскажи, как тебя зовут и что сейчас больше всего "
        "волнует или интересует — в жизни, работе или развитии?*"
    ),
    "en": (
        "Hey! I'm InsightSphere, your personal curator. 🌐\n\n"
        "To give you truly valuable insights every day, I need to really understand you "
        "— not just your interests, but what drives you, what matters, and what sometimes "
        "holds you back.\n\n"
        "Let's get acquainted? *Tell me your name and what's currently on your mind "
        "most — in life, work, or personal growth?*"
    ),
}

LANG_SELECT_MSG = {
    "uk": "Обери мову / Choose your language / Выбери язык:\n\n🇺🇦 Напиши «UA» або «Українська»\n🇬🇧 Type «EN» or «English»\n🇷🇺 Напиши «RU» или «Русский»",
    "ru": LANG_SELECT_MSG["uk"],  # можна однакове
    "en": LANG_SELECT_MSG["uk"],
}

POST_ONBOARDING_MSG = {
    "uk": "Твій профіль вже налаштовано. Що зробимо?",
    "ru": "Твой профиль уже настроен. Что сделаем?",
    "en": "Your profile is already set up. What shall we do?",
}

# ─── Helper functions ───────────────────────────────────────────────────────
def detect_language_from_text(text: str) -> str | None:
    t = text.strip().lower()
    for lang, triggers in LANG_TRIGGERS.items():
        if any(trigger in t for trigger in triggers):
            return lang
    return None

def guess_language_from_text(text: str) -> str:
    ua_chars = set("іїєґ")
    ru_chars = set("ыъэё")
    text_lower = text.lower()
    
    if any(c in text_lower for c in ua_chars):
        return "uk"
    if any(c in text_lower for c in ru_chars):
        return "ru"
    
    latin = sum(1 for c in text_lower if c.isalpha() and ord(c) < 128)
    cyrillic = sum(1 for c in text_lower if '\u0400' <= c <= '\u04FF')
    if latin > cyrillic:
        return "en"
    return "uk"

def is_short_answer(text: str) -> bool:
    words = text.strip().split()
    evasive = any(phrase in text.lower() for phrase in [
        "не знаю", "незнаю", "може", "може бути", "не впевнений", "не уверен",
        "наверное", "may be", "maybe", "i don't know", "dunno",
        "не хочу", "пропустити", "пропустить", "skip"
    ])
    return len(words) <= SHORT_ANSWER_WORDS or evasive

def build_resistant_injection(count: int, lang: str) -> str:
    instructions = {
        1: {"uk": "\n[СИСТЕМНА ПІДКАЗКА]: Коротка відповідь...", "ru": "...", "en": "..."},
        2: {"uk": "\n[СИСТЕМНА ПІДКАЗКА]: Знову коротка відповідь...", "ru": "...", "en": "..."},
        3: {"uk": "\n[СИСТЕМНА ПІДКАЗКА]: Кілька коротких відповідей...", "ru": "...", "en": "..."},
    }
    tier = min(count, 3)
    return instructions.get(tier, instructions[1]).get(lang, instructions[1]["uk"])

def extract_profile_from_response(text: str) -> tuple[str, dict | None]:
    if "ONBOARDING_COMPLETE" not in text:
        return text.strip(), None
    parts = text.split("ONBOARDING_COMPLETE", 1)
    visible_text = parts[0].strip()
    json_match = re.search(r'\{.*\}', parts[1] if len(parts) > 1 else "", re.DOTALL)
    if json_match:
        try:
            profile = json.loads(json_match.group())
            return visible_text, profile
        except Exception as e:
            logger.error(f"JSON parse error: {e}")
    return visible_text, None

# ─── Handlers ────────────────────────────────────────────────────────────────
@router.message(Command("start"))
async def cmd_start(message: Message, db: Database):
    user_id = message.from_user.id
    username = message.from_user.username
    await db.ensure_user(user_id, username)
    await db.reset_user(user_id)
    await message.answer(LANG_SELECT_MSG["uk"], parse_mode="Markdown")

@router.message(F.text & ~F.text.startswith("/"))
async def handle_message(message: Message, db: Database):
    user_id = message.from_user.id
    user_text = message.text.strip()
    await db.ensure_user(user_id, message.from_user.username)

    profile = await db.get_profile(user_id)
    if profile and profile.get("onboarding_complete"):
        lang = profile.get("language", "uk")
        await message.answer(POST_ONBOARDING_MSG.get(lang, POST_ONBOARDING_MSG["uk"]), 
                           reply_markup=main_keyboard())
        return

    step = await db.get_onboarding_step(user_id)
    lang = await db.get_language(user_id) or "uk"

    if step == 0:
        explicit_lang = detect_language_from_text(user_text)
        lang = explicit_lang or guess_language_from_text(user_text)
        await db.save_language(user_id, lang)
        await db.increment_onboarding_step(user_id)
        await message.answer(WELCOME_MESSAGES.get(lang, WELCOME_MESSAGES["uk"]), parse_mode="Markdown")
        return

    # Main flow
    explicit_lang = detect_language_from_text(user_text)
    if explicit_lang and explicit_lang != lang:
        await db.save_language(user_id, explicit_lang)
        lang = explicit_lang

    if is_short_answer(user_text):
        await db.increment_resistant(user_id)
    else:
        await db.reset_resistant(user_id)

    resistant_count = await db.get_resistant_count(user_id)
    injection = build_resistant_injection(resistant_count, lang) if resistant_count >= 1 else ""

    history = await db.get_conversation(user_id)
    history.append({"role": "user", "content": user_text + injection})

    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")

    try:
        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
        full_prompt = f"{ONBOARDING_SYSTEM_PROMPT}\n\nІсторія діалогу:\n{history_text}"

        response = await model.generate_content_async(full_prompt)
        assistant_text = response.text

        visible_text, profile_data = extract_profile_from_response(assistant_text)

        if profile_data:
            profile_data["onboarding_complete"] = True
            profile_data["language"] = lang
            await db.save_profile(user_id, profile_data)

            clean_history = [h for h in history[:-1]]
            clean_history.append({"role": "user", "content": user_text})
            clean_history.append({"role": "assistant", "content": visible_text})
            await db.save_conversation(user_id, clean_history)

            name = profile_data.get("name", "")
            # Тут можна додати completion_texts якщо потрібно
            await message.answer(visible_text, parse_mode="Markdown")
        else:
            clean_history = [h for h in history[:-1]]
            clean_history.append({"role": "user", "content": user_text})
            clean_history.append({"role": "assistant", "content": assistant_text})
            await db.save_conversation(user_id, clean_history)
            await db.increment_onboarding_step(user_id)
            await message.answer(assistant_text, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        err_msg = "Щось пішло не так — спробуй ще раз. Або /start щоб почати заново."
        await message.answer(err_msg)
