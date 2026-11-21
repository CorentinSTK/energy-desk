"""market.shipping_events (migration 011): PortWatch disruption events, upserted and read-only."""

from datetime import date

import psycopg
import pytest

from worker.sources.portwatch import PortWatchSource, ShippingEvent

HORMUZ = ShippingEvent(
    event_id="10000004",
    code="HORMUZ-26",
    name="Trade Disruptions in the Strait of Hormuz",
    description=None,
    alert_level="RED",
    chokepoints=("chokepoint6",),
    starts_on=date(2026, 3, 1),
    ends_on=None,
)


def persist(conn: psycopg.Connection, *events: ShippingEvent) -> int:
    source = PortWatchSource()
    source._events = list(events)
    return source.persist(conn)


def test_events_are_upserted_as_published(conn: psycopg.Connection) -> None:
    assert persist(conn, HORMUZ) == 1
    ended = ShippingEvent(**{**HORMUZ.__dict__, "ends_on": date(2026, 12, 1)})
    persist(conn, ended)
    rows = conn.execute(
        "select code, name, chokepoints, starts_on, ends_on from web.shipping_events"
    ).fetchall()
    assert rows == [
        ("HORMUZ-26", HORMUZ.name, ["chokepoint6"], date(2026, 3, 1), date(2026, 12, 1))
    ]


def test_web_reader_reads_events_but_cannot_write(conn: psycopg.Connection) -> None:
    persist(conn, HORMUZ)
    conn.execute("set local role web_reader")
    assert conn.execute("select count(*) from web.shipping_events").fetchone() == (1,)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("select * from market.shipping_events")


def test_freight_is_a_known_commodity(conn: psycopg.Connection) -> None:
    conn.execute(
        "insert into market.series (code, name, commodity, region, unit, frequency, source,"
        " source_ref, license) values ('t.f', 'x', 'freight', 'x', 'vessels/d', 'daily',"
        " 'portwatch', 'x', 'x')"
    )
