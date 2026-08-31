/**
 * Офіційні пояснення до статей Розкладу хвороб (Додаток 2 до Наказу МОУ №402).
 *
 * Дослівний текст зберігається постатейно в lib/explanations/article-*.ts і
 * підвантажується лише для вибраної статті, тому початковий клієнтський бандл
 * не містить усього масиву пояснень. Тексти не скорочено й не переказано.
 */
import { EXPLANATION_LOADERS, EXPLANATION_META, type ExplanationMeta } from "./explanations/index.ts";
import type { ArticleExplanation } from "./explanations/types.ts";

export type { ArticleExplanation, ExplanationMeta };
export { EXPLANATION_META };

export const EXPLANATION_EDITION = "22.08.2025";
export const EXPLANATION_SOURCE_URL = "https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822#Text";

/** Контрольна сума дослівного масиву пояснень станом на редакцію 22.08.2025. */
export const EXPLANATION_DIGEST = "245ae5d143a50b2d3ebfb29851e454ae38038f582a96a3c6a4d91af0b3bfdb16";

export const EXPLANATION_ARTICLES = Object.keys(EXPLANATION_META);

const CACHE = new Map<string, ArticleExplanation>();
const PENDING = new Map<string, Promise<ArticleExplanation | undefined>>();

/** Уже завантажене пояснення, якщо воно є в пам'яті цієї вкладки. */
export function getLoadedExplanation(article: string): ArticleExplanation | undefined {
  return CACHE.get(article);
}

/** Завантажує дослівне пояснення однієї статті. Повторні виклики беруть кеш. */
export function loadArticleExplanation(article: string): Promise<ArticleExplanation | undefined> {
  const cached = CACHE.get(article);
  if (cached) return Promise.resolve(cached);

  const pending = PENDING.get(article);
  if (pending) return pending;

  const loader = EXPLANATION_LOADERS[article];
  if (!loader) return Promise.resolve(undefined);

  const request = loader()
    .then((module) => {
      CACHE.set(article, module.EXPLANATION);
      PENDING.delete(article);
      return module.EXPLANATION;
    })
    .catch((error: unknown) => {
      PENDING.delete(article);
      throw error;
    });

  PENDING.set(article, request);
  return request;
}

/**
 * Прогріває решту пояснень у фоні, щоб після першого відкриття застосунок
 * працював офлайн на будь-якій статті. Порядок і темп задає викликач.
 */
export async function warmExplanations(articles: readonly string[] = EXPLANATION_ARTICLES) {
  for (const article of articles) {
    if (CACHE.has(article)) continue;
    try {
      await loadArticleExplanation(article);
    } catch {
      // Прогрів необов'язковий: стаття завантажиться під час відкриття.
    }
  }
}
