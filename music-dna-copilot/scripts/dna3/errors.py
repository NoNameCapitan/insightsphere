"""User-facing error model.

Every failure the product layer surfaces is a ProductError with a stable code,
a plain-language title/message for normal users and an optional technical
`detail` that the UI only shows in Advanced mode. Raw tracebacks never reach
the page.
"""


class ProductError(Exception):
    STATUS = {
        "BAD_REQUEST": 400, "NOT_FOUND": 404, "CONFLICT": 409, "PAYLOAD_TOO_LARGE": 413,
        "NO_SOURCES": 409, "NO_DNA": 409, "NOT_ENOUGH_DATA": 409,
        "MALFORMED_IMPORT": 422, "UNSUPPORTED_FORMAT": 415, "DUPLICATE_IMPORT": 409,
        "REQUIRES_SETUP": 409, "AUTH_EXPIRED": 401, "OAUTH_FAILED": 401,
        "PROVIDER_UNAVAILABLE": 502, "RATE_LIMITED": 429, "PARTIAL_SYNC": 207,
        "RESOLVER_FAILED": 502, "CORRUPTED_DATA": 500, "OFFLINE": 503, "INTERNAL": 500,
    }

    def __init__(self, code, title, message, detail=None, **extra):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.title = title
        self.message = message
        self.detail = detail
        self.extra = extra

    @property
    def status(self):
        return self.STATUS.get(self.code, 400)

    def to_dict(self):
        out = {"code": self.code, "title": self.title, "message": self.message}
        if self.detail:
            out["detail"] = str(self.detail)[:2000]
        out.update(self.extra)
        return out


def bad_request(message, detail=None):
    return ProductError("BAD_REQUEST", "Something in that request was off", message, detail)


def not_found(what="That item"):
    return ProductError("NOT_FOUND", "Not found", f"{what} could not be found. It may have been deleted.")


def no_dna():
    return ProductError(
        "NO_DNA", "Your Music DNA isn't built yet",
        "Connect or import at least one music source, then build your DNA.")
