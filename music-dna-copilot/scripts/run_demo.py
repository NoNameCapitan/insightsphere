#!/usr/bin/env python3
"""
run_demo.py
===========
Runs the full local one-command pipeline with no external APIs and no credentials.

Usage:
    python scripts/run_demo.py
    python scripts/run_demo.py --mood -1 --task night_drive --novelty 4 --max 9

Outputs are written to the `outputs/` folder:
    - taste_profile_generated.json
    - recommendations_generated.json
    - recommendation_prompt_generated.md
"""

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
EXAMPLES = ROOT / "examples"
OUTPUTS = ROOT / "outputs"


def run(cmd):
    print("\n$ " + " ".join(str(x) for x in cmd))
    completed = subprocess.run(cmd, cwd=ROOT)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def main():
    parser = argparse.ArgumentParser(description="Run the complete Music DNA Copilot demo.")
    parser.add_argument("--history", default=str(EXAMPLES / "sample_listening_history.json"), help="Normalized listening history JSON.")
    parser.add_argument("--catalog", default=str(EXAMPLES / "sample_candidate_catalog.json"), help="Candidate catalog JSON.")
    parser.add_argument("--mood", type=float, default=1.0, help="Mood score from -2 to +2.")
    parser.add_argument("--task", default="night_drive", help="Task/use-case, e.g. night_drive, workout, work_focus.")
    parser.add_argument("--novelty", type=int, default=3, help="Novelty level from 1 to 5.")
    parser.add_argument("--max", type=int, default=9, help="Maximum recommendations.")
    parser.add_argument("--language", default="en", help="Prompt language: en, ru, uk, es, de.")
    args = parser.parse_args()

    OUTPUTS.mkdir(exist_ok=True)
    taste_profile = OUTPUTS / "taste_profile_generated.json"
    recommendations = OUTPUTS / "recommendations_generated.json"
    prompt = OUTPUTS / "recommendation_prompt_generated.md"

    run([sys.executable, str(SCRIPTS / "analyze_taste.py"), args.history, str(taste_profile)])
    run([
        sys.executable, str(SCRIPTS / "generate_recommendations.py"), str(taste_profile),
        "--mood", str(args.mood),
        "--task", args.task,
        "--novelty", str(args.novelty),
        "--max", str(args.max),
        "--catalog", args.catalog,
        "--output", str(recommendations),
    ])
    run([
        sys.executable, str(SCRIPTS / "generate_recommendation_prompt.py"), str(taste_profile),
        "--mood", str(args.mood),
        "--task", args.task,
        "--novelty", str(args.novelty),
        "--language", args.language,
        "--output", str(prompt),
    ])

    print("\nDemo complete.")
    print(f"Taste profile:      {taste_profile}")
    print(f"Recommendations:   {recommendations}")
    print(f"LLM prompt:         {prompt}")
    print("\nOpen the local interface with:")
    print("  python scripts/local_interface.py")


if __name__ == "__main__":
    main()
