# Self-Test Plan (3 days)

A concrete personal testing plan. Open **/self-test** in the app for live checkmarks
while you work through this. Write notes directly into this file.

## Day 1 — Basic test (~20 min)
- [ ] Launch the app (`start_windows.bat` / `start_mac.command` / `./start_linux.sh` / `python3 scripts/start_app.py`)
- [ ] Run demo: **Use demo library** → Generate → recommendations appear
- [ ] Load **Owner-style demo taste** OR paste ~30 of your own tracks (Manual favorite tracks)
- [ ] Generate first recommendations from your taste
- [ ] Save 5 favorites (♥)
- [ ] Mark 5 bad results (✕ Never)
- Notes: ____________________________________________________________

## Day 2 — Last.fm test (~30 min)
- [ ] Sources → Last.fm: enter username + API key → Save → **Test Last.fm connection**
- [ ] Enable "Use Last.fm similar tracks", generate — pool should grow
- [ ] Session 1: preset **Night Drive** → generate → save/reject
- [ ] Session 2: preset **Post-metal / Doom / Sludge** → generate → save/reject
- [ ] Session 3: preset **Dark Mystic Video** → generate → save/reject
- [ ] **Export Music DNA report** (Markdown) and skim it
- Notes: ____________________________________________________________

## Day 3 — Quality check (~30 min)
- [ ] Compare recommendations against your real taste — which would you actually play?
- [ ] Mark weak results with ✕ so future runs improve
- [ ] Test **Strict** genre mode (e.g. atmospheric black metal, exclude deathcore/metalcore) — few results is honest, filler is a bug
- [ ] Test **excluded genres** actually stay out (try excluding metalcore, EDM)
- [ ] Test **Adjacent discovery** — are the "adjacent" picks plausibly adjacent?
- [ ] Use **Reroll: Safer / More adventurous / Narrow / Broaden** at least once each
- [ ] Write down: what was useful, what was noise, what you'd change
- Notes: ____________________________________________________________

## Scoring table (fill after Day 3)

| Criterion | Score |
| --- | --- |
| Launch ease (1–10) | |
| UI clarity (1–10) | |
| Recommendation quality (1–10) | |
| Genre accuracy (1–10) | |
| Last.fm usefulness (1–10) | |
| Would I use this weekly? (yes/no) | |
| Would I share with a friend? (yes/no) | |

## Wrap-up
- Best preset: ______________  · Worst preset: ______________
- Top 3 discovered tracks: __________________________________________
- One thing to fix first: ___________________________________________
- Back up your data on **/data** (Export backup) if you want to keep this test's memory.
