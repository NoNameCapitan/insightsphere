#!/usr/bin/env python3
"""
genre_taxonomy.py
=================
Loader and operations for the deep genre taxonomy (data/genre_taxonomy.json).

Pure standard library. Provides alias normalization, family/subgenre lookup,
parent->child expansion, related/adjacent expansion, strict matching, genre
exclusion, and a taxonomy distance used by the recommendation scorer.

The taxonomy is a tree of *families* (e.g. "metal"), each with subgenres,
microgenres, aliases, mood/energy/valence ranges, typical contexts, related
genres, and distant/incompatible genres.

Canonical token model
----------------------
Every genre string normalizes to a lowercase canonical token. A token is one of:
    - a family name            ("metal")
    - a subgenre               ("atmospheric black metal")
    - a microgenre             ("blackgaze")
Aliases (and light surface variants) map onto these tokens.
"""

import json
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TAXONOMY_PATH = ROOT / "data" / "genre_taxonomy.json"


# ---------------------------------------------------------------------------
# Loading + index construction
# ---------------------------------------------------------------------------

def _surface(value):
    """Lowercase, collapse separators/whitespace for forgiving matching."""
    v = str(value).strip().lower()
    v = v.replace("&", " and ")
    v = re.sub(r"[\-_/]+", " ", v)
    v = re.sub(r"\s+", " ", v)
    return v.strip()


class GenreTaxonomy:
    def __init__(self, data):
        self.version = data.get("version", "")
        self.families = data.get("families", {})

        # canonical token -> family name
        self.token_to_family = {}
        # canonical token -> kind (family | subgenre | microgenre)
        self.token_kind = {}
        # surface form -> canonical token (covers names + aliases)
        self.surface_to_token = {}

        for family, info in self.families.items():
            self._register(family, family, "family")
            for alias in info.get("aliases", []):
                self.surface_to_token[_surface(alias)] = family
            for sub in info.get("subgenres", []):
                self._register(sub, family, "subgenre")
            for micro in info.get("microgenres", []):
                self._register(micro, family, "microgenre")

    def _register(self, token, family, kind):
        token = token.strip().lower()
        self.token_to_family[token] = family
        self.token_kind[token] = kind
        self.surface_to_token[_surface(token)] = token

    # -- normalization ------------------------------------------------------

    def normalize(self, genre):
        """Return the canonical token for a genre string, or None if unknown.

        Tries exact surface match first, then a contained-token heuristic
        (e.g. "atmo black metal raw" -> "atmospheric black metal" if present,
        else "black metal", else "metal")."""
        if not genre:
            return None
        s = _surface(genre)
        if s in self.surface_to_token:
            return self.surface_to_token[s]
        # try the longest known surface form contained in the input
        best = None
        for surf, token in self.surface_to_token.items():
            if surf and (surf in s or s in surf):
                if best is None or len(surf) > len(best[0]):
                    best = (surf, token)
        return best[1] if best else None

    def family_of(self, genre):
        token = self.normalize(genre)
        return self.token_to_family.get(token) if token else None

    def kind_of(self, genre):
        token = self.normalize(genre)
        return self.token_kind.get(token) if token else None

    # -- expansion ----------------------------------------------------------

    def expand_family(self, family):
        """All canonical tokens under a family (the family + subs + micros)."""
        info = self.families.get(family)
        if not info:
            # maybe a subgenre/microgenre was passed: resolve to its family
            fam = self.token_to_family.get(family.strip().lower())
            info = self.families.get(fam) if fam else None
            family = fam
        if not info:
            return set()
        out = {family}
        out.update(g.strip().lower() for g in info.get("subgenres", []))
        out.update(g.strip().lower() for g in info.get("microgenres", []))
        return out

    def expand_selection(self, selected):
        """Expand a user selection (families/subgenres/microgenres/aliases) into
        the full set of canonical tokens it directly covers (family selections
        pull in their whole subtree; subgenre/microgenre selections stay narrow)."""
        tokens = set()
        for sel in selected:
            token = self.normalize(sel)
            if not token:
                continue
            if self.token_kind.get(token) == "family":
                tokens |= self.expand_family(token)
            else:
                tokens.add(token)
        return tokens

    def related_tokens(self, selected):
        """Adjacent tokens: the related families/genres of each selected item,
        expanded to their subtrees, excluding the selection itself."""
        out = set()
        for sel in selected:
            token = self.normalize(sel)
            if not token:
                continue
            family = self.token_to_family.get(token)
            info = self.families.get(family, {})
            for rel in info.get("related_genres", []):
                rel_token = self.normalize(rel)
                if not rel_token:
                    continue
                if self.token_kind.get(rel_token) == "family":
                    out |= self.expand_family(rel_token)
                else:
                    out.add(rel_token)
        return out - self.expand_selection(selected)

    def distant_tokens(self, selected):
        out = set()
        for sel in selected:
            token = self.normalize(sel)
            family = self.token_to_family.get(token) if token else None
            info = self.families.get(family, {})
            for dist in info.get("incompatible_or_distant_genres", []):
                d = self.normalize(dist)
                if d:
                    out |= self.expand_family(d) if self.token_kind.get(d) == "family" else {d}
        return out

    # -- matching / filtering ----------------------------------------------

    def matches_selection(self, track_genres, selected):
        """True if any track genre falls within the selected subtree."""
        target = self.expand_selection(selected)
        if not target:
            return False
        return any(self.normalize(g) in target for g in track_genres)

    def matches_adjacent(self, track_genres, selected):
        adjacent = self.expand_selection(selected) | self.related_tokens(selected)
        return any(self.normalize(g) in adjacent for g in track_genres)

    def is_excluded(self, track_genres, excluded):
        """True if any track genre falls within an excluded family/subtree."""
        if not excluded:
            return False
        ex = self.expand_selection(excluded)
        # also treat an excluded family name literally even if not in selection map
        for e in excluded:
            tok = self.normalize(e)
            if tok:
                ex |= self.expand_family(tok) if self.token_kind.get(tok) == "family" else {tok}
        return any(self.normalize(g) in ex for g in track_genres)

    def distance(self, track_genres, selected):
        """Taxonomy distance in [0,1] between a track and the selection.

        0.0  exact token match (same genre/subgenre/microgenre)
        0.25 same family as a selected item (sibling)
        0.5  related/adjacent family
        0.85 distant/incompatible (declared)
        1.0  unrelated / unknown
        Returns the minimum distance across the track's genres.
        """
        if not selected:
            return 0.0
        target = self.expand_selection(selected)
        selected_families = {self.token_to_family.get(self.normalize(s)) for s in selected}
        selected_families.discard(None)
        related = self.related_tokens(selected)
        distant = self.distant_tokens(selected)

        best = 1.0
        for g in track_genres:
            token = self.normalize(g)
            if token is None:
                continue
            if token in target:
                return 0.0
            fam = self.token_to_family.get(token)
            if fam in selected_families:
                best = min(best, 0.25)
            elif token in related:
                best = min(best, 0.5)
            elif token in distant:
                best = min(best, 0.85)
        return best


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------

@lru_cache(maxsize=4)
def load_taxonomy(path=None):
    path = Path(path) if path else DEFAULT_TAXONOMY_PATH
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return GenreTaxonomy(data)


if __name__ == "__main__":
    tax = load_taxonomy()
    print(f"Loaded taxonomy v{tax.version}: {len(tax.families)} families, "
          f"{len(tax.token_to_family)} canonical tokens.")
    demo = ["dnb", "atmo black metal", "synth wave", "edm"]
    for d in demo:
        print(f"  {d!r:24} -> {tax.normalize(d)!r}  (family={tax.family_of(d)})")
