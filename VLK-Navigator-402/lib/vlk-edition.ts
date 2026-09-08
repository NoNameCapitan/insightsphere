/**
 * Індикатор редакції нормативної бази.
 *
 * EDITION_NOTICE — явне повідомлення, яке публікується лише після ручної
 * перевірки нової редакції. Окремий CI-монітор щодня порівнює дату на живій
 * сторінці Верховної Ради з датою корпусу, але ніколи не змінює дані сам.
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
export const LIVE_EDITION_SOURCE_URL = "https://zakon.rada.gov.ua/laws/show/z1109-08#Text";

/** Поки що сповіщень немає. */
export const EDITION_NOTICE: EditionNotice | null = null;

export function editionLabel() {
  return `Корпус: ${CHECKED_EDITION}`;
}
