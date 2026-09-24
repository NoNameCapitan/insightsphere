#!/usr/bin/env python3
"""
personal_store.py
=================
Local-first personal workspace storage for the Music DNA Copilot.

Everything lives under outputs/ as plain JSON / JSONL. No database, no accounts,
no cloud. Stdlib only.

- Presets:        outputs/personal_presets.json   (custom presets; built-ins are code)
- Favorites:      outputs/favorites.jsonl
- Rejects:        outputs/rejects.jsonl
- Listen later:   outputs/listen_later.jsonl
- Shortlist:      outputs/shortlist.jsonl

A PersonalStore is rooted at a base directory (default: <repo>/outputs) so tests
can use a temp directory.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = ROOT / "outputs"

PRESET_FIELDS = [
    "mood", "task", "novelty", "genre_families", "genre_subgenres", "genre_microgenres",
    "exclude_genres", "strictness", "discovery", "prefer_ukrainian", "prefer_instrumental",
    "prefer_vocal", "prefer_obscure", "prefer_popular", "use_lastfm_candidates", "notes",
]

RECORD_KINDS = {"favorites", "rejects", "listen_later", "shortlist"}

RECORD_FIELDS = [
    "timestamp", "track_title", "artist", "genres", "source", "source_url",
    "recommendation_group", "mood", "task", "novelty", "genre_constraints", "reason", "action",
]


def _now():
    return datetime.now(timezone.utc).isoformat()


def _preset(name, **kw):
    base = {f: "" for f in PRESET_FIELDS}
    base.update({"mood": 0, "novelty": 3, "task": "night_drive", "strictness": "balanced",
                 "discovery": "adjacent", "prefer_ukrainian": False, "prefer_instrumental": False,
                 "prefer_vocal": False, "prefer_obscure": False, "prefer_popular": False,
                 "use_lastfm_candidates": False, "notes": ""})
    base.update(kw)
    base["id"] = "builtin:" + name.lower().replace(" ", "_").replace("/", "_")
    base["name"] = name
    base["builtin"] = True
    return base


BUILTIN_PRESETS = [
    _preset("Night Drive", mood=1, novelty=3, task="night_drive",
            genre_families="synthwave, electronic", discovery="adjacent",
            notes="Late-night synth + electronic cruising."),
    _preset("Dark Mystic Video", mood=-1, novelty=3, task="ai_video",
            genre_families="dark ambient, gothic", genre_subgenres="ritual ambient",
            prefer_instrumental=True, discovery="adjacent",
            notes="Moody, cinematic, instrumental beds for video."),
    _preset("Focus / Deep Work", mood=0, novelty=2, task="work_focus",
            genre_families="ambient", genre_subgenres="downtempo, idm",
            exclude_genres="edm, big room, trap", prefer_instrumental=True,
            strictness="balanced", discovery="inside", notes="Calm, low-distraction."),
    _preset("Atmospheric Black Metal", mood=-1, novelty=3, task="walking",
            genre_subgenres="atmospheric black metal", exclude_genres="deathcore, metalcore",
            strictness="strict", discovery="inside",
            notes="Strict, excludes adjacent -core styles."),
    _preset("Darkwave Walk", mood=0, novelty=3, task="walking",
            genre_families="gothic", genre_subgenres="darkwave, post-punk",
            discovery="adjacent", notes="Night-walk darkwave / post-punk."),
    _preset("Ukrainian Indie / Alternative", mood=1, novelty=3, task="walking",
            genre_families="ukrainian", genre_subgenres="indie, alternative",
            prefer_ukrainian=True, discovery="adjacent",
            notes="Boosts Ukrainian-tagged music when present."),
    _preset("Cyberpunk / Synthwave", mood=1, novelty=4, task="night_drive",
            genre_families="synthwave", genre_subgenres="darksynth, cyberpunk",
            discovery="adjacent", notes="Neon, driving, slightly experimental."),
    _preset("Wild Discovery", mood=1, novelty=5, task="discovering_new_artists",
            discovery="cross_genre", strictness="soft", prefer_obscure=True,
            use_lastfm_candidates=True, notes="Maximum novelty; expand via Last.fm."),
    _preset("Safe Recommendations", mood=1, novelty=2, task="relaxation",
            strictness="balanced", discovery="inside", prefer_popular=True,
            notes="Closest to existing taste."),
    _preset("Creator Mode", mood=0, novelty=3, task="ai_video",
            genre_families="electronic, ambient", prefer_instrumental=True,
            use_lastfm_candidates=True, discovery="adjacent",
            notes="Instrumental-leaning beds for content + wide pool."),
    _preset("Calm Ambient", mood=0, novelty=2, task="relaxation",
            genre_families="ambient", genre_subgenres="drone, downtempo",
            prefer_instrumental=True, strictness="balanced", discovery="inside",
            notes="Soft, slow, mostly instrumental wind-down."),
    _preset("Aggressive Energy", mood=2, novelty=3, task="workout",
            genre_families="metal, electronic", genre_subgenres="industrial, drum and bass",
            strictness="balanced", discovery="adjacent",
            notes="High-energy, driving, intense."),
    _preset("Melancholy Evening", mood=-1, novelty=3, task="sad_mood",
            genre_families="indie, ambient", genre_subgenres="slowcore, dream pop",
            discovery="adjacent", notes="Wistful, reflective, low-key."),
    _preset("Workout", mood=2, novelty=2, task="workout",
            genre_families="electronic, hip hop", prefer_popular=True,
            strictness="balanced", discovery="inside",
            notes="Familiar, motivating, steady tempo."),
    _preset("Experimental Discovery", mood=1, novelty=5, task="discovering_new_artists",
            genre_subgenres="experimental, avant-garde", discovery="cross_genre",
            strictness="soft", prefer_obscure=True, use_lastfm_candidates=True,
            notes="Far-out finds; widest net, most novelty."),
    _preset("Post-metal / Doom / Sludge", mood=-1, novelty=3, task="relaxation",
            genre_families="metal", genre_subgenres="post-metal, doom metal, sludge metal",
            strictness="balanced", discovery="adjacent", exclude_genres="metalcore, deathcore",
            use_lastfm_candidates=True,
            notes="Heavy, slow, cathartic — Bell Witch / YOB / Amenra territory."),
    _preset("Dungeon Synth / Ambient", mood=-1, novelty=3, task="work_focus",
            genre_families="ambient", genre_subgenres="dungeon synth, dark ambient",
            prefer_instrumental=True, strictness="balanced", discovery="inside",
            notes="Lo-fi medieval/ambient atmospheres for focus or writing."),
    _preset("Focus: No Vocals", mood=0, novelty=2, task="work_focus",
            genre_families="ambient, electronic, classical", prefer_instrumental=True,
            exclude_genres="pop, rap, vocal", strictness="balanced", discovery="inside",
            notes="Instrumental-only beds for deep work — no lyrics to distract."),
    _preset("Heavy but Not Metalcore", mood=1, novelty=3, task="workout",
            genre_families="metal", strictness="balanced", discovery="adjacent",
            exclude_genres="metalcore, deathcore, pop punk",
            notes="Weight and intensity without the -core sound."),
    _preset("Melancholic but Beautiful", mood=-1, novelty=3, task="sad_mood",
            genre_families="post-rock, ambient, indie", genre_subgenres="slowcore, dream pop",
            discovery="adjacent", exclude_genres="edm, trap",
            notes="Sad, gorgeous, cinematic — heartbreak that sounds like light."),
]


class PersonalStore:
    def __init__(self, base_dir=None):
        self.base = Path(base_dir) if base_dir else DEFAULT_BASE
        self.presets_path = self.base / "personal_presets.json"

    def _path(self, kind):
        if kind not in RECORD_KINDS:
            raise ValueError(f"unknown record kind: {kind}")
        return self.base / f"{kind}.jsonl"

    def _ensure_base(self):
        self.base.mkdir(parents=True, exist_ok=True)

    # -- presets ------------------------------------------------------------

    def _load_custom_presets(self):
        try:
            if self.presets_path.exists():
                data = json.loads(self.presets_path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return data
        except (OSError, ValueError):
            pass
        return []

    def _save_custom_presets(self, presets):
        self._ensure_base()
        self.presets_path.write_text(json.dumps(presets, indent=2, ensure_ascii=False),
                                     encoding="utf-8")

    def list_presets(self):
        """Built-in presets first, then custom ones."""
        return [dict(p) for p in BUILTIN_PRESETS] + self._load_custom_presets()

    def get_preset(self, preset_id):
        for p in self.list_presets():
            if p.get("id") == preset_id:
                return p
        return None

    def save_preset(self, data, name=None):
        """Create or update a custom preset. Returns the stored preset."""
        custom = self._load_custom_presets()
        preset = {f: data.get(f, "") for f in PRESET_FIELDS}
        preset["name"] = (name or data.get("name") or "My preset").strip() or "My preset"
        preset["builtin"] = False
        pid = data.get("id", "")
        if pid and not str(pid).startswith("builtin:") and any(p["id"] == pid for p in custom):
            for p in custom:
                if p["id"] == pid:
                    preset["id"] = pid
                    preset["created_at"] = p.get("created_at", _now())
                    preset["updated_at"] = _now()
                    p.clear()
                    p.update(preset)
                    break
        else:
            preset["id"] = "custom:" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
            preset["created_at"] = _now()
            preset["updated_at"] = preset["created_at"]
            custom.append(preset)
        self._save_custom_presets(custom)
        return preset

    def delete_preset(self, preset_id):
        """Delete a custom preset. Built-ins cannot be deleted. Returns True if removed."""
        if not preset_id or str(preset_id).startswith("builtin:"):
            return False
        custom = self._load_custom_presets()
        new = [p for p in custom if p.get("id") != preset_id]
        if len(new) == len(custom):
            return False
        self._save_custom_presets(new)
        return True

    def reset_presets(self):
        """Remove all custom presets (built-ins always remain)."""
        if self.presets_path.exists():
            try:
                self.presets_path.unlink()
            except OSError:
                self._save_custom_presets([])
        return True

    # -- records (favorites / rejects / listen_later / shortlist) -----------

    @staticmethod
    def _key(rec):
        return (str(rec.get("artist", "")).strip().lower(),
                str(rec.get("track_title", "")).strip().lower())

    def list_records(self, kind):
        path = self._path(kind)
        out = []
        if not path.exists():
            return out
        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line:
                    try:
                        out.append(json.loads(line))
                    except ValueError:
                        continue
        except OSError:
            pass
        return out

    def add_record(self, kind, record, dedupe=True):
        """Append a normalized record; de-dupe by (artist, track) when asked."""
        path = self._path(kind)
        rec = {f: record.get(f) for f in RECORD_FIELDS}
        rec["timestamp"] = rec.get("timestamp") or _now()
        rec["genres"] = record.get("genres") or []
        if dedupe:
            existing = {self._key(r) for r in self.list_records(kind)}
            if self._key(rec) in existing:
                return rec  # already present; no duplicate line
        self._ensure_base()
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return rec

    def remove_record(self, kind, artist, track_title):
        """Rewrite a JSONL file without the matching (artist, track). Returns count removed."""
        path = self._path(kind)
        records = self.list_records(kind)
        target = (str(artist).strip().lower(), str(track_title).strip().lower())
        kept = [r for r in records if self._key(r) != target]
        removed = len(records) - len(kept)
        if removed:
            self._ensure_base()
            path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in kept),
                            encoding="utf-8")
        return removed

    # -- personal memory summary -------------------------------------------

    def personal_memory(self, feedback_path=None):
        """Aggregate favorites/rejects/feedback into a transparent memory summary."""
        favorites = self.list_records("favorites")
        rejects = self.list_records("rejects")
        listen_later = self.list_records("listen_later")

        feedback = []
        fb_path = Path(feedback_path) if feedback_path else (self.base / "feedback.jsonl")
        if fb_path.exists():
            try:
                for line in fb_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line:
                        try:
                            feedback.append(json.loads(line))
                        except ValueError:
                            continue
            except OSError:
                pass

        boosted_genres, reduced_genres = {}, {}
        boosted_artists, reduced_artists = {}, {}

        def bump(d, key, amt=1):
            if key:
                d[key] = d.get(key, 0) + amt

        for r in favorites:
            for g in r.get("genres") or []:
                bump(boosted_genres, str(g).lower())
            bump(boosted_artists, str(r.get("artist", "")).lower())
        for r in rejects:
            for g in r.get("genres") or []:
                bump(reduced_genres, str(g).lower())
            bump(reduced_artists, str(r.get("artist", "")).lower())
        for fb in feedback:
            action = fb.get("action")
            genres = [str(g).lower() for g in (fb.get("genres") or [])]
            artist = str(fb.get("artist", "")).lower()
            if action in ("like", "more_like"):
                for g in genres:
                    bump(boosted_genres, g)
                bump(boosted_artists, artist)
            elif action in ("dislike", "less_like"):
                for g in genres:
                    bump(reduced_genres, g)
                bump(reduced_artists, artist)

        blocked_tracks = [{"artist": r.get("artist"), "track_title": r.get("track_title")}
                          for r in rejects]

        def top(d, n=8):
            return [k for k, _ in sorted(d.items(), key=lambda kv: -kv[1]) if k][:n]

        return {
            "favorites_count": len(favorites),
            "rejects_count": len(rejects),
            "listen_later_count": len(listen_later),
            "boosted_genres": top(boosted_genres),
            "reduced_genres": top(reduced_genres),
            "blocked_tracks": blocked_tracks,
            "boosted_artists": top(boosted_artists),
            "reduced_artists": top(reduced_artists),
        }


# action -> record kind for personal action buttons
ACTION_TO_KIND = {
    "favorite": "favorites",
    "listen_later": "listen_later",
    "reject": "rejects",
    "never": "rejects",
    "shortlist": "shortlist",
}


def get_store(base_dir=None):
    return PersonalStore(base_dir)


if __name__ == "__main__":
    s = PersonalStore()
    print(f"{len(BUILTIN_PRESETS)} built-in presets")
    print(json.dumps(s.personal_memory(), indent=2))
