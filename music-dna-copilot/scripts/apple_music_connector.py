#!/usr/bin/env python3
"""Apple Music live-connector preparation.
No private keys are embedded. This module exposes capability/config state and
normalization hooks; live requests remain disabled until developer credentials
and user authorization are supplied by the operator.
"""
import os
from provider_adapter import PROVIDERS

def config_status(env=None):
    env=env or os.environ
    team=bool(env.get("APPLE_MUSIC_TEAM_ID")); key=bool(env.get("APPLE_MUSIC_KEY_ID")); private=bool(env.get("APPLE_MUSIC_PRIVATE_KEY_PATH"))
    return {"provider":"apple_music","developer_configured":team and key and private,
            "user_authorized":False,"live_enabled":False,
            "missing":[n for n,v in (("APPLE_MUSIC_TEAM_ID",team),("APPLE_MUSIC_KEY_ID",key),("APPLE_MUSIC_PRIVATE_KEY_PATH",private)) if not v],
            "capabilities":list(PROVIDERS["apple_music"].capabilities),
            "note":"Live transport intentionally remains off until credentials + Music User Token authorization are configured."}
