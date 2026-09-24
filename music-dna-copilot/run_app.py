#!/usr/bin/env python3
"""
run_app.py
==========
The easiest way to start Music DNA Copilot.

Double-click one of the OS launchers (RUN_APP_WINDOWS.bat /
RUN_APP_MAC.command / RUN_APP_LINUX.sh) or run `python run_app.py`.

What it does before starting:
    - finds the project root (so it works no matter where it's launched from);
    - checks your Python version (3.10+);
    - creates outputs/ if missing;
    - checks that the core scripts are present;
    - then starts the local web app and opens your browser.

It prints the app URL, where your data lives, and how to stop the app —
and turns common problems into friendly messages instead of scary
tracebacks. Nothing is ever uploaded; everything stays on your computer.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPTS = ROOT / "scripts"
MIN_PYTHON = (3, 10)
REQUIRED_SCRIPTS = [
    "local_interface.py",
    "analyze_taste.py",
    "generate_recommendations.py",
    "generate_recommendation_prompt.py",
    "source_common.py",
    "merge_listening_sources.py",
    "enrich_genres.py",
    "mtr_app/i18n.py",
]
LINE = "=" * 60


def fail(title, *lines):
    """Print a friendly, non-scary error and exit."""
    print()
    print(LINE)
    print(f"  Could not start Music DNA Copilot — {title}")
    print(LINE)
    for line in lines:
        print(f"  {line}")
    print(LINE)
    sys.exit(1)


def preflight():
    if sys.version_info < MIN_PYTHON:
        have = ".".join(map(str, sys.version_info[:3]))
        fail(
            "Python is too old",
            f"This app needs Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} or newer; you have {have}.",
            "Install the latest Python from https://www.python.org/downloads/",
            "then double-click the launcher again.",
        )

    if not SCRIPTS.is_dir():
        fail(
            "project files not found",
            "Expected a 'scripts' folder next to this file, in:",
            f"  {ROOT}",
            "Make sure you unzipped the whole project and kept the folders together,",
            "then run the launcher from inside the project folder.",
        )

    missing = [name for name in REQUIRED_SCRIPTS if not (SCRIPTS / name).exists()]
    if missing:
        fail(
            "some core files are missing",
            "These files should be in the 'scripts' folder but weren't found:",
            *(f"  - {name}" for name in missing),
            "Re-download or re-unzip the project to restore them.",
        )

    try:
        (ROOT / "outputs").mkdir(exist_ok=True)
    except OSError as exc:
        fail(
            "could not create the outputs folder",
            f"The app stores your local data in: {ROOT / 'outputs'}",
            f"The system reported: {exc}",
            "Check that you can write to the project folder (permissions / disk space).",
        )


def main():
    preflight()
    sys.path.insert(0, str(SCRIPTS))
    try:
        import local_interface
    except Exception as exc:  # pragma: no cover - defensive
        fail(
            "the app could not be loaded",
            f"Unexpected error while importing the app: {exc}",
            "Try re-unzipping the project. If it persists, this is a bug worth reporting.",
        )

    # Allow an override via env, otherwise the app's own free-port logic runs.
    preferred = None
    if os.environ.get("MTR_PORT"):
        try:
            preferred = int(os.environ["MTR_PORT"])
        except ValueError:
            preferred = None

    try:
        local_interface.serve(port=preferred, open_browser=True)
    except KeyboardInterrupt:
        print("\n" + LINE)
        print("  Music DNA Copilot stopped. Your data is still in the local 'outputs' folder.")
        print(LINE)
    except OSError as exc:
        fail(
            "the local web server could not start",
            f"The system reported: {exc}",
            "Another program may be using the needed port. Close it and try again,",
            "or set a different port, e.g. (macOS/Linux):  MTR_PORT=8780 python run_app.py",
        )


if __name__ == "__main__":
    main()
