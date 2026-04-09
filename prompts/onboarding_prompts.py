import json
import logging
import re
import os
import google.generativeai as genai

from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

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

WELCOME_MESSAGES = { ... }   # (залишаю твої повідомлення без змін)

LANG_SELECT_MSG = { ... }    # (залишаю без змін)

POST_ONBOARDING_MSG = { ... } # (залишаю без змін)

LIMIT_MSG = { ... }          # (залишаю без змін)

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
    instructions = { ... }  # (залишаю твою функцію без змін)
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
        except json.JSONDecodeError as e:
            logger.error(f"Profile JSON parse error: {e}")
    
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
        await message.answer(
            POST_ONBOARDING_MSG.get(lang, POST_ONBOARDING_MSG["uk"]),
            reply_markup=main_keyboard()
        )
        return

    step = await db.get_onboarding_step(user_id)
    lang = await db.get_language(user_id) or "uk"

    # First message — language detection
    if step == 0:
        explicit_lang = detect_language_from_text(user_text)
        lang = explicit_lang or guess_language_from_text(user_text)
        await db.save_language(user_id, lang)
        await db.increment_onboarding_step(user_id)
        await message.answer(
            WELCOME_MESSAGES.get(lang, WELCOME_MESSAGES["uk"]),
            parse_mode="Markdown"
        )
        return

    # Language change mid-conversation
    explicit_lang = detect_language_from_text(user_text)
    if explicit_lang and explicit_lang != lang:
        await db.save_language(user_id, explicit_lang)
        lang = explicit_lang

    # Resistant user logic
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
        # Формуємо промпт
        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
        full_prompt = f"{ONBOARDING_SYSTEM_PROMPT}\n\nІсторія діалогу:\n{history_text}"

        response = await model.generate_content_async(full_prompt)
        assistant_text = response.text

        visible_text, profile_data = extract_profile_from_response(assistant_text)

        if profile_data:
            profile_data["onboarding_complete"] = True
            profile_data["language"] = lang
            await db.save_profile(user_id, profile_data)
            
            # Save clean conversation
            clean_history = [h for h in history[:-1]]
            clean_history.append({"role": "user", "content": user_text})
            clean_history.append({"role": "assistant", "content": visible_text})
            await db.save_conversation(user_id, clean_history)

            # Completion message
            name = profile_data.get("name", "")
            # ... (твій completion_texts блок залишається)
            # Я можу дати повний варіант, якщо треба

            await message.answer(completion_texts.get(lang, completion_texts["uk"]), 
                               parse_mode="Markdown", reply_markup=onboarding_done_kb)
        else:
            # Normal step
            clean_history = [h for h in history[:-1]]
            clean_history.append({"role": "user", "content": user_text})
            clean_history.append({"role": "assistant", "content": assistant_text})
            await db.save_conversation(user_id, clean_history)
            await db.increment_onboarding_step(user_id)
            await message.answer(assistant_text, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        err_msgs = {
            "uk": "Щось пішло не так — спробуй ще раз. Або /start щоб почати заново.",
            "ru": "Что-то пошло не так — попробуй ещё раз. Или /start чтобы начать заново.",
            "en": "Something went wrong — try again. Or /start to restart.",
        }
        await message.answer(err_msgs.get(lang, err_msgs["uk"]))
