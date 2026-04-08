import json
import logging
import os
from anthropic import AsyncAnthropic
from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery,
    LabeledPrice, PreCheckoutQuery,
    SuccessfulPayment,
)
from aiogram.filters import Command

from db.database import Database
from keyboards import support_keyboard, premium_keyboard

logger = logging.getLogger(__name__)
router = Router()

# ─── Pricing tiers ────────────────────────────────────────────────────────────

TIERS = {
    "support_small":  {"stars": 50,  "premium": False},
    "support_medium": {"stars": 150, "premium": False},
    "premium_month":  {"stars": 200, "premium": True},
    "premium_three":  {"stars": 500, "premium": True},
}

TIER_LABELS = {
    "support_small":  {"uk": "☕ Кава куратору",      "ru": "☕ Кофе куратору",      "en": "☕ Coffee for curator"},
    "support_medium": {"uk": "🍕 Піца команді",       "ru": "🍕 Пицца команде",      "en": "🍕 Pizza for team"},
    "premium_month":  {"uk": "⭐ Преміум на місяць",  "ru": "⭐ Премиум на месяц",   "en": "⭐ Premium 1 month"},
    "premium_three":  {"uk": "🚀 Преміум 3 місяці",   "ru": "🚀 Премиум 3 месяца",   "en": "🚀 Premium 3 months"},
}

SUPPORT_TEXTS = {
    "uk": (
        "💛 *Підтримати InsightSphere*\n\n"
        "InsightSphere — повністю безкоштовний бот.\n"
        "Жодних обов'язкових платежів, жодного прихованого контенту.\n\n"
        "Якщо тобі подобається те, що ти отримуєш, ти можеш підтримати проект "
        "через Telegram Stars — це допомагає оплачувати сервери та розвивати бота.\n\n"
        "В подяку за підтримку 200+ ⭐ ти отримуєш *Преміум-режим:*\n"
        "• 🔓 Звіти рівня Deep та PhD\n"
        "• ♾ Необмежені звіти на день\n"
        "• 📚 Історія 30 звітів\n"
        "• 💬 /ask — питання Куратору з персональною відповіддю\n\n"
        "{status}"
        "_Будь-яка сума — це вже величезна підтримка. Дякую!_ 🙏"
    ),
    "ru": (
        "💛 *Поддержать InsightSphere*\n\n"
        "InsightSphere — полностью бесплатный бот.\n"
        "Никаких обязательных платежей, никакого скрытого контента.\n\n"
        "Если тебе нравится то, что ты получаешь, ты можешь поддержать проект "
        "через Telegram Stars — это помогает оплачивать серверы и развивать бота.\n\n"
        "В благодарность за поддержку 200+ ⭐ ты получаешь *Премиум-режим:*\n"
        "• 🔓 Отчёты уровня Deep и PhD\n"
        "• ♾ Неограниченные отчёты в день\n"
        "• 📚 История 30 отчётов\n"
        "• 💬 /ask — вопрос Куратору с развёрнутым ответом\n\n"
        "{status}"
        "_Любая сумма — это уже огромная поддержка. Спасибо!_ 🙏"
    ),
    "en": (
        "💛 *Support InsightSphere*\n\n"
        "InsightSphere is completely free.\n"
        "No mandatory payments, no hidden content.\n\n"
        "If you enjoy what you receive, you can support the project "
        "via Telegram Stars — it helps cover servers and development.\n\n"
        "As a thank you for 200+ ⭐ you get *Premium mode:*\n"
        "• 🔓 Deep & PhD level reports\n"
        "• ♾ Unlimited reports per day\n"
        "• 📚 History of 30 reports\n"
        "• 💬 /ask — personal curator question\n\n"
        "{status}"
        "_Any amount is already a huge help. Thank you!_ 🙏"
    ),
}

PREMIUM_STATUS = {
    "uk": "⭐ У тебе вже є Преміум — дякую за підтримку!\n\n",
    "ru": "⭐ У тебя уже есть Премиум — спасибо за поддержку!\n\n",
    "en": "⭐ You already have Premium — thank you for your support!\n\n",
}

PREMIUM_ACTIVATED = {
    "uk": (
        "⭐ *Преміум активовано!*\n\n"
        "Велике дякую за підтримку — це дуже важливо для розвитку InsightSphere.\n\n"
        "Тепер тобі доступно:\n"
        "• Звіти рівня Deep та PhD\n"
        "• Необмежені звіти на день\n"
        "• Історія 30 звітів\n"
        "• /ask — персональне питання Куратору\n\n"
        "Використай /daily для першого преміум-звіту 🚀"
    ),
    "ru": (
        "⭐ *Премиум активирован!*\n\n"
        "Огромное спасибо за поддержку — это очень важно для развития InsightSphere.\n\n"
        "Теперь тебе доступны:\n"
        "• Отчёты уровня Deep и PhD\n"
        "• Неограниченные отчёты в день\n"
        "• История 30 отчётов\n"
        "• /ask — персональный вопрос Куратору\n\n"
        "Используй /daily чтобы получить первый премиум-отчёт 🚀"
    ),
    "en": (
        "⭐ *Premium activated!*\n\n"
        "Thank you so much for your support — it means a lot for InsightSphere's development.\n\n"
        "You now have access to:\n"
        "• Deep & PhD level reports\n"
        "• Unlimited reports per day\n"
        "• History of 30 reports\n"
        "• /ask — personal curator question\n\n"
        "Use /daily to get your first premium report 🚀"
    ),
}

DONATION_THANKS = {
    "uk": "💛 *Дякую за підтримку!*\n\nТи надіслав {stars} ⭐ — це реально допомагає.\nInsightSphere розвивається завдяки таким людям, як ти.\n\nЯкщо захочеш підтримати ще — /support 🙏",
    "ru": "💛 *Спасибо за поддержку!*\n\nТы отправил {stars} ⭐ — это реально помогает.\nInsightSphere развивается благодаря таким людям, как ты.\n\nЕсли захочешь поддержать ещё — /support 🙏",
    "en": "💛 *Thank you for your support!*\n\nYou sent {stars} ⭐ — it really helps.\nInsightSphere grows thanks to people like you.\n\nIf you want to support more — /support 🙏",
}

ASK_NO_PREMIUM = {
    "uk": "💬 *Питання Куратору* — це Преміум-функція.\n\nЗадай будь-яке питання і отримай розгорнуту персональну відповідь.\n\nДоступно з 200 ⭐ — /support",
    "ru": "💬 *Вопрос Куратору* — это Премиум-функция.\n\nЗадай любой вопрос и получи развёрнутый персональный ответ.\n\nДоступно с 200 ⭐ — /support",
    "en": "💬 *Ask the Curator* is a Premium feature.\n\nAsk any question and get a detailed personal answer.\n\nAvailable from 200 ⭐ — /support",
}

ASK_USAGE_HINT = {
    "uk": "💬 Напиши питання одразу після команди:\n\n`/ask Як перестати відкладати важливі справи?`",
    "ru": "💬 Напиши вопрос сразу после команды:\n\n`/ask Как перестать откладывать важные задачи?`",
    "en": "💬 Write your question right after the command:\n\n`/ask How do I stop procrastinating?`",
}

ASK_HEADER = {
    "uk": "💬 *Відповідь Куратора*\n\n",
    "ru": "💬 *Ответ Куратора*\n\n",
    "en": "💬 *Curator's Answer*\n\n",
}

ASK_ERROR = {
    "uk": "Не вдалося обробити питання. Спробуй ще раз.",
    "ru": "Не удалось обработать вопрос. Попробуй ещё раз.",
    "en": "Failed to process the question. Please try again.",
}

ASK_LANG_INSTRUCTION = {
    "uk": "Відповідай виключно українською мовою.",
    "ru": "Отвечай исключительно на русском языке.",
    "en": "Reply exclusively in English.",
}


# ─── show_support ─────────────────────────────────────────────────────────────

async def show_support(chat_id: int, user_id: int, db: Database, bot, lang: str = "uk"):
    is_prem = await db.is_premium(user_id)
    status = PREMIUM_STATUS.get(lang, PREMIUM_STATUS["uk"]) if is_prem else ""
    text = SUPPORT_TEXTS.get(lang, SUPPORT_TEXTS["uk"]).format(status=status)
    await bot.send_message(
        chat_id=chat_id, text=text,
        parse_mode="Markdown",
        reply_markup=support_keyboard(lang)
    )


# ─── /support command ─────────────────────────────────────────────────────────

@router.message(Command("support"))
async def cmd_support(message: Message, db: Database):
    lang = await db.get_language(message.from_user.id)
    await show_support(message.chat.id, message.from_user.id, db, message.bot, lang)


# ─── Buy callback ─────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(query: CallbackQuery, db: Database):
    await query.answer()
    lang = await db.get_language(query.from_user.id)
    tier_key = query.data.split("buy:", 1)[1]
    tier = TIERS.get(tier_key)
    if not tier:
        return

    stars = tier["stars"]
    label = TIER_LABELS.get(tier_key, {}).get(lang, TIER_LABELS.get(tier_key, {}).get("uk", tier_key))
    is_premium_tier = tier["premium"]

    if is_premium_tier:
        desc_map = {
            "uk": f"Преміум InsightSphere ({stars} ⭐)\nГлибокі звіти · Безліміт · Історія 30 · /ask",
            "ru": f"Премиум InsightSphere ({stars} ⭐)\nГлубокие отчёты · Безлимит · История 30 · /ask",
            "en": f"InsightSphere Premium ({stars} ⭐)\nDeep reports · Unlimited · History 30 · /ask",
        }
        description = desc_map.get(lang, desc_map["uk"])
    else:
        desc_map = {
            "uk": f"Підтримка InsightSphere — {label}",
            "ru": f"Поддержка InsightSphere — {label}",
            "en": f"Support InsightSphere — {label}",
        }
        description = desc_map.get(lang, desc_map["uk"])

    await query.message.answer_invoice(
        title=label,
        description=description,
        payload=tier_key,
        currency="XTR",
        prices=[LabeledPrice(label=label, amount=stars)],
        provider_token="",
    )


# ─── Payment processing ───────────────────────────────────────────────────────

@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def successful_payment(message: Message, db: Database):
    payment: SuccessfulPayment = message.successful_payment
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    stars = payment.total_amount
    charge_id = payment.telegram_payment_charge_id
    payload = payment.invoice_payload

    tier = TIERS.get(payload, {})
    is_premium_tier = tier.get("premium", False)

    if is_premium_tier:
        await db.set_premium(user_id, stars, charge_id, payload)
        await message.answer(
            PREMIUM_ACTIVATED.get(lang, PREMIUM_ACTIVATED["uk"]),
            parse_mode="Markdown"
        )
    else:
        await db.set_premium(user_id, stars, charge_id, payload)  # log stars
        await message.answer(
            DONATION_THANKS.get(lang, DONATION_THANKS["uk"]).format(stars=stars),
            parse_mode="Markdown"
        )


# ─── /ask command ─────────────────────────────────────────────────────────────

@router.message(Command("ask"))
async def cmd_ask(message: Message, db: Database):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    is_prem = await db.is_premium(user_id)

    if not is_prem:
        await message.answer(
            ASK_NO_PREMIUM.get(lang, ASK_NO_PREMIUM["uk"]),
            parse_mode="Markdown",
            reply_markup=premium_keyboard(lang)
        )
        return

    profile = await db.get_profile(user_id)
    if not profile:
        no_profile = {"uk": "Спочатку пройди онбординг: /start",
                      "ru": "Сначала пройди онбординг: /start",
                      "en": "Complete onboarding first: /start"}
        await message.answer(no_profile.get(lang, no_profile["uk"]))
        return

    parts = message.text.split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        await message.answer(
            ASK_USAGE_HINT.get(lang, ASK_USAGE_HINT["uk"]),
            parse_mode="Markdown"
        )
        return

    await _handle_curator_question(message, parts[1].strip(), profile, lang)


async def _handle_curator_question(message: Message, question: str, profile: dict, lang: str):
    claude = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")

    name = profile.get("name", "")
    big_five = profile.get("big_five", {})
    mindset = profile.get("mindset", "mixed")
    values = profile.get("values", [])
    fears = profile.get("fears", [])
    stage = profile.get("prochaska_stage", "contemplation")

    lang_instr = ASK_LANG_INSTRUCTION.get(lang, ASK_LANG_INSTRUCTION["uk"])

    prompt = f"""
{lang_instr}

Ти — AI-Куратор InsightSphere. Користувач {name} задає питання.

Профіль: Big Five O={big_five.get('O',5)} C={big_five.get('C',5)} E={big_five.get('E',5)} A={big_five.get('A',5)} N={big_five.get('N',5)}
Mindset: {mindset} | Стадія: {stage}
Цінності: {', '.join(values) if isinstance(values, list) else values}
Бар'єри: {', '.join(fears) if isinstance(fears, list) else fears}

Питання: {question}

Дай розгорнуту, глибоко персоналізовану відповідь:
- Врахуй Big Five, mindset, цінності, бар'єри та стадію змін
- Використай доказову психологію та нейронауку
- Дай конкретні дії, адаптовані під його тип мислення
- Звернися по імені 1-2 рази
- Стиль: найкращий коуч у світі, який знає його особисто
- Обсяг: 300-500 слів
"""

    try:
        response = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        answer = response.content[0].text
        await message.answer(
            ASK_HEADER.get(lang, ASK_HEADER["uk"]) + answer,
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"Curator question error: {e}")
        await message.answer(ASK_ERROR.get(lang, ASK_ERROR["uk"]))
