import json
import logging
import re
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command

from db.database import Database
from prompts.onboarding import ONBOARDING_SYSTEM_PROMPT
from keyboards import main_keyboard

logger = logging.getLogger(__name__)
router = Router()

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
    "ru": "Обери мову / Choose your language / Выбери язык:\n\n🇺🇦 Напиши «UA» або «Українська»\n🇬🇧 Type «EN» or «English»\n🇷🇺 Напиши «RU» или «Русский»",
    "en": "Обери мову / Choose your language / Выбери язык:\n\n🇺🇦 Напиши «UA» або «Українська»\n🇬🇧 Type «EN» or «English»\n🇷🇺 Напиши «RU» или «Русский»",
}

POST_ONBOARDING_MSG = {
    "uk": "Твій профіль вже налаштовано. Що зробимо?",
    "ru": "Твой профиль уже настроен. Что сделаем?",
    "en": "Your profile is already set up. What shall we do?",
}

LIMIT_MSG = {
    "uk": "📊 Сьогоднішній інсайт вже надіслано.\n\nЗ *Преміумом* — безліміт + глибина PhD ⭐\n/support",
    "ru": "📊 Сегодняшний инсайт уже был отправлен.\n\nС *Премиумом* — безлимит + глубина PhD ⭐\n/support",
    "en": "📊 Today's insight was already sent.\n\nWith *Premium* — unlimited reports + PhD depth ⭐\n/support",
}


def detect_language_from_text(text: str) -> str | None:
    """Try to detect language from an explicit language choice message"""
    t = text.strip().lower()
    for lang, triggers in LANG_TRIGGERS.items():
        if t in triggers:
            return lang
    return None


def guess_language_from_text(text: str) -> str:
    """Guess language from natural text content"""
    # Simple heuristic: check for Ukrainian-specific letters
    ua_chars = set("іїєґ")
    ru_chars = set("ыъэё")
    text_lower = text.lower()
    if any(c in text_lower for c in ua_chars):
        return "uk"
    if any(c in text_lower for c in ru_chars):
        return "ru"
    # Check if it's mostly latin
    latin = sum(1 for c in text_lower if c.isalpha() and ord(c) < 128)
    cyrillic = sum(1 for c in text_lower if '\u0400' <= c <= '\u04FF')
    if latin > cyrillic:
        return "en"
    if cyrillic > 0:
        return "uk"  # Default to Ukrainian for Cyrillic without markers
    return "uk"


def is_short_answer(text: str) -> bool:
    words = text.strip().split()
    evasive = any(phrase in text.lower() for phrase in [
        "не знаю", "незнаю", "може", "може бути", "не впевнений", "не уверен",
        "не знаю", "наверное", "may be", "maybe", "i don't know", "dunno",
        "не хочу", "пропустити", "пропустить", "skip"
    ])
    return len(words) <= SHORT_ANSWER_WORDS or evasive


def build_resistant_injection(count: int, lang: str) -> str:
    instructions = {
        1: {
            "uk": "\n[СИСТЕМНА ПІДКАЗКА]: Коротка відповідь. Нормалізуй і м'яко зміни тему на легшу. Задай дуже конкретне просте питання.\n",
            "ru": "\n[СИСТЕМНАЯ ПОДСКАЗКА]: Короткий ответ. Нормализуй и мягко смени тему на более лёгкую. Задай очень конкретный простой вопрос.\n",
            "en": "\n[SYSTEM NOTE]: Short answer. Normalize and gently shift to an easier topic. Ask a very specific simple question.\n",
        },
        2: {
            "uk": "\n[СИСТЕМНА ПІДКАЗКА]: Знову коротка відповідь. Дай вибір із 2-3 варіантів замість відкритого питання.\n",
            "ru": "\n[СИСТЕМНАЯ ПОДСКАЗКА]: Снова короткий ответ. Дай выбор из 2-3 вариантов вместо открытого вопроса.\n",
            "en": "\n[SYSTEM NOTE]: Short answer again. Give 2-3 options instead of an open question.\n",
        },
        3: {
            "uk": "\n[СИСТЕМНА ПІДКАЗКА]: Кілька коротких відповідей. Скажи, що спробуєш здогадатися на основі вже сказаного, і запропонуй підтвердити або поправити.\n",
            "ru": "\n[СИСТЕМНАЯ ПОДСКАЗКА]: Несколько коротких ответов. Скажи, что попробуешь угадать на основе сказанного, и предложи подтвердить или поправить.\n",
            "en": "\n[SYSTEM NOTE]: Multiple short answers. Say you'll try to guess based on what's been shared and ask them to confirm or correct.\n",
        },
    }
    tier = min(count, 3)
    return instructions[tier].get(lang, instructions[tier]["uk"])


def extract_profile_from_response(text: str) -> tuple[str, dict | None]:
    if "ONBOARDING_COMPLETE" not in text:
        return text, None
    parts = text.split("ONBOARDING_COMPLETE", 1)
    visible_text = parts[0].strip()
    profile = None
    if len(parts) > 1:
        json_match = re.search(r'\{.*\}', parts[1], re.DOTALL)
        if json_match:
            try:
                profile = json.loads(json_match.group())
            except json.JSONDecodeError as e:
                logger.error(f"Profile JSON parse error: {e}")
    return visible_text, profile


# ─── Handlers ────────────────────────────────────────────────────────────────

@router.message(Command("start"))
async def cmd_start(message: Message, db: Database):
    user_id = message.from_user.id
    username = message.from_user.username

    await db.ensure_user(user_id, username)
    await db.reset_user(user_id)

    # Show language selection first
    await message.answer(
        LANG_SELECT_MSG["uk"],
        parse_mode="Markdown"
    )


@router.message(F.text & ~F.text.startswith("/"))
async def handle_message(message: Message, db: Database):
    user_id = message.from_user.id
    user_text = message.text.strip()

    await db.ensure_user(user_id, message.from_user.username)

    # Check if onboarding is done
    profile = await db.get_profile(user_id)
    if profile and profile.get("onboarding_complete"):
        lang = profile.get("language", "uk")
        await message.answer(
            POST_ONBOARDING_MSG.get(lang, POST_ONBOARDING_MSG["uk"]),
            reply_markup=main_keyboard()
        )
        return

    # ── Language detection phase ──────────────────────────────────────────
    history = await db.get_conversation(user_id)
    step = await db.get_onboarding_step(user_id)

    # On first message, detect or ask language
    if step == 0:
        explicit_lang = detect_language_from_text(user_text)
        if explicit_lang:
            lang = explicit_lang
        else:
            lang = guess_language_from_text(user_text)

        # Save detected language to conversation meta
        await db.save_language(user_id, lang)
        await db.increment_onboarding_step(user_id)

        # Send welcome in detected language
        await message.answer(
            WELCOME_MESSAGES.get(lang, WELCOME_MESSAGES["uk"]),
            parse_mode="Markdown"
        )
        return

    # ── Get stored language ────────────────────────────────────────────────
    lang = await db.get_language(user_id) or "uk"

    # Check if user is changing language mid-conversation
    explicit_lang = detect_language_from_text(user_text)
    if explicit_lang and explicit_lang != lang:
        await db.save_language(user_id, explicit_lang)
        lang = explicit_lang

    # ── Resistant user detection ───────────────────────────────────────────
    if is_short_answer(user_text):
        await db.increment_resistant(user_id)
    else:
        await db.reset_resistant(user_id)

    resistant_count = await db.get_resistant_count(user_id)

    # ── Build history with optional resistant injection ────────────────────
    injection = ""
    if resistant_count >= 1:
        injection = build_resistant_injection(resistant_count, lang)

    history.append({"role": "user", "content": user_text + injection})
        # Перетворюємо історію повідомлень у формат, який розуміє Gemini
history_text = "\n".join([f"{m['role']}: {m['content']}" for m in history])
        full_prompt = f"{ONBOARDING_SYSTEM_PROMPT}\n\nІсторія діалогу:\n{history_text}"

        # Запит до Gemini
        response = await model.generate_content_async(full_prompt)
        assistant_text = response.text


        visible_text, profile_data = extract_profile_from_response(assistant_text)

        if profile_data:
            # Ensure language is saved in profile
            profile_data["onboarding_complete"] = True
            profile_data["language"] = lang
            await db.save_profile(user_id, profile_data)

            # Save clean history
            clean_history = []
            for h in history[:-1]:
                clean_history.append(h)
            clean_history.append({"role": "user", "content": user_text})
            clean_history.append({"role": "assistant", "content": visible_text})
            await db.save_conversation(user_id, clean_history)

            name = profile_data.get("name", "")

            completion_texts = {
                "uk": (
                    f"{'✨ ' + name + ', ось' if name else '✨ Ось'} що я тепер про тебе знаю — і це справді рідкісне поєднання.\n\n"
                    f"{visible_text}\n\n"
                    f"Доступні функції:\n"
                    f"• /daily — персональний інсайт-звіт\n"
                    f"• /habit — AI-трекер звичок\n"
                    f"• /focus — режим фокусу\n"
                    f"• /techniques — бібліотека технік\n"
                    f"• /challenge — персональний виклик\n"
                    f"• /stats — твій прогрес\n\n"
                    f"*Хочеш отримати перший звіт прямо зараз — чи налаштуємо зручний час щоденної розсилки?*"
                ),
                "ru": (
                    f"{'✨ ' + name + ', вот' if name else '✨ Вот'} что я теперь о тебе знаю — и это редкое сочетание.\n\n"
                    f"{visible_text}\n\n"
                    f"Доступные функции:\n"
                    f"• /daily — персональный инсайт-отчёт\n"
                    f"• /habit — AI-трекер привычек\n"
                    f"• /focus — режим фокуса\n"
                    f"• /techniques — библиотека техник\n"
                    f"• /challenge — персональный вызов\n"
                    f"• /stats — твой прогресс\n\n"
                    f"*Хочешь получить первый отчёт прямо сейчас — или настроим удобное время ежедневной рассылки?*"
                ),
                "en": (
                    f"{'✨ ' + name + ', here' if name else '✨ Here'}'s what I now know about you — and it's a truly rare combination.\n\n"
                    f"{visible_text}\n\n"
                    f"Available features:\n"
                    f"• /daily — personal insight report\n"
                    f"• /habit — AI habit tracker\n"
                    f"• /focus — focus mode\n"
                    f"• /techniques — techniques library\n"
                    f"• /challenge — personal challenge\n"
                    f"• /stats — your progress\n\n"
                    f"*Want your first report right now — or shall we set a daily delivery time?*"
                ),
            }

            from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
            now_btns = {"uk": "📊 Отримати зараз", "ru": "📊 Получить сейчас", "en": "📊 Get it now"}
            time_btns = {"uk": "⏰ Налаштувати час", "ru": "⏰ Настроить время", "en": "⏰ Set a time"}
            onboarding_done_kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text=now_btns.get(lang, now_btns["uk"]), callback_data="daily"),
                InlineKeyboardButton(text=time_btns.get(lang, time_btns["uk"]), callback_data="settings"),
            ]])

            await message.answer(
                completion_texts.get(lang, completion_texts["uk"]),
                parse_mode="Markdown",
                reply_markup=onboarding_done_kb
            )
        else:
            # Normal onboarding step
            clean_history = [h for h in history[:-1]]
            clean_history.append({"role": "user", "content": user_text})
            clean_history.append({"role": "assistant", "content": assistant_text})
            await db.save_conversation(user_id, clean_history)
            await db.increment_onboarding_step(user_id)
            await message.answer(assistant_text, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Claude API error: {e}")
        err_msgs = {
            "uk": "Щось пішло не так — спробуй ще раз. Або /start щоб почати заново.",
            "ru": "Что-то пошло не так — попробуй ещё раз. Или /start чтобы начать заново.",
            "en": "Something went wrong — try again. Or /start to restart.",
        }
        await message.answer(err_msgs.get(lang, err_msgs["uk"]))
