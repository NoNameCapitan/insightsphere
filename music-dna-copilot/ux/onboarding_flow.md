# UX Onboarding Flow

This document describes the step-by-step user experience from the moment a user opens the Music Taste Recommender until they receive their results. The design philosophy is extremely simple, minimal, mobile-first, and completely free of technical jargon.

## Screen 1: Welcome
**Goal:** Hook the user with a clear value proposition.
**Visuals:** A clean, calm background with bold, readable typography.
**Content:**
- Headline: "Discover Your Music DNA"
- Subtext: "Analyze your music taste and get explainable recommendations based on your mood, task, and novelty preference."
- Primary Action: Large "Start" button.

## Screen 2: Language Selection
**Goal:** Ensure accessibility and comfort.
**Visuals:** A simple list of languages with native spellings.
**Content:**
- Headline: "Choose your language"
- Options: English, Русский, Українська, Español, Deutsch.
- Behavior: Selecting a language immediately updates the UI and transitions to the next screen.

## Screen 3: Privacy Explanation
**Goal:** Build trust before asking for data.
**Visuals:** Minimal icons paired with short text. No dense legal jargon.
**Content:**
- Headline: "Your data is yours"
- Key points:
  - We only analyze the data you explicitly allow.
  - We never publish your listening history.
  - You can disconnect your sources at any time.
  - Private tokens are securely managed.
- Primary Action: "I Understand" button.

## Screen 4: Source Selection
**Goal:** Provide flexible ways to input data.
**Visuals:** Large, tap-friendly cards or buttons for each source.
**Content:**
- Headline: "Where do you listen to music?"
- Options:
  - Connect Spotify (Primary)
  - Connect Last.fm
  - Upload CSV / JSON
  - Add favorite artists manually
  - Apple Music (Marked as Beta / Future)
- Behavior: Tapping an option initiates the specific connection flow.

## Screen 5: Permission Explanation (Pre-connection)
**Goal:** Explicitly state what will be analyzed.
**Visuals:** A simple checklist.
**Content:**
- Headline: "What we will look at"
- Checklist:
  - Recently played tracks
  - Top artists
  - Top tracks
  - (Note: Playlists are optional and require separate approval)
- Primary Action: "Connect [Service]" button.

## Screen 6: Mood Slider
**Goal:** Capture the user's current emotional state.
**Visuals:** A large, interactive horizontal slider. The background color subtly shifts from cool/dark to warm/bright as the slider moves.
**Content:**
- Headline: "What is your mood right now?"
- Slider Range:
  - 😞 Very negative (-2)
  - 😐 Neutral (0)
  - 🤩 Super positive (+2)
- Primary Action: "Next" button.

## Screen 7: Task Selector
**Goal:** Understand the context for the recommendations.
**Visuals:** A grid of simple, recognizable icons/buttons.
**Content:**
- Headline: "What do you need music for?"
- Options: Work/Focus, Walking, Workout, Night drive, Sad mood, Romantic mood, Party, Relaxation, TikTok/Reels, AI video, Playlist creation, Discovering new artists, Surprise me.
- Behavior: User selects one option and taps "Next".

## Screen 8: Novelty Slider
**Goal:** Determine the user's risk tolerance for new music.
**Visuals:** A simple slider with clear text labels at each stop.
**Content:**
- Headline: "How far should we go from your usual taste?"
- Options (1 to 5):
  1. Only similar music
  2. Slightly new
  3. Balanced
  4. More experimental
  5. Surprise me
- Primary Action: "Generate Recommendations" button.

## Screen 9: Analysis Loading State
**Goal:** Keep the user engaged while processing.
**Visuals:** A smooth, calming animation with dynamic text that updates as steps complete.
**Content:**
- Dynamic Text Sequence:
  - "Finding repeated artists..."
  - "Detecting genres..."
  - "Analyzing moods..."
  - "Comparing recent and long-term taste..."
  - "Generating Music DNA..."
  - "Preparing recommendations..."

## Screen 10: Result Dashboard
**Goal:** Present the Music DNA and recommendations clearly.
**Visuals:** A scrolling dashboard. Sections are clearly divided.
**Content:**
- **Section 1: Music DNA Summary:** A short, plain-language paragraph explaining their taste (e.g., "Your taste is highly energetic and positive, rooted in pop and synthwave.").
- **Section 2: Taste Visuals:** Simple visualizations (e.g., a radar chart or bar charts) for mood profile, genre map, and novelty tolerance.
- **Section 3: Taste Drift:** A brief note on what changed recently (e.g., "You've been listening to more ambient music lately.").
- **Section 4: Recommendations:** Grouped lists (Safe Match, Adjacent Discovery, Wildcard). Each track card shows the title, artist, match scores, and a short explanation of *why* it was chosen.
- **Action:** Feedback buttons (Like, Not for me, etc.) on each track card.

## Local demo interface

For the first working version, the entire flow is compressed into one local screen:

1. Mood slider.
2. Task selector.
3. Novelty slider.
4. Recommendation button.
5. Result cards grouped by recommendation type.

This is not the final public UI. It is a minimal proof that the product logic works before adding accounts, OAuth, playlist export, or a full frontend framework.
