// Deterministic lead scoring. No AI required.
// Total = Fit(0-30) + Pain(0-35) + Reachability(0-20) + Timing(0-15) => 0..100.
// Every contribution is explainable and never fakes certainty.

import { NICHES } from "./places";
import type {
  LeadScore,
  LeadSignal,
  OfferType,
  RawBusiness,
  ScoreLabel,
  SignalType,
} from "./types";
import { clamp } from "./utils";

const UNVERIFIED = "Не перевірено — потрібна ручна перевірка.";

function offerMakesSense(
  offer: OfferType,
  niche: RawBusiness["niche"],
): boolean {
  const meta = NICHES[niche];
  switch (offer) {
    case "booking":
    case "chatbot":
      return meta.appointmentBased;
    case "smm":
      return ["beauty", "cafe", "fitness", "restaurant"].includes(niche);
    case "reputation":
      return true;
    default:
      return true; // website, landing, seo, crm, automation, custom
  }
}

export function labelFor(total: number): ScoreLabel {
  if (total >= 80) return "hot";
  if (total >= 60) return "warm";
  if (total >= 40) return "cold";
  return "bad_fit";
}

export function scoreBusiness(
  b: RawBusiness,
  offer: OfferType,
): { score: LeadScore; signals: LeadSignal[] } {
  const meta = NICHES[b.niche];
  const hasWebsite = !!b.website;
  const hasPhone = !!b.phone;
  const reviews = b.reviewCount ?? 0;
  const rating = b.rating;
  const active = b.businessStatus === "OPERATIONAL";
  const wa = b.websiteAnalysis;
  const waChecked = !!wa?.checked;
  const siteReachable = hasWebsite && waChecked ? wa!.reachable : hasWebsite;
  const signals: LeadSignal[] = [];
  const add = (
    type: SignalType,
    label: string,
    severity: LeadSignal["severity"],
    evidence: string,
  ) => signals.push({ type, label, severity, evidence });

  let needsReview = !b.businessStatus;

  // ---------- FIT (0-30) ----------
  let fit = 0;
  fit += b.niche !== "generic" ? 12 : 6;
  fit += 6; // returned within selected location / radius
  if (active) {
    fit += 4;
    add(
      "active_business",
      "Активний бізнес",
      "low",
      "Профіль позначений як працюючий.",
    );
  }
  const enoughReviews = reviews >= Math.round(meta.expectedMinReviews * 0.5);
  if (enoughReviews) fit += 4;
  const offerFits = offerMakesSense(offer, b.niche);
  if (offerFits) fit += 4;
  fit = clamp(fit, 0, 30);

  // ---------- PAIN (0-35) ----------
  let pain = 0;
  if (!hasWebsite) {
    pain += 14;
    add(
      "missing_website",
      "Сайт не вказаний",
      "high",
      "У профілі Google не вказано вебсайт.",
    );
    if (hasPhone) {
      pain += 4;
      add(
        "has_phone",
        "Тільки телефон",
        "medium",
        "У профілі є телефон, але не вказано сайт. Інші канали та втрату заявок не перевірено.",
      );
    }
  } else if (waChecked) {
    // The site was actually fetched — use real findings.
    if (!wa!.reachable) {
      pain += 9;
      add(
        "website_unreachable",
        "Сайт недоступний",
        "high",
        `Сайт вказано (${b.website}), але він не відкривається${
          wa!.note ? ` (${wa!.note})` : ""
        }. Можливе блокування автоматичної перевірки; перевірте вручну.`,
      );
    } else {
      if (!wa!.https) {
        pain += 4;
        add(
          "website_no_https",
          "Сайт без HTTPS",
          "medium",
          "Сайт працює без HTTPS — це знижує довіру користувачів і позиції в Google.",
        );
      }
      if (wa!.hasSocialLinks) {
        add(
          "website_has_social_links",
          "Є соцмережі на сайті",
          "low",
          "На сайті знайдено посилання на соцмережі.",
        );
      }
      if (offer === "website" || offer === "landing" || offer === "seo") {
        if (!wa!.hasFormKeyword) {
          pain += 3;
          add(
            "weak_website",
            "Сайт без форми заявки",
            "medium",
            "Не виявлено форми чи кнопки заявки — ймовірно низька конверсія в звернення.",
          );
        } else {
          add(
            "weak_website",
            "Сайт є — деталі варто перевірити",
            "low",
            `Сайт існує (${b.website}); конверсію та якість варто перевірити вручну. ${UNVERIFIED}`,
          );
          needsReview = true;
        }
      }
    }
  } else if (offer === "website" || offer === "landing" || offer === "seo") {
    // Site exists but was not analyzed (no certainty).
    add(
      "weak_website",
      "Сайт є — якість невідома",
      "low",
      `Сайт існує (${b.website}), але його якість/конверсію не перевірено. ${UNVERIFIED}`,
    );
    needsReview = true;
  }

  if (meta.appointmentBased) {
    if (hasWebsite && waChecked && wa!.reachable) {
      if (wa!.hasBookingKeyword) {
        add(
          "website_has_booking",
          "На сайті є онлайн-запис",
          "low",
          "В HTML знайдено слова або посилання, пов’язані із записом. Працездатність запису не перевірено.",
        );
        pain += 1; // already solved; only residual room to improve
      } else {
        pain += 5;
        add(
          "website_no_booking_detected",
          "На сайті не видно запису",
          "medium",
          "У перевіреному HTML не виявлено ознак запису. Він може бути на іншій сторінці або завантажуватися через JavaScript.",
        );
      }
    } else {
      pain += 6;
      add(
        "no_online_booking_detected",
        "Не видно онлайн-запису",
        "medium",
        `Бізнес працює за записом, але онлайн-запис не виявлено. ${UNVERIFIED}`,
      );
      needsReview = true;
    }
  }

  if (rating != null && reviews >= 10) {
    if (rating < 4.0) {
      pain += 6;
      add(
        "weak_rating",
        `Слабкий рейтинг ${rating.toFixed(1)}`,
        rating < 3.7 ? "high" : "medium",
        `Рейтинг ${rating.toFixed(1)} при ${reviews} відгуках — є над чим працювати.`,
      );
    } else if (rating <= 4.3) {
      pain += 4;
      add(
        "reputation_gap",
        `Репутаційний розрив ${rating.toFixed(1)}`,
        "medium",
        `Рейтинг ${rating.toFixed(1)} — нижче відмінного; варто перевірити зміст відгуків та можливості покращення сервісу.`,
      );
    }
  }

  if (meta.competitive && reviews < Math.round(meta.expectedMinReviews * 0.4)) {
    pain += 5;
    add(
      "low_review_count",
      `Мало відгуків (${reviews})`,
      "medium",
      `У конкурентній ніші ${reviews} відгуків замало для видимості.`,
    );
  }

  if (rating != null && reviews >= meta.expectedMinReviews && rating < 4.3) {
    pain += 4;
    add(
      "many_reviews",
      "Багато відгуків, але рейтинг слабкий",
      "medium",
      `${reviews} відгуків і рейтинг ${rating.toFixed(1)} — можливий привід перевірити роботу з відгуками; даних про трафік немає.`,
    );
  }
  pain = clamp(pain, 0, 35);

  // ---------- REACHABILITY (0-20) ----------
  let reach = 0;
  if (hasPhone) {
    reach += 8;
    if (!signals.some((s) => s.type === "has_phone")) {
      add(
        "has_phone",
        "Є телефон",
        "low",
        "Вказано номер телефону для контакту.",
      );
    }
  }
  if (siteReachable) reach += 5;
  if (wa?.checked && wa.reachable && wa.hasSocialLinks) reach += 2;
  if (b.googleMapsUrl) reach += 3;
  if (b.openingHours && b.openingHours.length > 0) reach += 2;
  if (active || b.isOpenNow) reach += 2;
  reach = clamp(reach, 0, 20);

  // ---------- TIMING (0-15) ----------
  let timing = 0;
  if (active) timing += 3;
  if (enoughReviews) timing += 3;
  if (rating != null && rating < 4.3) timing += 3;
  if (!hasWebsite || meta.appointmentBased) timing += 3;
  if (meta.highValue) timing += 3;
  timing = clamp(timing, 0, 15);

  // ---------- Offer-specific fit signal + small nudge ----------
  applyOfferSignal(offer, b, signals, () => {});
  if (offer === "chatbot" && meta.appointmentBased) {
    pain = clamp(pain + 3, 0, 35);
  }

  // Positive signal (kept honest, doesn't reduce score artificially)
  if (rating != null && rating >= 4.6 && reviews >= 15) {
    add(
      "strong_rating",
      `Сильний рейтинг ${rating.toFixed(1)}`,
      "low",
      `${reviews} відгуків і рейтинг ${rating.toFixed(1)} — сильна репутація.`,
    );
  }

  if (hasWebsite && !waChecked) {
    add(
      "website_needs_manual_review",
      "Сайт не перевірено автоматично",
      "low",
      `Сайт ${b.website} не аналізувався автоматично — перевірте вручну.`,
    );
  }

  if (needsReview) {
    add(
      "needs_manual_review",
      "Потрібна ручна перевірка",
      "low",
      "Частину сигналів не підтверджено автоматично — перевірте перед контактом.",
    );
  }

  const total = clamp(fit + pain + reach + timing, 0, 100);
  const label = labelFor(total);

  const explanation = buildExplanation(label, signals, b, total);
  const opportunityReason = buildOpportunityReason(
    label,
    signals,
    b,
    offer,
    total,
  );

  return {
    score: {
      fit,
      pain,
      reachability: reach,
      timing,
      total,
      label,
      explanation,
      opportunityReason,
    },
    signals,
  };
}

const OFFER_FIT_UK: Record<OfferType, string> = {
  website: "простий сайт/лендинг для збору заявок",
  landing: "лендинг під ключову послугу",
  seo: "локальне SEO та Google Business Profile",
  chatbot: "AI-асистента для типових питань і заявок 24/7",
  booking: "онлайн-запис замість втрачених дзвінків",
  crm: "просту CRM для обліку звернень",
  smm: "ведення соцмереж і контент",
  reputation: "системну роботу з відгуками",
  automation: "автоматизацію обробки заявок",
  custom: "рішення під конкретну задачу",
};

function buildOpportunityReason(
  label: ScoreLabel,
  signals: LeadSignal[],
  b: RawBusiness,
  offer: OfferType,
  total: number,
): string {
  const has = (t: SignalType) => signals.some((s) => s.type === t);
  const head: Record<ScoreLabel, string> = {
    hot: "Гарячий лід",
    warm: "Теплий лід",
    cold: "Холодний лід",
    bad_fit: "Слабкий збіг",
  };

  // Positives (what makes them a real, contactable business).
  const positives: string[] = [];
  if (b.businessStatus === "OPERATIONAL") positives.push("бізнес активний");
  if (b.phone) positives.push("має телефон");
  if ((b.reviewCount ?? 0) > 0)
    positives.push(
      `${b.reviewCount} відгук${plural(b.reviewCount ?? 0)}${
        b.rating != null ? ` (рейтинг ${b.rating.toFixed(1)})` : ""
      }`,
    );

  // The single most important detected problem.
  let problem = "явних проблем небагато — варто перевірити вручну";
  if (has("missing_website"))
    problem = "у профілі не вказано сайт; його наявність слід уточнити";
  else if (has("website_unreachable"))
    problem = "сайт вказано, але він не відкривається";
  else if (
    has("website_no_booking_detected") ||
    has("no_online_booking_detected")
  )
    problem = "онлайн-запис не підтверджено — потрібна ручна перевірка";
  else if (has("website_no_https")) problem = "сайт працює без HTTPS";
  else if (has("weak_website"))
    problem =
      "у перевіреному HTML не знайдено частину елементів заявки; конверсія невідома";
  else if (has("weak_rating") || has("many_reviews"))
    problem = "репутація нижча за потенціал ніші";
  else if (has("low_review_count"))
    problem = "мала видимість і небагато відгуків";

  const posText = positives.length ? positives.join(", ") : "профіль існує";
  const offerText = OFFER_FIT_UK[offer] ?? OFFER_FIT_UK.custom;

  // What to verify manually (honesty).
  const verifyParts: string[] = [];
  if (has("needs_manual_review") || has("website_needs_manual_review"))
    verifyParts.push("якість сайту/наявність запису");
  if (b.rating == null) verifyParts.push("рейтинг і відгуки");
  const verify =
    verifyParts.length > 0
      ? ` Перед контактом перевірте: ${verifyParts.join(", ")}.`
      : "";

  return `${head[label]} (${total}/100): ${posText}, але ${problem}. Можлива пропозиція: ${offerText}.${verify}`;
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "и";
  return "ів";
}

function applyOfferSignal(
  offer: OfferType,
  b: RawBusiness,
  signals: LeadSignal[],
  _bump: () => void,
) {
  const meta = NICHES[b.niche];
  const has = (t: SignalType) => signals.some((s) => s.type === t);
  switch (offer) {
    case "website":
    case "landing":
      if (!b.website && !has("good_fit_for_website")) {
        signals.push({
          type: "good_fit_for_website",
          label: "Кандидат на сайт/лендинг",
          severity: "high",
          evidence:
            "У профілі не вказано сайт — уточніть, чи потрібна бізнесу окрема сторінка.",
        });
      }
      break;
    case "seo":
      if (
        (!b.website || (b.reviewCount ?? 0) < meta.expectedMinReviews) &&
        !has("good_fit_for_seo")
      ) {
        signals.push({
          type: "good_fit_for_seo",
          label: "Кандидат на SEO / Google Business",
          severity: "medium",
          evidence:
            "Мало відгуків або не вказано сайт. Пошукові позиції не вимірювалися.",
        });
      }
      break;
    case "chatbot":
      if (meta.appointmentBased && !has("good_fit_for_chatbot")) {
        signals.push({
          type: "good_fit_for_chatbot",
          label: "Кандидат на AI-асистента",
          severity: "high",
          evidence:
            "Ніша часто працює за записом. Наявність типових запитань і потребу в боті слід уточнити.",
        });
      }
      break;
    case "reputation":
      if (
        b.rating != null &&
        b.rating >= 3.5 &&
        b.rating <= 4.3 &&
        (b.reviewCount ?? 0) >= 10 &&
        !has("good_fit_for_reputation_management")
      ) {
        signals.push({
          type: "good_fit_for_reputation_management",
          label: "Кандидат на роботу з репутацією",
          severity: "high",
          evidence: `Рейтинг ${b.rating.toFixed(1)} при достатній кількості відгуків — є потенціал росту.`,
        });
      }
      break;
    default:
      break;
  }
}

function buildExplanation(
  label: ScoreLabel,
  signals: LeadSignal[],
  b: RawBusiness,
  total: number,
): string {
  const top = signals
    .filter((s) => s.severity !== "low")
    .slice(0, 2)
    .map((s) => s.label.toLowerCase());
  const headByLabel: Record<ScoreLabel, string> = {
    hot: "Гарячий лід",
    warm: "Теплий лід",
    cold: "Холодний лід",
    bad_fit: "Слабкий збіг",
  };
  const reason =
    top.length > 0
      ? `Основне: ${top.join(", ")}.`
      : "Явних сигналів болю небагато — перевірте вручну.";
  const ratingNote = b.rating == null ? "Рейтинг не надано джерелом." : "";
  return `${headByLabel[label]} (${total}/100). ${reason} ${ratingNote}`.trim();
}
