/**
 * Тип офіційного пояснення до статті Розкладу хвороб (Додаток 2 до Наказу №402).
 */
export type ArticleExplanation = {
  article: string;
  status: "official" | "absent";
  anchor: string | null;
  paragraphs: string[];
};
