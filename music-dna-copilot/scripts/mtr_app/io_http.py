"""
mtr_app.io_http
===============
Stdlib-only HTTP request parsing for the local interface, with upload/body
size limits so a huge paste or file can't exhaust memory. No external deps.
"""

import json
import os
from urllib.parse import parse_qs
from email.parser import BytesParser
from email.policy import default as email_default_policy

import os as _os

MAX_UPLOAD_BYTES = int(_os.environ.get("MTR_MAX_UPLOAD_BYTES", 64 * 1024 * 1024))  # Takeout files can be large; localhost only

MAX_JSON_BODY_BYTES = int(_os.environ.get("MTR_MAX_JSON_BYTES", 4 * 1024 * 1024))

MAX_TRACKS = int(_os.environ.get("MTR_MAX_TRACKS", 100000))

class FieldValue:
    def __init__(self, value="", filename=None, data=b""):
        self.value = value
        self.filename = filename
        self.data = data

class RequestTooLargeError(ValueError):
    """Raised when an upload or request body exceeds the configured limit."""

def _read_limited_body(handler, max_bytes):
    """Read the request body, rejecting anything over max_bytes.

    Checks the declared Content-Length first (cheap rejection) and also caps
    the actual read so a lying/streamed length can't exhaust memory.
    """
    try:
        length = int(handler.headers.get("Content-Length", 0))
    except (TypeError, ValueError):
        length = 0
    if length > max_bytes:
        raise RequestTooLargeError(
            f"Request body is {length} bytes, over the {max_bytes}-byte limit."
        )
    # Read at most max_bytes + 1 so we can detect an under-declared length.
    raw = handler.rfile.read(min(length, max_bytes + 1)) if length else b""
    if len(raw) > max_bytes:
        raise RequestTooLargeError(f"Request body exceeds the {max_bytes}-byte limit.")
    return raw

def parse_post_fields(handler):
    """Parse urlencoded or multipart form data without external dependencies."""
    content_type = handler.headers.get("Content-Type", "")
    raw = _read_limited_body(handler, MAX_UPLOAD_BYTES)
    length = len(raw)

    if content_type.startswith("multipart/form-data"):
        mime = (
            f"Content-Type: {content_type}\r\n"
            f"Content-Length: {length}\r\n"
            "MIME-Version: 1.0\r\n\r\n"
        ).encode("utf-8") + raw
        message = BytesParser(policy=email_default_policy).parsebytes(mime)
        fields = {}
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            filename = part.get_filename()
            payload = part.get_payload(decode=True) or b""
            if filename:
                fields[name] = FieldValue(value="", filename=filename, data=payload)
            else:
                charset = part.get_content_charset() or "utf-8"
                fields[name] = FieldValue(value=payload.decode(charset, errors="replace"))
        return fields

    parsed = parse_qs(raw.decode("utf-8", errors="replace"))
    return {k: FieldValue(value=v[0] if v else "") for k, v in parsed.items()}

def read_json_body(handler):
    raw = _read_limited_body(handler, MAX_JSON_BODY_BYTES)
    return json.loads(raw.decode("utf-8", errors="replace"))
