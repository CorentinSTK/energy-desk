from datetime import UTC, date, datetime
from io import BytesIO
from typing import Any

import httpx
import pytest
import respx
from openpyxl import Workbook

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.ec_wob import (
    URL,
    BulletinFormatError,
    EcWobSource,
    observations_for,
    parse_sheet,
)

SPECS = {s.code: s for s in load_catalog("ec_wob").series}
DE_DIESEL = SPECS["ec_wob.de.diesel.with_tax"]


def sheet_rows(de_diesel: list[Any], unit: str = "1000 l") -> list[tuple[Any, ...]]:
    """The layout of the real workbook (2026-10-30), trimmed to two areas."""
    header = (
        "Consumer prices of petroleum products inclusive of duties and taxes",
        "CTR",
        "EU_price_with_tax_euro95",
        "EU_price_with_tax_diesel",
        "CTR",
        "DE_price_with_tax_euro95",
        "DE_price_with_tax_diesel",
    )
    labels = (
        None,
        None,
        "Euro-super 95  (I)",
        "Gas oil automobile",
        None,
        "Euro-super 95",
        "Gas oil",
    )
    units = ("Date", None, "1000 l", "1000 l", None, "1000 l", unit)
    dates = [datetime(2026, 10, 26), datetime(2026, 10, 19), datetime(2026, 10, 5)]
    data = [
        (d, "EU_", 1954.0, 2146.2, "DE_", 2167, v) for d, v in zip(dates, de_diesel, strict=True)
    ]
    return [header, labels, units, *data, ("Notes:", None, None, None, None, None, None)]


def test_columns_are_read_by_name_newest_last() -> None:
    columns, units = parse_sheet(sheet_rows([2298, 2280.5, None]))
    observations = observations_for(columns, units, DE_DIESEL, None)
    assert [(o.ts, o.value) for o in observations] == [
        (datetime(2026, 10, 19, tzinfo=UTC), 2280.5),
        (datetime(2026, 10, 26, tzinfo=UTC), 2298.0),
    ]


def test_since_filters_older_bulletins() -> None:
    columns, units = parse_sheet(sheet_rows([2298, 2280.5, 2250]))
    observations = observations_for(columns, units, DE_DIESEL, date(2026, 10, 19))
    assert [o.ts.day for o in observations] == [19, 26]


def test_a_unit_change_fails_loudly() -> None:
    columns, units = parse_sheet(sheet_rows([2298, 2280.5, 2250], unit="t"))
    with pytest.raises(BulletinFormatError, match="unit"):
        observations_for(columns, units, DE_DIESEL, None)


def test_a_non_numeric_price_fails_loudly() -> None:
    columns, units = parse_sheet(sheet_rows([2298, "n.a.", 2250]))
    with pytest.raises(BulletinFormatError, match="non-numeric"):
        observations_for(columns, units, DE_DIESEL, None)


def test_a_truncated_sheet_fails_loudly() -> None:
    with pytest.raises(BulletinFormatError, match="rows"):
        parse_sheet([("header",)])


def test_a_missing_column_fails_loudly() -> None:
    columns, units = parse_sheet(sheet_rows([2298, 2280.5, 2250]))
    with pytest.raises(BulletinFormatError, match="not found"):
        observations_for(columns, units, SPECS["ec_wob.fr.diesel.with_tax"], None)


@respx.mock
def test_the_workbook_is_downloaded_once_per_run() -> None:
    workbook = Workbook()
    with_tax = workbook.active
    assert with_tax is not None
    with_tax.title = "Prices with taxes"
    for row in sheet_rows([2298, 2280.5, 2250]):
        with_tax.append(row)
    without_tax = workbook.create_sheet("Prices wo taxes")
    for row in sheet_rows([1439, 1420, 1400]):
        without_tax.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    route = respx.get(URL).mock(return_value=httpx.Response(200, content=buffer.getvalue()))

    source = EcWobSource()
    with make_client() as client:
        diesel = source.fetch(client, DE_DIESEL, None)
        petrol = source.fetch(client, SPECS["ec_wob.de.euro95.with_tax"], None)
    assert [o.value for o in diesel] == [2250.0, 2280.5, 2298.0]
    assert [o.value for o in petrol] == [2167.0, 2167.0, 2167.0]
    assert route.call_count == 1
