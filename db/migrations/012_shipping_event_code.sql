-- 012 — PortWatch's short event code (e.g. "HORMUZ-26", "RED SEA TENSIONS"), used to label events on
-- the freight charts where the full name does not fit.

alter table market.shipping_events add column code text;

create or replace view web.shipping_events as
select event_id, name, description, alert_level, chokepoints, starts_on, ends_on, source, code
from market.shipping_events;
