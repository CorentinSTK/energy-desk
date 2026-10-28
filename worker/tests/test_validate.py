import math
from datetime import UTC, datetime, timedelta

from worker.catalog import SeriesSpec
from worker.validate import Observation, summarise_rejections, validate

NOW = datetime(2026, 10, 28, 12, tzinfo=UTC)
SPEC = SeriesSpec(
    code="test.price",
    name="Test",
    commodity="crude",
    region="US",
    unit="$/bbl",
    frequency="daily",
    source_ref="X",
    plausible_min=-50,
    plausible_max=300,
)
SPECS = {SPEC.code: SPEC}


def obs(value: float, days_ago: int = 1, code: str = SPEC.code) -> Observation:
    return Observation(code, NOW - timedelta(days=days_ago), value)


def reasons(observations: list[Observation]) -> list[str]:
    return [r.reason for r in validate(observations, SPECS, NOW).rejected]


def test_valid_rows_pass() -> None:
    result = validate([obs(70.0), obs(-37.6, days_ago=2)], SPECS, NOW)  # WTI went negative in 2020
    assert len(result.valid) == 2
    assert result.rejected == []


def test_each_problem_is_rejected_with_a_reason() -> None:
    naive = Observation(SPEC.code, datetime(2026, 1, 1), 70.0)
    assert reasons([naive]) == ["timestamp without time zone"]
    assert reasons([obs(70.0, days_ago=-3)]) == ["timestamp in the future"]
    assert reasons([obs(math.nan)]) == ["non-finite value"]
    assert reasons([obs(5000.0)]) == ["outside plausible range [-50.0, 300.0]"]
    assert reasons([obs(70.0, code="other")]) == ["unknown series"]


def test_duplicates_keep_the_first_row() -> None:
    result = validate([obs(70.0), obs(71.0)], SPECS, NOW)
    assert [o.value for o in result.valid] == [70.0]
    assert [r.reason for r in result.rejected] == ["duplicate timestamp"]


def test_summary_counts_reasons() -> None:
    result = validate([obs(5000.0), obs(6000.0, days_ago=2), obs(math.inf, days_ago=3)], SPECS, NOW)
    text = summarise_rejections(result.rejected)
    assert "non-finite value: 1" in text
    assert "outside plausible range [-50.0, 300.0]: 2" in text
