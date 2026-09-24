# Using Music Taste Recommender as an AI Skill

This repository works in two modes:

1. **Local app mode** — run a small browser UI on your computer.
2. **AI skill mode** — attach the repository to Manus AI, Claude Code, Codex-style agents, or another LLM that can read project files.

## Local app mode

```bash
python scripts/local_interface.py
```

Open:

```text
http://127.0.0.1:8765
```

The local app gives a one-screen flow:

- select source;
- upload/paste/manual-enter music data;
- set mood;
- choose task;
- set experimentality;
- generate recommendations.

## AI skill mode

Attach or provide at minimum:

```text
SKILL.md
README.md
schemas/
scripts/
examples/
ux/product_logic.md
```

Then use this instruction:

```text
Use the Music Taste Recommender skill from SKILL.md. Work only inside this repository. Keep the MVP local, privacy-first, simple, and explainable. The goal is to analyze listening history, generate Music DNA, apply mood/task/experimentality settings, and return grouped recommendations. Do not build a full streaming service. Do not fake Spotify, Apple Music, or phone media access. Use imports or connector scaffolding unless real OAuth is explicitly requested.
```

## Agent task: improve or implement connector

```text
Review this repository. Keep the existing local MVP working. Add only the requested connector or UI improvement. All private data must remain local unless the user explicitly configures an API connector. Update README and tests after changes.
```

## Agent task: generate recommendations from provided data

```text
Use the music-taste-recommender skill. Normalize this listening history if needed. Generate Music DNA. Then generate recommendations with mood=<value>, task=<value>, experimentality=<1-5>. Return Safe Match, Adjacent Discovery, and Wildcard groups with explanations and confidence scores.
```

## Important limitation

A skill file alone cannot automatically access a user's phone or streaming account. Real access requires platform permissions and OAuth. This repository is intentionally honest about that boundary.
