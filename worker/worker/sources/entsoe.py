"""ENTSO-E Transparency Platform (RESTful API, security token): cross-border physical flows.

Licence: only data on ENTSO-E's "List of data available for free re-use" (18 October 2023) may
be republished, under CC BY 4.0, crediting the source and stating changes. Physical flows
(Transparency Regulation art. 12.1.g, data item 18) are on the list. Not on it, so never ingested
here: generation per type and per unit, unavailability of generation units, actual load, day-ahead
prices, wind and solar forecasts. Exceptions on the list (Moldova, Turkey, some Ukraine items, the
BritNed, IFA and Nemo Link interconnectors) are outside the borders used here.

`source_ref` is "flow|<FROM>|<TO>": the net physical flow from FROM to TO, i.e. the flow FROM→TO
minus the flow TO→FROM, stored per complete Europe/Brussels day as the average power in MW
(worker.power). Positive means FROM exports to TO.

Checked live on 2026-11-25 (documentType A11; in_Domain receives, out_Domain sends):
- answers are XML Publication_MarketDocument; quantities in MW ("MAW"), resolution PT15M recently;
- curveType A03 ("variable sized blocks"): a position left out repeats the previous value, so a
  direction with no flow comes back as a single point of 0 covering the whole period;
- "no matching data" comes back as an Acknowledgement_MarketDocument: missing, never zero;
- answers can take tens of seconds: the client uses a longer timeout and one-year windows.
"""

import re
import time
from datetime import UTC, date, datetime, timedelta
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

import httpx

from worker.catalog import SeriesSpec
from worker.config import get_settings, require
from worker.http_client import USER_AGENT, get
from worker.power import Point, daily_means, day_ts
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://web-api.tp.entsoe.eu/api"
TZ = ZoneInfo("Europe/Brussels")
HISTORY_START = date(2019, 1, 1)
WINDOW = timedelta(days=365)  # the API allows at most one year per request
SLOT = timedelta(hours=1)
TIMEOUT = httpx.Timeout(180.0, connect=15.0)

# Bidding zones (EIC codes) of the borders ingested.
ZONES = {
    "DE_LU": "10Y1001A1001A82H",
    "FR": "10YFR-RTE------C",
    "NL": "10YNL----------L",
    "BE": "10YBE----------2",
    "AT": "10YAT-APG------L",
    "CH": "10YCH-SWISSGRIDZ",
    "PL": "10YPL-AREA-----S",
    "IT_NORTH": "10Y1001A1001A73I",
}

_RESOLUTION = re.compile(r"^PT(\d+)M$")


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child(element: ElementTree.Element, name: str) -> ElementTree.Element | None:
    return next((c for c in element if _local(c.tag) == name), None)


def _text(element: ElementTree.Element | None, name: str) -> str | None:
    found = _child(element, name) if element is not None else None
    return found.text if found is not None else None


def _instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def parse_points(xml: str) -> list[Point]:
    """Points (period start, MW) of every time series in a document. An acknowledgement ("no
    matching data") gives no points. curveType A03: omitted positions repeat the previous value."""
    root = ElementTree.fromstring(xml)
    if _local(root.tag) == "Acknowledgement_MarketDocument":
        return []
    points: list[Point] = []
    for series in (e for e in root if _local(e.tag) == "TimeSeries"):
        unit = _text(series, "quantity_Measure_Unit.name")
        if unit not in (None, "MAW"):
            raise ValueError(f"unexpected unit {unit!r}")
        curve = _text(series, "curveType") or "A01"
        for period in (e for e in series if _local(e.tag) == "Period"):
            interval = _child(period, "timeInterval")
            start, end = _text(interval, "start"), _text(interval, "end")
            match = _RESOLUTION.match(_text(period, "resolution") or "")
            if not (start and end and match):
                raise ValueError("period without interval or minute resolution")
            step = timedelta(minutes=int(match.group(1)))
            t0, t1 = _instant(start), _instant(end)
            count = int((t1 - t0) / step)
            given: dict[int, float] = {}
            for point in (e for e in period if _local(e.tag) == "Point"):
                given[int(_text(point, "position") or 0)] = float(_text(point, "quantity") or "nan")
            value: float | None = None
            for position in range(1, count + 1):
                if position in given:
                    value = given[position]
                elif curve != "A03":
                    continue  # A01: a missing position is missing
                if value is not None:
                    points.append((t0 + (position - 1) * step, value))
    return points


def net_flow(forward: list[Point], backward: list[Point]) -> list[Point]:
    """Forward minus backward, per timestamp present in both directions."""
    back = dict(backward)
    return [(ts, v - back[ts]) for ts, v in forward if ts in back]


def parse_ref(spec: SeriesSpec) -> tuple[str, str]:
    kind, origin, target = spec.source_ref.split("|")
    if kind != "flow" or origin not in ZONES or target not in ZONES:
        raise ValueError(f"{spec.code}: bad source_ref {spec.source_ref!r}")
    return origin, target


def _stamp(day: date) -> str:
    return datetime(day.year, day.month, day.day).strftime("%Y%m%d0000")


class EntsoeSource(Source):
    name = "entsoe"
    lookback = timedelta(days=10)
    request_interval = 1.0

    def client(self) -> httpx.Client:
        return httpx.Client(
            timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}, follow_redirects=True
        )

    def _flows(self, client: httpx.Client, origin: str, target: str, since: date) -> list[Point]:
        token = require(get_settings().entsoe_api_token, "ENTSOE_API_TOKEN")
        end = date.today() + timedelta(days=1)
        points: list[Point] = []
        start = since
        while start < end:
            stop = min(start + WINDOW, end)
            response = get(
                client,
                URL,
                {
                    "securityToken": token.strip().strip('"'),
                    "documentType": "A11",
                    "out_Domain": ZONES[origin],
                    "in_Domain": ZONES[target],
                    "periodStart": _stamp(start),
                    "periodEnd": _stamp(stop),
                },
            )
            points += parse_points(response.text)
            start = stop
            time.sleep(self.request_interval)
        return points

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        origin, target = parse_ref(spec)
        start = since or HISTORY_START
        forward = self._flows(client, origin, target, start)
        backward = self._flows(client, target, origin, start)
        means = daily_means(net_flow(forward, backward), TZ, SLOT)
        return [Observation(spec.code, day_ts(d), v) for d, v in means.items() if d >= start]
