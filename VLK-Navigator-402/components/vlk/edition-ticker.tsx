import { AlertTriangle, ExternalLink, FileClock } from "lucide-react";
import { EDITION } from "@/lib/vlk-sample-data";
import { EDITION_NOTICE, LIVE_EDITION_SOURCE_URL } from "@/lib/vlk-edition";
import { SOURCE_CHECK } from "@/lib/vlk-source-check";

/** Recorded corpus metadata, not a live assertion of legal currency.
 * Static wrapping keeps every date readable at every width and at 200% zoom.
 * A labelled region, rather than status, avoids an implicit live announcement.
 */
export function EditionTicker() {
  const alert = EDITION_NOTICE !== null;

  return (
    <section
      className="edition-ticker"
      data-alert={alert || undefined}
      role="region"
      aria-label="Редакція нормативного корпусу"
    >
      <span className="edition-ticker-icon" aria-hidden="true">
        {alert ? <AlertTriangle className="size-3.5" /> : <FileClock className="size-3.5" />}
      </span>
      <div className="edition-ticker-viewport">
        <span className="edition-ticker-track">
          <span className="edition-ticker-copy" title={`Наказ МОУ №402: у корпусі навігатора — редакція від ${EDITION}; остання перевірка офіційного джерела: ${SOURCE_CHECK.checkedAt}. Записані метадані, не перевірка в реальному часі.`}>
            Корпус №402: редакція <b>{EDITION}</b>
            <span className="edition-check-label"> · Перевірка джерела: </span> <b
              title="Записана дата перевірки в метаданих корпусу, не перевірка в реальному часі"
            >{SOURCE_CHECK.checkedAt}</b>
            {alert ? ` · ${EDITION_NOTICE?.message}` : ""}
          </span>
        </span>
      </div>
      <a
        className="edition-ticker-link"
        href={alert ? (EDITION_NOTICE?.url ?? LIVE_EDITION_SOURCE_URL) : LIVE_EDITION_SOURCE_URL}
        target="_blank"
        rel="noreferrer"
      >
        <span className="edition-source-label">Відкрити джерело</span>
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}
