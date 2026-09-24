# Release Candidate checklist

A short, practical checklist for the owner to confirm the app is ready for daily
personal use. Tick each box; jot notes where it asks.

## 1. Install / start
- [ ] Python 3.10+ available (`python3 --version`)
- [ ] `python3 scripts/start_app.py --check` prints status with no errors
- [ ] Open the local URL it prints (default `http://127.0.0.1:8765/`)

## 2. Baseline tests
- [ ] `python3 scripts/run_demo.py` → OK
- [ ] `python3 -u scripts/smoke_test.py` → all passed, no hang
- [ ] Individual suites pass (spotify, genre taxonomy, deep genre, candidate engine,
      lastfm connector, lastfm tag enrichment, user scenarios, personal store,
      personal memory, music DNA report, data management, manual quality check)

## 3. First personal run
- [ ] Choose a preset (try **Night Drive** or **Focus / Deep Work**)
- [ ] Generate recommendations
- [ ] Save 3 favorites (♥)
- [ ] Reject 2 bad recommendations (✕ Never)
- [ ] Add 5 tracks to Listen Later (🕑)

## 4. Deep genre checks
- [ ] Atmospheric black metal — strict, exclude deathcore/metalcore (verify no -core leaks)
- [ ] Darkwave walk — adjacent discovery
- [ ] Focus — electronic, exclude EDM (verify no EDM)
- [ ] Ukrainian indie / alternative — prefer Ukrainian

## 5. Source checks
- [ ] Demo mode works
- [ ] CSV/JSON upload works
- [ ] Last.fm (if configured): recent + similar + tag enrichment
- [ ] Spotify (if configured): read-only OAuth + Search candidates

## 6. Data checks
- [ ] Export backup (.zip) from `/data`
- [ ] Export shortlist (CSV/TXT) from `/queue`
- [ ] Export Music DNA report (`/export/dna-report`)
- [ ] Clear shortlist
- [ ] Full reset asks for confirmation before deleting

## 7. Daily-use check
- [ ] Run last preset again
- [ ] Reroll safer
- [ ] Reroll more adventurous
- [ ] Broaden / narrow genre
- [ ] Open Queue and review saved music

## 8. Personal verdict
- What recommendations were actually good? ______________________________
- What genres were weak? ________________________________________________
- What presets were useful? _____________________________________________
- What would I pay for? _________________________________________________
- What would a friend understand without explanation? __________________

---

When sections 1–7 are ticked and section 8 is filled in, this build is good for
daily personal use. Anything marked "future/planned" (Apple Music, Spotify playlist
export, YouTube Music live, cloud, accounts, payments) is intentionally not part of
this release.
