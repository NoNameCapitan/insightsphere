// Share helpers for the viral/community layer.
import { safeUrl } from "@/lib/security/url";

export interface ShareTargets {
  telegram?: string;
  viber?: string;
  facebook?: string;
}

/** Build share deep-links for a given text + URL. All validated as safe. */
export function buildShareLinks(text: string, url: string): ShareTargets {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return {
    telegram: safeUrl(`https://t.me/share/url?url=${u}&text=${t}`),
    viber: safeUrl(`viber://forward?text=${encodeURIComponent(`${text} ${url}`)}`)
      // viber:// is not in the safe allowlist; fall back to a tel-free https share
      ?? safeUrl(`https://t.me/share/url?url=${u}&text=${t}`),
    facebook: safeUrl(`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`),
  };
}

export function petShareText(name: string, animal: string): string {
  return `Знайомтесь, це ${name} 🐾 (${animal}). Профіль у VetNear.`;
}

export function lostFoundShareText(
  mode: "lost" | "found",
  name: string,
  district: string,
): string {
  return mode === "lost"
    ? `❗ Загубився улюбленець: ${name}. Останнє місце: ${district} (Київ). Будь ласка, поширте! VetNear`
    : `🟢 Знайдено тварину біля ${district} (Київ). Шукаємо власника. Поширте, будь ласка! VetNear`;
}
