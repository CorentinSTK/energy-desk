from datetime import UTC, datetime
from typing import Any

import pytest

from worker.catalog import load_catalog
from worker.sources.entsog import parse_rows

SPEC = next(s for s in load_catalog("entsog").series if s.code == "entsog.dunkerque")


def row(**overrides: Any) -> dict[str, Any]:
    # Trimmed from a real response (2026-10-28).
    base = {
        "pointKey": "ITP-00045",
        "operatorKey": "FR-TSO-0003",
        "directionKey": "entry",
        "periodFrom": "2026-10-20T06:00:00+02:00",
        "value": 519537222,
        "unit": "kWh/d",
    }
    return {**base, **overrides}


def test_gas_day_is_stored_at_midnight_utc() -> None:
    (observation,) = parse_rows([row()], SPEC)
    assert observation.ts == datetime(2026, 10, 20, tzinfo=UTC)
    assert observation.value == 519537222.0


def test_other_operators_and_directions_are_ignored_never_summed() -> None:
    rows = [row(), row(operatorKey="XX-TSO-0001", value=1), row(directionKey="exit", value=2)]
    assert [o.value for o in parse_rows(rows, SPEC)] == [519537222.0]


def test_empty_values_are_missing() -> None:
    assert parse_rows([row(value=None), row(value="")], SPEC) == []


def test_unit_change_fails_loudly() -> None:
    with pytest.raises(ValueError, match="expected 'kWh/d'"):
        parse_rows([row(unit="MWh/d")], SPEC)
