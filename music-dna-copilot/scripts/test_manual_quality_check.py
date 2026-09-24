#!/usr/bin/env python3
"""
test_manual_quality_check.py
============================
Verifies the manual quality-check script runs offline and writes a readable
Markdown report covering every scenario. No network.
"""

import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
OUT = ROOT / "outputs" / "manual_quality_check.md"

PASS, FAIL = [], []


def check(name, cond):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")


def main():
    print("Manual quality check: run script")
    if OUT.exists():
        OUT.unlink()
    import os
    os.environ["LASTFM_API_KEY"] = ""
    os.environ["LASTFM_USERNAME"] = ""
    os.environ.setdefault("MTR_PIPELINE_TIMEOUT", "30")
    import manual_quality_check
    rc = manual_quality_check.main()
    check("script exits 0", rc == 0)
    check("report file written", OUT.exists())
    text = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    check("report has title", text.startswith("# Manual quality check"))
    check("report has summary section", "## Summary" in text)
    for name in ("Night Drive", "Atmospheric Black Metal", "Wild Discovery",
                 "Focus (electronic", "Ukrainian Indie"):
        check(f"report covers scenario: {name}", name in text)
    check("report has manual verdict lines", "Manual verdict:" in text)
    check("report reports exclude-rule status", "Exclude rules respected:" in text)
    check("report has owner-note fields",
          "Would I listen to this?" in text and "Genre accuracy" in text
          and "What to adjust next:" in text and "Best tracks:" in text)
    check("report has summary table",
          "| Scenario | Result count | Warnings |" in text)

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
