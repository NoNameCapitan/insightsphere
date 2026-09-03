/**
 * Індикатор редакції нормативної бази.
 *
 * EDITION_NOTICE — зарезервоване місце під майбутнє сповіщення про нову
 * редакцію Наказу №402. Поки що воно порожнє: застосунок не перевіряє джерело
 * автоматично і не має права стверджувати, що база «актуальна сьогодні».
 * Щоб увімкнути сповіщення, достатньо підставити сюди об'єкт — інтерфейс
 * покаже смужку з посиланням, нічого більше змінювати не треба.
 */

import { EDITION, SOURCE_URL } from "./vlk-sample-data.ts";

export type EditionNotice = {
  /** Короткий текст: що саме змінилося. */
  message: string;
  /** Посилання на офіційне джерело нової редакції. */
  url: string;
};

export const CHECKED_EDITION = EDITION;
export const CHECKED_EDITION_URL = SOURCE_URL;

/** Поки що сповіщень немає. */
export const EDITION_NOTICE: EditionNotice | null = null;

export function editionLabel() {
  return `Оновлено: ${CHECKED_EDITION}`;
}
