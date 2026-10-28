import pytest

from worker import ingest


def test_unknown_source_fails_with_explicit_code(capsys: pytest.CaptureFixture[str]) -> None:
    assert ingest.main(["--source", "nope", "--dry-run"]) == ingest.EXIT_UNKNOWN_SOURCE
    assert "not yet implemented" in capsys.readouterr().out


def test_source_is_required() -> None:
    with pytest.raises(SystemExit):
        ingest.parse_args([])


def test_options_are_parsed() -> None:
    args = ingest.parse_args(
        ["--source", "ecb", "--since", "2024-01-31", "--series", "fx.eurusd", "--backfill"]
    )
    assert args.since.isoformat() == "2024-01-31"
    assert args.series == ["fx.eurusd"]
    assert args.backfill
