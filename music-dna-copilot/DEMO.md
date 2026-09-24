# Demo in 60 seconds

## Easiest: double-click

1. Double-click `start_mac.command` / `start_windows.bat` / `start_linux.sh`.
2. The browser opens automatically.
3. Click **▶️ Start with demo**.
4. You get a Music DNA profile and recommendations grouped into
   Safe Match / Adjacent Discovery / Wildcard, each with reasons for
   and against, plus feedback buttons and export links.

## CLI demo

```bash
python scripts/run_demo.py --mood 1 --task night_drive --novelty 4 --max 9
```

## Verify the whole project

```bash
python scripts/smoke_test.py
```

Runs 30+ checks: compilation, demo pipeline, CSV import, schema
validation, offline Spotify connector tests, UI rendering in all three
languages, feedback and export endpoints, and the free-port fallback.
No network or Spotify credentials needed.
