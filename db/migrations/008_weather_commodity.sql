-- 008 — Weather series (M6): temperatures that drive the French power demand forecast are stored as
-- series with their own category, so they are not mistaken for a market.

alter table market.series drop constraint series_commodity_check;
alter table market.series add constraint series_commodity_check
    check (commodity in ('crude', 'products', 'natgas', 'lng', 'lpg', 'power', 'fx', 'macro', 'weather'));
