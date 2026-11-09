# Live alerts and shelter routes

## Behaviour

- `/nearby` checks `/api/safety/alert` every 30 seconds and again whenever the tab
  becomes visible.
- v1.15 keeps a separate **«Укриття»** button above the map/list. It is visible at all
  times, but enabled only for a confirmed active Kyiv alert with a fresh timestamp
  (under 90 seconds old). Red, yellow and unknown active levels all enable it.
  Loading, inactive, unavailable, stale and offline states disable it. These are polled
  updates, not a promise of instantaneous detection of the start/end of an alert.
- When the button is disabled, the UI now shows the server-provided reason and offers
  **«Оновити статус»**. This makes missing credentials, temporary upstream failure and
  an actual all-clear distinguishable without weakening the fail-closed safety rule.
- One tap rechecks the alert, obtains fresh browser geolocation (`maximumAge: 0`),
  loads eligible shelters, ranks them by straight-line distance from that location,
  and checks the alert once more before opening Google Maps walking directions in the
  same tab. The origin and destination are passed to Google Maps only when the route
  opens. The action does not reuse the directory's stored/district-centre fallback.
- The action stays available when automatic hints are off. It has a busy state and a
  one-tap cancel action; a received all-clear/offline event also cancels the pending route.
  Permission denial, timeout, no results and upstream failure show explanatory messages
  and an official-map link instead of a fabricated destination.
- Only the server contacts `https://api.ukrainealarm.com/api/v3/alerts`; the API token
  is never sent to the browser.
- When the official payload contains an active alert for the city of Kyiv and the user
  has not disabled the feature, the UI switches to the map and requests nearby shelters.
  If the payload contains a level or descriptive message, VetNear distinguishes yellow
  drone danger from red missile/mass/combined danger. Unknown levels stay `call-first`
  and are never silently treated as a confirmed red closure.
- `/api/safety/shelters` validates that coordinates are inside Kyiv, queries within a
  10 km radius, keeps only `actual=1` records explicitly marked `Цілодобово`, excludes
  restricted/non-24h records and returns the five nearest results.
- The spatial query is paginated before selecting the nearest five. Truncated,
  malformed or repeated pages fail closed rather than producing a false nearest result.
- Safety API responses bypass both HTTP caching and the PWA offline cache. The v1.14
  service worker invalidates the legacy cache that could contain stale active alerts.
- The map shows shelter markers and a directional line to the selected result. The
  popup opens Google Maps in walking mode for turn-by-turn routing.
- The “Автоматичні підказки укриттів” control persists in localStorage. “Продовжити без
  підказок” immediately removes the overlay without blocking ordinary clinic discovery.
- The three Kyiv municipal clinic cards follow the rule published on 2026-09-17:
  yellow → `call-first`; confirmed red → route disabled and map marker hidden. Private
  clinics are not assigned this policy without their own verified operating rule.

## Production configuration

1. Request access at `https://api.ukrainealarm.com/`.
2. Add `UKRAINE_ALARM_API_TOKEN` to the deployment's server environment.
3. Do **not** expose it as `NEXT_PUBLIC_*`.
4. Deploy and check `/api/safety/alert`. A configured response must be `active` or
   `inactive`; `unavailable` means the token or upstream service needs attention.
   You can run `npm run check:alarm` before deployment; it validates the credential
   and the dedicated Kyiv-city record without printing the credential or upstream payload.
5. Test `/api/safety/shelters?lat=50.4501&lng=30.5234` and confirm that every returned
   point links back to the municipal dataset.

The credential belongs only in `.env.local` or the host's encrypted server environment
and is intentionally excluded from distributable archives. A credential shown in a
message or screenshot should be rotated before production use.
Without a configured, responding alarm API, the new button correctly remains disabled.
Geolocation requires HTTPS in production (localhost is suitable for development).

## Safety boundaries

- VetNear relays an official alert state; it does not predict threats or replace
  “Київ Цифровий”, civil-defence sirens, or the official “Повітряна тривога” app.
- “Цілодобово” is a declaration in the source dataset, not proof that the door is open
  at this moment. The interface always warns that physical access is not guaranteed.
- “Nearest” means straight-line distance among eligible records within the 10 km
  search radius, not a guarantee of shortest walking distance, a safe route, available
  space or an unlocked entrance. The app does not infer pet access, capacity or current
  obstruction from the coordinates.
- During an alert, users should follow official instructions, move to shelter promptly,
  keep the animal under control, and remain there until the all-clear.
- A yellow warning is not presented as “safe”: shelter guidance remains visible but is
  non-blocking, so the owner can dismiss it in one action and continue the pet-care route.

## Sources

- Kyiv shelter guidance and official map: https://kyivcity.gov.ua/bezpeka_ta_pravoporiadok/vazhlyve_pid_chas_voiennoho_stanu/mapa_ukrittiv_dlya_naselennya_mista_kiyeva/
- Kyiv municipal open dataset: https://data.kyivcity.gov.ua/dataset/dani-pro-roztashuvannia-zakhysnykh-sporud-tsyvilnoho-zakhystu-dep-municipal
- Official Ukraine Alarm API access: https://api.ukrainealarm.com/
- Official alert map: https://map.ukrainealarm.com/
- Google Maps walking directions URL format: https://developers.google.com/maps/documentation/urls/get-started
- ArcGIS layer query and pagination: https://developers.arcgis.com/rest/services-reference/enterprise/query-map-service-layer/
- Browser geolocation and freshness options: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
- Kyiv municipal clinic alert rules (2026-09-17): https://kyivcity.gov.ua/news/komunalni_veterinarni_kliniki_kiyeva_zminili_rezhim_roboti_pid_chas_povitryanikh_trivog/
