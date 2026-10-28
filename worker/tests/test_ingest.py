import pytest

from worker import ingest


def test_unknown_source_fails_with_explicit_code(capsys: pytest.CaptureFixture[str]) -> None:
    assert ingest.main(["--source", "nope", "--dry-run"]) == ingest.EXIT_UNKNOWN_SOURCE
    assert "not yet implemented" in capsys.readouterr().out


def test_registered_source_receives_dry_run_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[bool] = []

    def fake(dry_run: bool) -> int:
        calls.append(dry_run)
        return ingest.EXIT_OK

    monkeypatch.setitem(ingest.SOURCES, "fake", fake)
    assert ingest.main(["--source", "fake", "--dry-run"]) == ingest.EXIT_OK
    assert calls == [True]


def test_source_is_required() -> None:
    with pytest.raises(SystemExit):
        ingest.parse_args([])
