from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources import smard
from worker.sources.smard import BASE_URL, SmardSource, chunks_from, parse_chunk

SPECS = {s.code: s for s in load_catalog("smard").series}
# Monday 2026-10-26 00:00 Europe/Berlin, the start of a real SMARD weekly chunk.
CHUNK = 1792969200000
HOUR_MS = 3_600_000


@pytest.fixture(autouse=True)
def no_pause(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(smard, "CHUNK_INTERVAL", 0)


def week(values: list[float | None], start: int = CHUNK) -> dict[str, list[list[float | None]]]:
    return {"series": [[start + i * HOUR_MS, v] for i, v in enumerate(values)]}


def test_nulls_are_missing_values_not_zero() -> None:
    points = parse_chunk([[CHUNK, 12.5], [CHUNK + HOUR_MS, None]])
    assert points == [(datetime(2026, 10, 25, 23, tzinfo=UTC), 12.5)]


def test_chunks_start_with_the_one_containing_the_start() -> None:
    week_ms = 7 * 24 * HOUR_MS
    stamps = [CHUNK - week_ms, CHUNK, CHUNK + week_ms]
    start = datetime(2026, 10, 28, tzinfo=UTC)
    assert chunks_from(stamps, start) == [CHUNK, CHUNK + week_ms]
    assert chunks_from(stamps, datetime(2000, 1, 1, tzinfo=UTC)) == stamps


@respx.mock
def test_hourly_and_daily_series_share_one_download() -> None:
    index = respx.get(f"{BASE_URL}/4169/DE-LU/index_hour.json").mock(
        return_value=httpx.Response(200, json={"timestamps": [CHUNK]})
    )
    # Two full days (26 and 27 October, Europe/Berlin), then a day still being published.
    values: list[float | None] = [float(h) for h in range(24)] + [50.0] * 24 + [60.0] * 5 + [None]
    data = respx.get(f"{BASE_URL}/4169/DE-LU/4169_DE-LU_hour_{CHUNK}.json").mock(
        return_value=httpx.Response(200, json=week(values))
    )
    source = SmardSource()
    with make_client() as client:
        hourly = source.fetch(client, SPECS["smard.de_lu.price_da"], date(2026, 10, 26))
        daily = source.fetch(client, SPECS["smard.de_lu.price_da_base"], date(2026, 10, 26))
    assert index.call_count == data.call_count == 1
    assert len(hourly) == 53
    assert [(o.ts, o.value) for o in daily] == [
        (datetime(2026, 10, 26, tzinfo=UTC), 11.5),
        (datetime(2026, 10, 27, tzinfo=UTC), 50.0),
    ]


@respx.mock
def test_backfill_starts_at_the_history_start() -> None:
    first = int(datetime(2019, 12, 30, 23, tzinfo=UTC).timestamp() * 1000)
    later = first + 7 * 24 * HOUR_MS
    respx.get(f"{BASE_URL}/410/DE/index_hour.json").mock(
        return_value=httpx.Response(
            200, json={"timestamps": [first - 7 * 24 * HOUR_MS, first, later]}
        )
    )
    old = respx.get(f"{BASE_URL}/410/DE/410_DE_hour_{first - 7 * 24 * HOUR_MS}.json")
    respx.get(f"{BASE_URL}/410/DE/410_DE_hour_{first}.json").mock(
        return_value=httpx.Response(200, json=week([60000.0] * 168, first))
    )
    respx.get(f"{BASE_URL}/410/DE/410_DE_hour_{later}.json").mock(
        return_value=httpx.Response(200, json=week([], later))
    )
    with make_client() as client:
        observations = SmardSource().fetch(client, SPECS["smard.de.load"], None)
    assert not old.called
    # Days before 1 January 2020 are dropped even when the chunk contains them.
    assert observations[0].ts == datetime(2020, 1, 1, tzinfo=UTC)
    assert observations[-1].ts == datetime(2020, 1, 6, tzinfo=UTC)  # chunk covers 31 Dec - 6 Jan
    assert {o.value for o in observations} == {60000.0}


def test_unknown_kind_fails_loudly() -> None:
    spec = SPECS["smard.de.load"].model_copy(update={"source_ref": "410|DE|weekly"})
    with pytest.raises(ValueError, match="unknown SMARD series kind"):
        smard.parse_ref(spec)


def test_catalogue_daily_series_use_the_daily_kind() -> None:
    for spec in SPECS.values():
        kind = spec.source_ref.split("|")[2]
        assert (spec.frequency, kind) in {("hourly", "hourly"), ("daily", "daily_mean")}, spec.code
    assert timedelta(hours=1) == smard.STEP
