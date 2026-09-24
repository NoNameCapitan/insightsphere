#!/usr/bin/env python3
"""
lastfm_client.py
================
Tiny, stdlib-only Last.fm API client for read-only public data.

Uses only an API key + username (LASTFM_API_KEY / LASTFM_USERNAME). It never
uses a password, never uses the API secret, and implements no OAuth. All network
calls have timeouts and degrade to clear errors; missing configuration never
crashes the caller.

For offline testing, construct LastfmClient(transport=fn) where fn(params) ->
dict returns a canned API response. With no transport, a urllib-based transport
with a timeout is used.

API docs: https://www.last.fm/api
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_BASE = "https://ws.audioscrobbler.com/2.0/"
DEFAULT_TIMEOUT = 10

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "outputs" / "cache"
TAG_CACHE_PATH = CACHE_DIR / "lastfm_tags_cache.json"

TRACK_TAG_CONFIDENCE = 0.7   # track-level tags are the most specific
ARTIST_TAG_CONFIDENCE = 0.5  # artist-level tags are useful but broader
MIN_USEFUL_TAGS = 1          # below this a candidate is considered sparse


class LastfmError(Exception):
    """Any Last.fm configuration, network, or API error (caught by callers)."""


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _text(node, default=""):
    """Last.fm wraps many values as {'#text': '...'}; unwrap safely."""
    if isinstance(node, dict):
        return node.get("#text", default)
    return node if node is not None else default


class LastfmClient:
    def __init__(self, api_key=None, username=None, transport=None, timeout=DEFAULT_TIMEOUT,
                 cache_path=None):
        self.api_key = (api_key if api_key is not None else os.environ.get("LASTFM_API_KEY", "")).strip()
        self.username = (username if username is not None else os.environ.get("LASTFM_USERNAME", "")).strip()
        self.timeout = timeout
        self._transport = transport  # callable(params: dict) -> dict
        self.cache_path = Path(cache_path) if cache_path else TAG_CACHE_PATH
        self._cache = None  # lazy-loaded dict

    # -- configuration ------------------------------------------------------

    def config_status(self):
        api = bool(self.api_key)
        user = bool(self.username)
        if not api:
            message = "Last.fm API key is not configured. Add LASTFM_API_KEY to your .env file."
        elif not user:
            message = "Last.fm API key is set. Enter a username to import scrobbles."
        else:
            message = "Last.fm is ready."
        return {
            "api_key_present": api,
            "username_present": user,
            "ready": api,  # API usable; history additionally needs a username
            "message": message,
        }

    # -- low-level call -----------------------------------------------------

    def _call(self, method, **params):
        if not self.api_key:
            raise LastfmError("Last.fm API key is not configured.")
        query = {"method": method, "api_key": self.api_key, "format": "json"}
        query.update({k: v for k, v in params.items() if v is not None})
        try:
            if self._transport is not None:
                data = self._transport(query)
            else:
                url = API_BASE + "?" + urllib.parse.urlencode(query)
                req = urllib.request.Request(url, headers={"User-Agent": "MusicTasteRecommender/1.0"})
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
        except LastfmError:
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise LastfmError(f"Last.fm request failed: {exc}") from exc
        except (ValueError, json.JSONDecodeError) as exc:
            raise LastfmError(f"Last.fm returned invalid JSON: {exc}") from exc
        if isinstance(data, dict) and data.get("error"):
            raise LastfmError(f"Last.fm error {data.get('error')}: {data.get('message', 'unknown')}")
        if not isinstance(data, dict):
            raise LastfmError("Last.fm returned an unexpected response.")
        return data

    def _resolve_user(self, username):
        user = (username or self.username or "").strip()
        if not user:
            raise LastfmError("A Last.fm username is required for this request.")
        return user

    # -- history ------------------------------------------------------------

    def get_recent_tracks(self, username=None, limit=200, pages=1, from_ts=None, to_ts=None):
        """user.getRecentTracks with optional pagination for deep listening history."""
        user = self._resolve_user(username)
        pages = max(1, int(pages or 1))
        limit = max(1, min(int(limit or 200), 200))
        all_raw = []
        total_pages = pages
        for page in range(1, pages + 1):
            data = self._call("user.getRecentTracks", user=user, limit=limit, page=page,
                              **{"from": from_ts, "to": to_ts, "extended": 1})
            block = data.get("recenttracks") or {}
            raw_page = block.get("track") or []
            if isinstance(raw_page, dict): raw_page = [raw_page]
            all_raw.extend(raw_page)
            attr = block.get("@attr") or {}
            try: total_pages = int(attr.get("totalPages") or total_pages)
            except (TypeError, ValueError): pass
            if page >= total_pages or not raw_page: break
        raw = all_raw
        if isinstance(raw, dict):
            raw = [raw]
        tracks = []
        for item in raw:
            attr = item.get("@attr") or {}
            if attr.get("nowplaying") == "true":
                played_at = None
            else:
                date = item.get("date") or {}
                played_at = None
                uts = date.get("uts") if isinstance(date, dict) else None
                if uts:
                    try:
                        played_at = datetime.fromtimestamp(int(uts), timezone.utc).isoformat()
                    except (ValueError, OSError):
                        played_at = _text(date) or None
            name = item.get("name") or ""
            if not name:
                continue
            tracks.append({
                "track_name": name,
                "artist_name": _text(item.get("artist")),
                "album_name": _text(item.get("album")) or None,
                "played_at": played_at,
                "play_count": 1,
                "genres": [],
                "source": "lastfm",
                "source_url": item.get("url"),
                "source_track_id": item.get("mbid") or None,
                "import_confidence": 0.7,
            })
        return {
            "source": "lastfm",
            "exported_at": _now_iso(),
            "username": user,
            "tracks": tracks,
        }

    def get_top_tracks(self, username=None, period="overall", limit=100):
        """user.getTopTracks -> normalized seed tracks (with play_count)."""
        user = self._resolve_user(username)
        data = self._call("user.getTopTracks", user=user, period=period, limit=limit)
        raw = (data.get("toptracks") or {}).get("track") or []
        if isinstance(raw, dict):
            raw = [raw]
        out = []
        for item in raw:
            try:
                pc = int(item.get("playcount", 1))
            except (TypeError, ValueError):
                pc = 1
            out.append({
                "track_name": item.get("name", ""),
                "artist_name": _text(item.get("artist")),
                "play_count": max(1, pc),
                "source": "lastfm",
                "source_url": item.get("url"),
            })
        return out

    def get_top_artists(self, username=None, period="overall", limit=100):
        """user.getTopArtists -> normalized seed artists (with play_count)."""
        user = self._resolve_user(username)
        data = self._call("user.getTopArtists", user=user, period=period, limit=limit)
        raw = (data.get("topartists") or {}).get("artist") or []
        if isinstance(raw, dict):
            raw = [raw]
        out = []
        for item in raw:
            try:
                pc = int(item.get("playcount", 1))
            except (TypeError, ValueError):
                pc = 1
            out.append({
                "artist_name": item.get("name", ""),
                "play_count": max(1, pc),
                "source": "lastfm",
                "source_url": item.get("url"),
            })
        return out

    # -- discovery (candidate seeds) ---------------------------------------

    def get_similar_tracks(self, artist, track, limit=25):
        """track.getSimilar -> candidate dicts for the candidate engine."""
        if not artist or not track:
            return []
        data = self._call("track.getSimilar", artist=artist, track=track,
                          limit=limit, autocorrect=1)
        raw = (data.get("similartracks") or {}).get("track") or []
        if isinstance(raw, dict):
            raw = [raw]
        out = []
        for item in raw:
            name = item.get("name") or ""
            if not name:
                continue
            try:
                match = float(item.get("match", 0))
            except (TypeError, ValueError):
                match = 0.0
            out.append({
                "track_title": name,
                "artist": _text(item.get("artist")) or (item.get("artist") or {}).get("name", ""),
                "genres": [],
                "source": "lastfm_similar",
                "source_url": item.get("url"),
                "discovered_from": f"similar:{artist} - {track}",
                "match": match,
            })
        return out

    def get_similar_artists(self, artist, limit=25):
        """artist.getSimilar -> normalized similar-artist seeds."""
        if not artist:
            return []
        data = self._call("artist.getSimilar", artist=artist, limit=limit, autocorrect=1)
        raw = (data.get("similarartists") or {}).get("artist") or []
        if isinstance(raw, dict):
            raw = [raw]
        out = []
        for item in raw:
            name = item.get("name") or ""
            if not name:
                continue
            try:
                match = float(item.get("match", 0))
            except (TypeError, ValueError):
                match = 0.0
            out.append({
                "artist": name,
                "source": "lastfm_similar",
                "source_url": item.get("url"),
                "discovered_from": f"similar-artist:{artist}",
                "match": match,
            })
        return out


    # -- tag enrichment -----------------------------------------------------

    def _load_cache(self):
        if self._cache is not None:
            return self._cache
        self._cache = {}
        try:
            if self.cache_path.exists():
                data = json.loads(self.cache_path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    self._cache = data
        except (OSError, ValueError):
            self._cache = {}
        return self._cache

    def _cache_lookup(self, key):
        return self._load_cache().get(key)

    def _cache_store(self, key, entry):
        cache = self._load_cache()
        cache[key] = entry
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2),
                                       encoding="utf-8")
        except OSError:
            pass  # cache is best-effort; never block enrichment

    @staticmethod
    def _parse_tags(data, limit):
        toptags = data.get("toptags") if isinstance(data, dict) else None
        raw = (toptags or {}).get("tag") or []
        if isinstance(raw, dict):
            raw = [raw]
        tags = []
        for item in raw:
            name = (item.get("name") if isinstance(item, dict) else item) or ""
            name = str(name).strip().lower()
            if name and name not in tags:
                tags.append(name)
            if len(tags) >= limit:
                break
        return tags

    def get_track_top_tags(self, artist, track, limit=10, use_cache=True):
        """track.getTopTags -> normalized tag strings. [] on empty/error (no crash)."""
        if not artist or not track:
            return []
        key = f"track:{str(artist).strip().lower()}\t{str(track).strip().lower()}"
        if use_cache:
            ent = self._cache_lookup(key)
            if ent is not None:
                return list(ent.get("tags", []))
        try:
            data = self._call("track.getTopTags", artist=artist, track=track, autocorrect=1)
            tags = self._parse_tags(data, limit)
        except LastfmError:
            return []
        if use_cache:
            self._cache_store(key, {"tags": tags, "fetched_at": _now_iso(),
                                    "source": "track",
                                    "confidence": TRACK_TAG_CONFIDENCE if tags else 0.0})
        return tags

    def get_artist_top_tags(self, artist, limit=10, use_cache=True):
        """artist.getTopTags -> normalized tag strings. [] on empty/error (no crash)."""
        if not artist:
            return []
        key = f"artist:{str(artist).strip().lower()}"
        if use_cache:
            ent = self._cache_lookup(key)
            if ent is not None:
                return list(ent.get("tags", []))
        try:
            data = self._call("artist.getTopTags", artist=artist, autocorrect=1)
            tags = self._parse_tags(data, limit)
        except LastfmError:
            return []
        if use_cache:
            self._cache_store(key, {"tags": tags, "fetched_at": _now_iso(),
                                    "source": "artist",
                                    "confidence": ARTIST_TAG_CONFIDENCE if tags else 0.0})
        return tags

    def enrich_track_candidate(self, candidate, use_cache=True):
        """Fill a candidate's genres from Last.fm tags when sparse. Never raises.

        Adds: tag_source (existing|track|artist|none), tag_confidence, tag_warning.
        """
        existing = candidate.get("genres") or []
        if len(existing) >= MIN_USEFUL_TAGS:
            candidate.setdefault("tag_source", "existing")
            candidate.setdefault("tag_confidence", 0.6)
            return candidate
        artist = candidate.get("artist") or candidate.get("artist_name") or ""
        track = (candidate.get("track_title") or candidate.get("title")
                 or candidate.get("track_name") or "")
        try:
            tags = self.get_track_top_tags(artist, track, use_cache=use_cache) if (artist and track) else []
            if tags:
                candidate["genres"] = tags
                candidate["tag_source"] = "track"
                candidate["tag_confidence"] = TRACK_TAG_CONFIDENCE
                return candidate
            atags = self.get_artist_top_tags(artist, use_cache=use_cache) if artist else []
            if atags:
                candidate["genres"] = atags
                candidate["tag_source"] = "artist"
                candidate["tag_confidence"] = ARTIST_TAG_CONFIDENCE
                candidate["tag_warning"] = "Artist-level tags (less precise than track tags)."
                return candidate
        except Exception:
            candidate["tag_source"] = "none"
            candidate["tag_confidence"] = 0.0
            candidate["tag_warning"] = "Tag enrichment failed; using available metadata."
            return candidate
        candidate["tag_source"] = "none"
        candidate["tag_confidence"] = 0.0
        candidate["tag_warning"] = "No Last.fm tags found for this track."
        return candidate

    def batch_enrich_candidates(self, candidates, limit=50, use_cache=True):
        """Enrich up to `limit` sparse candidates. Bounded network use; cache + in-run
        dedup avoid duplicate lookups. Never raises."""
        enriched = 0
        for cand in candidates:
            if enriched >= limit:
                break
            if len(cand.get("genres") or []) >= MIN_USEFUL_TAGS:
                continue
            try:
                self.enrich_track_candidate(cand, use_cache=use_cache)
            except Exception:
                cand.setdefault("tag_source", "none")
                cand.setdefault("tag_confidence", 0.0)
            enriched += 1
        return candidates


def get_client(transport=None):
    """Convenience constructor reading env config."""
    return LastfmClient(transport=transport)


if __name__ == "__main__":
    c = LastfmClient()
    print(json.dumps(c.config_status(), indent=2))
