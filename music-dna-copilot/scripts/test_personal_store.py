#!/usr/bin/env python3
"""test_personal_store.py — offline tests for presets + record storage."""

import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from personal_store import PersonalStore, BUILTIN_PRESETS, ACTION_TO_KIND

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


def rec(title, artist, **kw):
    base = {"track_title": title, "artist": artist, "genres": kw.get("genres", []),
            "source": "test", "recommendation_group": "safe_match", "action": kw.get("action")}
    base.update(kw)
    return base


def main():
    with tempfile.TemporaryDirectory() as d:
        s = PersonalStore(base_dir=d)

        print("Presets: built-ins + custom lifecycle")
        presets = s.list_presets()
        check("ships 20 built-in presets", len([p for p in presets if p.get("builtin")]) == 20,
              str(len(presets)))
        check("Night Drive built-in present", any(p["name"] == "Night Drive" for p in presets))

        saved = s.save_preset({"name": "My Mix", "mood": 2, "task": "party",
                               "genre_families": "house", "strictness": "soft"})
        check("custom preset created with id", saved["id"].startswith("custom:"))
        check("custom preset retrievable", s.get_preset(saved["id"])["name"] == "My Mix")

        saved2 = s.save_preset({"id": saved["id"], "name": "My Mix v2", "mood": 1,
                                "task": "party", "genre_families": "techno"})
        check("custom preset updated in place (same id)", saved2["id"] == saved["id"])
        check("update changed fields", s.get_preset(saved["id"])["name"] == "My Mix v2"
              and s.get_preset(saved["id"])["genre_families"] == "techno")
        check("update kept created_at, bumped updated_at",
              s.get_preset(saved["id"])["created_at"] <= s.get_preset(saved["id"])["updated_at"])

        check("built-in preset cannot be deleted", s.delete_preset("builtin:night_drive") is False)
        check("custom preset can be deleted", s.delete_preset(saved["id"]) is True)
        check("deleted preset gone", s.get_preset(saved["id"]) is None)
        check("built-ins survive after reset", len(s.list_presets()) >= 20)

        s.save_preset({"name": "tmp"})
        s.reset_presets()
        check("reset removes custom presets only",
              len(s.list_presets()) == len(BUILTIN_PRESETS))

        print("Records: favorites / listen_later / rejects / shortlist")
        s.add_record("favorites", rec("Eternity", "Drudkh", genres=["black metal"], action="favorite"))
        s.add_record("favorites", rec("Eternity", "Drudkh", action="favorite"))  # dup
        check("favorite saved (deduped)", len(s.list_records("favorites")) == 1)
        check("favorite record has timestamp + genres",
              s.list_records("favorites")[0].get("timestamp")
              and s.list_records("favorites")[0]["genres"] == ["black metal"])

        s.add_record("listen_later", rec("Shadows", "Clan", action="listen_later"))
        check("listen later saved", len(s.list_records("listen_later")) == 1)

        s.add_record("rejects", rec("Sunshine Pop", "Star", genres=["pop"], action="reject",
                                    reason="too poppy"))
        check("reject saved with reason", s.list_records("rejects")[0]["reason"] == "too poppy")

        s.add_record("shortlist", rec("Drift", "Stars of the Lid", action="shortlist"))
        s.add_record("shortlist", rec("Glitch", "Aphex Twin", action="shortlist"))
        check("shortlist has two", len(s.list_records("shortlist")) == 2)
        removed = s.remove_record("shortlist", "Aphex Twin", "Glitch")
        check("shortlist remove works", removed == 1 and len(s.list_records("shortlist")) == 1)

        print("ACTION_TO_KIND routing")
        check("favorite -> favorites", ACTION_TO_KIND["favorite"] == "favorites")
        check("never/reject -> rejects", ACTION_TO_KIND["never"] == "rejects"
              and ACTION_TO_KIND["reject"] == "rejects")

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
