import { CHECKED_EDITION, LIVE_EDITION_SOURCE_URL } from "../lib/vlk-edition.ts";
import { detectOfficialEdition } from "../lib/vlk-edition-monitor.ts";

const response = await fetch(LIVE_EDITION_SOURCE_URL, {
  headers: {
    accept: "text/html,application/xhtml+xml",
    "user-agent": "VLK-Navigator-402-Edition-Monitor/1.0",
  },
  signal: AbortSignal.timeout(20_000),
});

if (!response.ok) {
  throw new Error(`Офіційне джерело повернуло HTTP ${response.status}; чинність не підтверджено.`);
}

const html = await response.text();
const detectedEdition = detectOfficialEdition(html);
if (!detectedEdition) {
  throw new Error("Не вдалося однозначно визначити дату редакції; потрібна ручна перевірка.");
}

if (detectedEdition !== CHECKED_EDITION) {
  throw new Error(
    `Виявлено іншу редакцію Наказу №402: ${detectedEdition}; корпус містить ${CHECKED_EDITION}.`,
  );
}

console.log(`PASS: офіційна редакція ${detectedEdition} збігається з нормативним корпусом.`);
