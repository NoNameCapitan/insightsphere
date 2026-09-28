"""Minimal ES256 (ECDSA P-256 + SHA-256) JWT signing in pure Python.

Apple Music developer tokens are ES256 JWTs signed with the .p8 key from the
Apple Developer account. The app is standard-library only, so this module
implements exactly what that needs: parse a PKCS#8 P-256 private key and sign.
Nonces follow RFC 6979 (deterministic), so no randomness can leak the key.
Signing happens once per six months; speed is irrelevant.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

# NIST P-256 domain parameters.
P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
A = P - 3
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
G = (0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
     0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5)

EC_PUBLIC_KEY_OID = bytes.fromhex("2a8648ce3d0201")       # 1.2.840.10045.2.1
P256_OID = bytes.fromhex("2a8648ce3d030107")               # 1.2.840.10045.3.1.7


class KeyError_(ValueError):
    pass


def _add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    (x1, y1), (x2, y2) = p1, p2
    if x1 == x2 and (y1 + y2) % P == 0:
        return None
    if p1 == p2:
        lam = (3 * x1 * x1 + A) * pow(2 * y1, -1, P) % P
    else:
        lam = (y2 - y1) * pow(x2 - x1, -1, P) % P
    x3 = (lam * lam - x1 - x2) % P
    return x3, (lam * (x1 - x3) - y1) % P


def _mul(k, point=G):
    result, addend = None, point
    while k:
        if k & 1:
            result = _add(result, addend)
        addend = _add(addend, addend)
        k >>= 1
    return result


# -- DER (just enough for PKCS#8 / SEC1 EC keys) ------------------------------

def _der_read(buf, pos):
    tag = buf[pos]
    length = buf[pos + 1]
    pos += 2
    if length & 0x80:
        n = length & 0x7F
        length = int.from_bytes(buf[pos:pos + n], "big")
        pos += n
    return tag, buf[pos:pos + length], pos + length


def _der_children(content):
    out, pos = [], 0
    while pos < len(content):
        tag, value, pos = _der_read(content, pos)
        out.append((tag, value))
    return out


def private_key_from_pem(pem: str) -> int:
    """Return the P-256 private scalar from an Apple .p8 (PKCS#8) or SEC1 PEM."""
    lines = [ln.strip() for ln in str(pem).strip().splitlines()]
    body = "".join(ln for ln in lines if ln and not ln.startswith("-----"))
    try:
        der = base64.b64decode(body, validate=False)
        tag, seq, _ = _der_read(der, 0)
        if tag != 0x30:
            raise KeyError_("not a DER sequence")
        items = _der_children(seq)
        if len(items) >= 3 and items[1][0] == 0x30 and items[2][0] == 0x04:
            algo = _der_children(items[1][1])
            oids = [v for t, v in algo if t == 0x06]
            if EC_PUBLIC_KEY_OID not in oids or P256_OID not in oids:
                raise KeyError_("the key is not an EC P-256 key")
            _t, ec_seq, _ = _der_read(items[2][1], 0)
            items = _der_children(ec_seq)
        # SEC1 ECPrivateKey: SEQ { INT 1, OCTET STRING key, ... }
        octets = [v for t, v in items if t == 0x04]
        if not octets:
            raise KeyError_("no private key inside")
        d = int.from_bytes(octets[0], "big")
    except KeyError_:
        raise
    except Exception as exc:
        raise KeyError_(f"could not read the .p8 key ({exc})") from exc
    if not 1 <= d < N:
        raise KeyError_("private key out of range")
    return d


def _rfc6979_k(d, h1):
    x = d.to_bytes(32, "big")
    h = (int.from_bytes(h1, "big") % N).to_bytes(32, "big")
    v, k = b"\x01" * 32, b"\x00" * 32
    k = hmac.new(k, v + b"\x00" + x + h, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    k = hmac.new(k, v + b"\x01" + x + h, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    while True:
        v = hmac.new(k, v, hashlib.sha256).digest()
        cand = int.from_bytes(v, "big")
        if 1 <= cand < N:
            return cand
        k = hmac.new(k, v + b"\x00", hashlib.sha256).digest()
        v = hmac.new(k, v, hashlib.sha256).digest()


def sign(d: int, message: bytes) -> bytes:
    """Raw r||s (64 bytes), the JOSE signature format."""
    h1 = hashlib.sha256(message).digest()
    z = int.from_bytes(h1, "big")
    while True:
        k = _rfc6979_k(d, h1)
        r = _mul(k)[0] % N
        s = pow(k, -1, N) * (z + r * d) % N
        if r and s:
            return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def public_key(d: int):
    return _mul(d)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def jwt(header: dict, claims: dict, d: int) -> str:
    signing_input = _b64(json.dumps(header, separators=(",", ":")).encode()) + "." + \
        _b64(json.dumps(claims, separators=(",", ":")).encode())
    return signing_input + "." + _b64(sign(d, signing_input.encode("ascii")))


APPLE_MAX_TTL = 15777000  # six months, Apple's documented maximum


def apple_developer_token(team_id: str, key_id: str, private_key_pem: str, ttl=APPLE_MAX_TTL, now=None) -> str:
    d = private_key_from_pem(private_key_pem)
    iat = int(now if now is not None else time.time())
    return jwt({"alg": "ES256", "kid": key_id.strip()},
               {"iss": team_id.strip(), "iat": iat, "exp": iat + int(ttl)}, d)


def jwt_expiry(token: str):
    """exp claim of a JWT, without verifying it (used to warn before expiry)."""
    try:
        part = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        return int(claims.get("exp")) if claims.get("exp") else None
    except Exception:
        return None
