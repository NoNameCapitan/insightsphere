import logging
from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

from db.database import Database
from keyboards import profile_keyboard, main_keyboard

logger = logging.getLogger(__name__)
router = Router()


def format_bar(value, max_val: int = 10) -> str:
    try:
        filled = min(int(value), max_val)
    except (TypeError, ValueError):
        filled = 5
    return "█" * filled + "░" * (max_val - filled)


# ─── Localized labels ─────────────────────────────────────────────────────────

PROFILE_LABELS = {
    "uk": {
        "title":    "👤 *Профіль InsightSphere — {name}*",
        "sphere":   "📌 Сфера: {val}",
        "interests":"🎯 Інтереси: {val}",
        "psy_title":"🧠 *Психологічний профіль*",
        "mindset":  "Mindset: {val}",
        "sdt":      "Базова потреба: {val}",
        "stage":    "Стадія змін: {val}",
        "depth":    "Глибина контенту: {val}",
        "learning": "Стиль навчання: {val}",
        "ambition": "Рівень амбіцій: {bar} {num}/10",
        "awareness":"Самоусвідомлення: {val}",
        "ocean":    "📊 *Big Five (OCEAN)*",
        "values":   "💎 *Цінності:* {val}",
        "barriers": "⚡ *Бар'єри:* {val}",
        "patterns": "🔍 *Когнітивні патерни:* {val}",
        "insight_title": "💡 *Ключовий інсайт про тебе:*",
        "mindset_vals": {"growth": "🚀 Growth", "fixed": "🔒 Fixed", "mixed": "⚖️ Mixed"},
        "sdt_vals": {"autonomy": "🎯 Автономія", "competence": "💡 Компетентність", "relatedness": "🤝 Зв'язок"},
        "stage_vals": {
            "precontemplation": "Не думаю про зміни",
            "contemplation":    "Думаю, але не дію",
            "preparation":      "Готуюся",
            "action":           "Вже роблю",
            "maintenance":      "Підтримую результат",
        },
        "depth_vals": {"surface": "Поверхневий", "medium": "Середній", "deep": "Глибокий", "phd": "PhD-рівень"},
        "ocean_labels": {"O": "Відкритість", "C": "Сумлінність", "E": "Екстраверсія", "A": "Привітність", "N": "Невротизм"},
        "not_found": "Профіль не знайдено. Пройди онбординг: /start",
    },
    "ru": {
        "title":    "👤 *Профиль InsightSphere — {name}*",
        "sphere":   "📌 Сфера: {val}",
        "interests":"🎯 Интересы: {val}",
        "psy_title":"🧠 *Психологический профиль*",
        "mindset":  "Mindset: {val}",
        "sdt":      "Базовая потребность: {val}",
        "stage":    "Стадия изменений: {val}",
        "depth":    "Глубина контента: {val}",
        "learning": "Стиль обучения: {val}",
        "ambition": "Уровень амбиций: {bar} {num}/10",
        "awareness":"Самоосознание: {val}",
        "ocean":    "📊 *Big Five (OCEAN)*",
        "values":   "💎 *Ценности:* {val}",
        "barriers": "⚡ *Барьеры:* {val}",
        "patterns": "🔍 *Когнитивные паттерны:* {val}",
        "insight_title": "💡 *Ключевой инсайт о тебе:*",
        "mindset_vals": {"growth": "🚀 Growth", "fixed": "🔒 Fixed", "mixed": "⚖️ Mixed"},
        "sdt_vals": {"autonomy": "🎯 Автономия", "competence": "💡 Компетентность", "relatedness": "🤝 Связь"},
        "stage_vals": {
            "precontemplation": "Не думаю об изменениях",
            "contemplation":    "Думаю, но не действую",
            "preparation":      "Готовлюсь",
            "action":           "Уже делаю",
            "maintenance":      "Поддерживаю результат",
        },
        "depth_vals": {"surface": "Поверхностный", "medium": "Средний", "deep": "Глубокий", "phd": "PhD-уровень"},
        "ocean_labels": {"O": "Открытость", "C": "Добросовестность", "E": "Экстраверсия", "A": "Доброжелательность", "N": "Нейротизм"},
        "not_found": "Профиль не найден. Пройди онбординг: /start",
    },
    "en": {
        "title":    "👤 *InsightSphere Profile — {name}*",
        "sphere":   "📌 Sphere: {val}",
        "interests":"🎯 Interests: {val}",
        "psy_title":"🧠 *Psychological Profile*",
        "mindset":  "Mindset: {val}",
        "sdt":      "Core need: {val}",
        "stage":    "Change stage: {val}",
        "depth":    "Content depth: {val}",
        "learning": "Learning style: {val}",
        "ambition": "Ambition level: {bar} {num}/10",
        "awareness":"Self-awareness: {val}",
        "ocean":    "📊 *Big Five (OCEAN)*",
        "values":   "💎 *Values:* {val}",
        "barriers": "⚡ *Barriers:* {val}",
        "patterns": "🔍 *Cognitive patterns:* {val}",
        "insight_title": "💡 *Key insight about you:*",
        "mindset_vals": {"growth": "🚀 Growth", "fixed": "🔒 Fixed", "mixed": "⚖️ Mixed"},
        "sdt_vals": {"autonomy": "🎯 Autonomy", "competence": "💡 Competence", "relatedness": "🤝 Relatedness"},
        "stage_vals": {
            "precontemplation": "Not thinking about change",
            "contemplation":    "Thinking but not acting",
            "preparation":      "Preparing",
            "action":           "Taking action",
            "maintenance":      "Maintaining results",
        },
        "depth_vals": {"surface": "Surface", "medium": "Medium", "deep": "Deep", "phd": "PhD level"},
        "ocean_labels": {"O": "Openness", "C": "Conscientiousness", "E": "Extraversion", "A": "Agreeableness", "N": "Neuroticism"},
        "not_found": "Profile not found. Complete onboarding: /start",
    },
}


def format_profile(profile: dict, lang: str = None) -> str:
    if lang is None:
        lang = profile.get("language", "uk")
    L = PROFILE_LABELS.get(lang, PROFILE_LABELS["uk"])

    name      = profile.get("name", "—")
    sphere    = profile.get("sphere", "—")
    interests = profile.get("interests", [])
    values    = profile.get("values", [])
    fears     = profile.get("fears", [])
    biases    = profile.get("cognitive_biases", [])
    big_five  = profile.get("big_five", {})
    mindset   = profile.get("mindset", "—")
    sdt       = profile.get("sdt_dominant", "—")
    stage     = profile.get("prochaska_stage", "—")
    depth     = profile.get("preferred_depth", "—")
    learning  = profile.get("learning_style", "—")
    ambition  = profile.get("ambition_level", 5)
    awareness = profile.get("awareness_level", "—")
    key_insight = profile.get("key_insight", "—")

    def to_str(v): return ", ".join(v) if isinstance(v, list) else str(v or "—")

    lines = [
        L["title"].format(name=name),
        "━━━━━━━━━━━━━━━━━━━━━",
        L["sphere"].format(val=sphere),
        L["interests"].format(val=to_str(interests)),
        "",
        L["psy_title"],
        L["mindset"].format(val=L["mindset_vals"].get(mindset, mindset)),
        L["sdt"].format(val=L["sdt_vals"].get(sdt, sdt)),
        L["stage"].format(val=L["stage_vals"].get(stage, stage)),
        L["depth"].format(val=L["depth_vals"].get(depth, depth)),
        L["learning"].format(val=learning),
        L["ambition"].format(bar=format_bar(ambition), num=ambition),
        L["awareness"].format(val=awareness),
        "",
    ]

    if big_five:
        lines.append(L["ocean"])
        for k, label in L["ocean_labels"].items():
            val = big_five.get(k, 5)
            lines.append(f"{label}: {format_bar(val)} {val}/10")
        lines.append("")

    lines += [
        L["values"].format(val=to_str(values)),
        L["barriers"].format(val=to_str(fears)),
    ]
    biases_str = to_str(biases)
    if biases_str and biases_str != "—":
        lines.append(L["patterns"].format(val=biases_str))

    lines += [
        "",
        "━━━━━━━━━━━━━━━━━━━━━",
        L["insight_title"],
        f"_{key_insight}_",
    ]
    return "\n".join(lines)


# ─── Command handler ──────────────────────────────────────────────────────────

@router.message(Command("profile"))
async def cmd_profile(message: Message, db: Database):
    user_id = message.from_user.id
    lang = await db.get_language(user_id)
    profile = await db.get_profile(user_id)

    if not profile or not profile.get("onboarding_complete"):
        await message.answer(PROFILE_LABELS.get(lang, PROFILE_LABELS["uk"])["not_found"])
        return

    is_prem = await db.is_premium(user_id)
    text = format_profile(profile, lang)
    if is_prem:
        prem_badge = {"uk": "\n\n⭐ *Статус: Преміум*", "ru": "\n\n⭐ *Статус: Премиум*", "en": "\n\n⭐ *Status: Premium*"}
        text += prem_badge.get(lang, prem_badge["uk"])

    await message.answer(text, parse_mode="Markdown", reply_markup=profile_keyboard(lang))
