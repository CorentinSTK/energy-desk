-- 011 — Freight phase (ADR 0013): chokepoint transit series and the disruption events that explain
-- them, both from IMF PortWatch.
--
-- Transits are ordinary series (counts and estimated tonnes per day) under a new `freight` category.
-- Disruption events are not observations: PortWatch publishes them as named periods (e.g.
-- "HORMUZ-26", from 1 Mar 2026), stored here as published and shown on the freight charts.

alter table market.series drop constraint series_commodity_check;
alter table market.series add constraint series_commodity_check
    check (commodity in ('crude', 'products', 'natgas', 'lng', 'lpg', 'power', 'fx', 'macro', 'weather',
                         'freight'));

create table market.shipping_events (
    event_id     text primary key,                 -- PortWatch eventid
    name         text not null,                    -- PortWatch htmlname
    description  text,
    alert_level  text,                             -- as published (GREEN, ORANGE, RED)
    chokepoints  text[] not null,                  -- PortWatch ids, e.g. {chokepoint6}
    starts_on    date not null,
    ends_on      date,                             -- null while the event is ongoing
    source       text not null default 'portwatch',
    ingested_at  timestamptz not null default now()
);
alter table market.shipping_events enable row level security;

create view web.shipping_events as
select event_id, name, description, alert_level, chokepoints, starts_on, ends_on, source
from market.shipping_events;
grant select on web.shipping_events to web_reader;
