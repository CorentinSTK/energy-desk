from datetime import UTC, datetime, timedelta

import pytest

from worker.catalog import load_catalog
from worker.sources.entsoe import net_flow, parse_points, parse_ref

NS = "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3"


def doc(
    curve: str,
    points: dict[int, float],
    start: str = "2026-11-21T23:00Z",
    end: str = "2026-11-22T00:00Z",
    resolution: str = "PT15M",
) -> str:
    body = "".join(
        f"<Point><position>{p}</position><quantity>{q}</quantity></Point>"
        for p, q in points.items()
    )
    return (
        f'<Publication_MarketDocument xmlns="{NS}"><TimeSeries>'
        f"<quantity_Measure_Unit.name>MAW</quantity_Measure_Unit.name><curveType>{curve}</curveType>"
        f"<Period><timeInterval><start>{start}</start><end>{end}</end></timeInterval>"
        f"<resolution>{resolution}</resolution>{body}</Period></TimeSeries></Publication_MarketDocument>"
    )


T0 = datetime(2026, 11, 21, 23, tzinfo=UTC)


def test_a03_repeats_the_previous_value_for_omitted_positions() -> None:
    points = parse_points(doc("A03", {1: 100, 3: 50}))
    assert points == [(T0 + timedelta(minutes=15 * i), v) for i, v in enumerate([100, 100, 50, 50])]


def test_a03_single_zero_point_covers_the_period() -> None:
    assert [v for _, v in parse_points(doc("A03", {1: 0}))] == [0, 0, 0, 0]


def test_a01_leaves_missing_positions_missing() -> None:
    assert len(parse_points(doc("A01", {1: 100, 3: 50}))) == 2


def test_acknowledgement_means_no_data() -> None:
    ack = (
        '<Acknowledgement_MarketDocument xmlns="urn:x"><Reason><text>No matching data</text>'
        "</Reason></Acknowledgement_MarketDocument>"
    )
    assert parse_points(ack) == []


def test_unexpected_unit_fails() -> None:
    with pytest.raises(ValueError):
        parse_points(doc("A01", {1: 1}).replace("MAW", "MWH"))


def test_net_flow_keeps_common_timestamps_only() -> None:
    fwd = [(T0, 500.0), (T0 + timedelta(hours=1), 300.0)]
    back = [(T0, 100.0)]
    assert net_flow(fwd, back) == [(T0, 400.0)]


def test_catalogue_refs_are_valid_borders() -> None:
    for spec in load_catalog("entsoe").series:
        origin, target = parse_ref(spec)
        assert origin != target
