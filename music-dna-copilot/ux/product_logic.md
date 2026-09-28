# Product Logic & Recommendation Engine

This document explains the underlying logic of the Music Taste Recommender. It bridges the gap between user inputs (sliders, selectors) and the technical recommendation generation.

## 1. The Core Philosophy: Transparent Heuristics
Unlike "black box" algorithms (like Spotify's default radio), this system uses a transparent scoring model. The user is told exactly *why* a track was chosen. The final confidence score is a weighted sum of several distinct factors.

## 2. Input Variables

### A. The Taste Profile (Music DNA)
This is the baseline. It establishes:
- What genres the user likes (Genre Affinity).
- Which artists they already know (Artist Recurrence).
- Their baseline energy and valence preferences.
- How much they tolerate new music vs. repeating old favorites.

### B. The Mood Slider (-2 to +2)
The mood slider acts as a primary filter, overriding the baseline energy/valence if necessary.
- **-2 (Very Negative):** Maps to low valence (< 0.3) and variable energy.
- **0 (Neutral):** Maps to balanced valence (~0.5).
- **+2 (Super Positive):** Maps to high valence (> 0.7) and high energy (> 0.7).

*Logic:* The engine calculates a `mood_match_score` based on how close a candidate track's audio features are to the mapped target valence and energy.

### C. The Task Selector
The task provides contextual constraints.
- **Workout:** Demands high energy and high tempo (BPM).
- **Work/Focus:** Prefers instrumental tracks, moderate tempo, and avoids high vocal energy.
- **Night Drive:** Prefers specific genres (synthwave, ambient) and moderate energy.

*Logic:* The engine applies a `task_match_score` based on tempo ranges and instrumentalness flags defined in `TASK_PROFILES`.

### D. The Novelty Slider (1 to 5)
This dictates the risk profile of the recommendations.
- **1 (Only similar):** Demands high `genre_affinity` and high `artist_recurrence`.
- **5 (Surprise me):** Demands low `artist_recurrence` and accepts lower `genre_affinity`.

*Logic:* The slider maps to a `novelty_distance` (0.1 to 1.0). The engine calculates a `novelty_distance_score` based on how well the candidate track's actual novelty matches the requested distance.

## 3. The Scoring Model
Each candidate track receives a score from 0 to 100, calculated using weighted factors:

1. **Genre Affinity (25%):** Does the track match the user's core genres?
2. **Mood Match (20%):** Does it fit the slider?
3. **Task Match (15%):** Does it fit the context?
4. **Artist Recurrence (15%):** Does the user already know them? (Higher for known artists; this factor contributes to the familiarity score that determines grouping.)
5. **Novelty Distance (10%):** Does the track's familiarity align with the novelty slider?
6. **Long-term Consistency (10%):** Does it align with the user's stable taste drift?
7. **Recency/Popularity (5%):** Is it a trending track?

Note: Artist recurrence always contributes positively to the confidence score. However, it indirectly affects grouping: tracks with high artist recurrence are classified as Safe Match, while tracks with zero recurrence are more likely to become Wildcards when the user's novelty preference is high.

## 4. Recommendation Grouping
To make the output digestible, the top-scoring tracks are bucketed into three groups based on their familiarity score (Genre Affinity + Artist Recurrence). Crucially, the grouping thresholds are **dynamic** and shift based on the user's novelty preference:

- When novelty is low (1-2), the Safe Match threshold is lowered, making more tracks qualify as "safe."
- When novelty is high (4-5), the Wildcard threshold is raised, making more tracks qualify as "experimental."

The three groups:

- **Safe Match:** High familiarity relative to the current novelty threshold. The user likely knows the artist or heavily listens to the exact subgenre.
- **Adjacent Discovery:** Moderate familiarity. New artists in known genres, or known artists in slightly different styles.
- **Wildcard:** Low familiarity relative to the current novelty threshold, but high scores in Mood and Task match. Explainable, but experimental.

## 5. Explainability Generation
For every recommended track, the system generates plain-language explanations:
- **Why Like:** "Matches your favorite genres" or "Fits your current mood perfectly."
- **Why Not Like:** "It's quite different from your usual taste" or "The tempo is a bit slow for a workout."

This transparency builds trust and helps the user understand their own taste better.

## Local MVP behavior

The current local interface:

- does not authenticate end-users or use accounts;
- supports demo, manual, CSV/JSON upload, Spotify OAuth (read-only), and Last.fm
  (read-only: recent tracks + similar-track discovery with tag enrichment) as sources;
- adds a personal workspace: presets, favorites / listen-later / rejects / shortlist,
  feedback-aware scoring, a Music DNA report, and a candidate pool with quality metrics;
- lets users control mood, task, novelty, and deep-genre direction;
- generates explainable recommendations through the same scripts used by the skill.

This keeps the MVP testable and privacy-first. A production version should replace the sample data step with file upload, Spotify OAuth, or user-approved imports.


## Feedback-aware scoring (V3)

Feedback buttons under each recommendation append one JSON line to
`outputs/feedback.jsonl` (timestamp, track, artist, genres, group, action,
mood, task, experimentality, source, optional reason). On every run the
engine aggregates that file into three transparent signals:

| Action | Effect |
|---|---|
| Like | +1.0 weight to the track's genres and artist |
| More like this | +1.5 weight to the track's genres and artist |
| Not for me | −1.0 weight to the track's genres and artist |
| Too similar | novelty distance +0.05 per record |
| Too strange | novelty distance −0.05 per record |

Caps keep the system stable and explainable — feedback can never dominate:

- per-genre preference is clamped to ±0.30, per-artist to ±0.40;
- the combined per-track adjustment is clamped to ±0.5, which translates
  to at most ±6 confidence points (the adjustment enters the final score
  with weight 0.12);
- the cumulative novelty shift is clamped to ±0.15.

The adjustment appears in every track's `scoring_breakdown` as
`feedback_adjustment`, and the run parameters report
`feedback_records_used` and `feedback_novelty_shift`, so the user can
always see whether and how feedback changed the result. `--no-feedback`
disables it; deleting `outputs/feedback.jsonl` resets it.

## Spotify candidate catalog (V3, optional)

When Spotify is connected and the checkbox is on, the app builds a fresh
candidate catalog by querying Spotify Search with the user's top ~5
artists (`artist:"…"`) and top ~5 genres (`genre:"…"`), 10 results per
query, deduplicated, with tracks already in the user's history excluded
so the catalog favors discovery. Artist genres are batch-resolved via
`/artists`; popularity is normalized to 0–1.

Honest limitations, by design:

- Spotify deprecated the public audio-features endpoint for new apps, so
  these candidates carry no valence/energy/tempo. The engine substitutes
  neutral defaults (0.5), which means mood/task matching for Spotify
  candidates leans mostly on genre signals.
- This is plain catalog search, not Spotify's recommendation algorithm —
  the app does not claim Spotify-level recommendation quality.
- Any failure (network, empty results, expired token) falls back to
  `examples/sample_candidate_catalog.json`, and the UI says so.
