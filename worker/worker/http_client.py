"""Shared HTTP client: timeouts, bounded retries with backoff, polite rate-limit handling.

Retried: network errors, timeouts, HTTP 5xx, and HTTP 429 (waiting for `Retry-After` when given,
capped). Not retried: other 4xx (a bad key or a bad request will not fix itself).
Secrets passed as query parameters are masked in every error message.
"""

import re
from typing import Any

import httpx
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)

USER_AGENT = "energy-desk/0.1 (+https://github.com/CorentinSTK/energy-desk)"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)
MAX_ATTEMPTS = 4
MAX_RETRY_AFTER_SECONDS = 60.0

_SECRET_PARAMS = re.compile(r"(?i)\b(api_key|apikey|key|token|securitytoken)=[^&\s]+")


def redact(text: str) -> str:
    """Mask secret query parameters, e.g. `api_key=abc` → `api_key=***`."""
    return _SECRET_PARAMS.sub(lambda m: f"{m.group(1)}=***", text)


class SourceHTTPError(Exception):
    """An HTTP failure with secrets removed from the message."""

    def __init__(
        self, message: str, status_code: int | None = None, retry_after: float | None = None
    ):
        super().__init__(redact(message))
        self.status_code = status_code
        self.retry_after = retry_after


def make_client(headers: dict[str, str] | None = None) -> httpx.Client:
    return httpx.Client(
        timeout=TIMEOUT,
        headers={"User-Agent": USER_AGENT, **(headers or {})},
        follow_redirects=True,
    )


def _is_retryable(error: BaseException) -> bool:
    if isinstance(error, httpx.TransportError):
        return True
    if isinstance(error, SourceHTTPError) and error.status_code is not None:
        return error.status_code == 429 or error.status_code >= 500
    return False


def _parse_retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return min(float(value), MAX_RETRY_AFTER_SECONDS)
    except ValueError:
        return None  # HTTP-date form: fall back to exponential backoff


_backoff = wait_exponential_jitter(initial=1, max=30)


def _wait(state: RetryCallState) -> float:
    """Honour Retry-After on 429; otherwise exponential backoff with jitter."""
    error = state.outcome.exception() if state.outcome else None
    if isinstance(error, SourceHTTPError) and error.retry_after is not None:
        return error.retry_after
    return float(_backoff(state))


@retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(MAX_ATTEMPTS),
    wait=_wait,
    reraise=True,
)
def get(client: httpx.Client, url: str, params: dict[str, Any] | None = None) -> httpx.Response:
    """GET with retries. Raises SourceHTTPError (redacted) on a non-2xx response."""
    response = client.get(url, params=params)
    if response.is_success:
        return response
    raise SourceHTTPError(
        f"HTTP {response.status_code} from {response.request.url}: {response.text[:300]}",
        status_code=response.status_code,
        retry_after=_parse_retry_after(response.headers.get("Retry-After")),
    )


def get_json(client: httpx.Client, url: str, params: dict[str, Any] | None = None) -> Any:
    return get(client, url, params).json()
