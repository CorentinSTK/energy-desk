import httpx
import pytest
import respx

from worker import http_client
from worker.http_client import SourceHTTPError, get, make_client, redact

URL = "https://example.test/data"


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    """Retries wait between attempts; skip the waiting in tests."""
    monkeypatch.setattr(http_client.get.retry, "sleep", lambda _seconds: None)


def test_redact_masks_secret_parameters() -> None:
    text = "GET https://x.test/v2?api_key=abc123&frequency=daily&token=zzz"
    assert redact(text) == "GET https://x.test/v2?api_key=***&frequency=daily&token=***"


@respx.mock
def test_retries_server_errors_then_succeeds() -> None:
    route = respx.get(URL).mock(
        side_effect=[httpx.Response(503), httpx.Response(502), httpx.Response(200, text="ok")]
    )
    with make_client() as client:
        assert get(client, URL).text == "ok"
    assert route.call_count == 3


@respx.mock
def test_retries_rate_limit_using_retry_after() -> None:
    route = respx.get(URL).mock(
        side_effect=[httpx.Response(429, headers={"Retry-After": "2"}), httpx.Response(200)]
    )
    with make_client() as client:
        get(client, URL)
    assert route.call_count == 2


@respx.mock
def test_does_not_retry_client_errors_and_hides_keys() -> None:
    route = respx.get(URL).mock(return_value=httpx.Response(403, text="bad key"))
    with make_client() as client, pytest.raises(SourceHTTPError) as caught:
        get(client, URL, {"api_key": "SECRET"})
    assert route.call_count == 1
    assert caught.value.status_code == 403
    assert "SECRET" not in str(caught.value)


@respx.mock
def test_gives_up_after_max_attempts() -> None:
    route = respx.get(URL).mock(return_value=httpx.Response(500))
    with make_client() as client, pytest.raises(SourceHTTPError):
        get(client, URL)
    assert route.call_count == http_client.MAX_ATTEMPTS
