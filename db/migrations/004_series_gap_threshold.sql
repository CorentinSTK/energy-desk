-- 004 — Per-series gap threshold.
--
-- The daily threshold (5 days) suits business-day series (prices skip weekends and Easter). Power load,
-- generation and prices are published for every calendar day, so one missing day is a gap there. A
-- series may now set its own largest normal interval; null keeps the frequency's default.

alter table market.series
    add column gap_threshold_days double precision check (gap_threshold_days > 0);

-- Same view as in 001, with the per-series threshold taking precedence.
create or replace view web.series_catalog as
with intervals as (
    select
        o.series_id,
        o.ts,
        extract(epoch from o.ts - lag(o.ts) over (partition by o.series_id order by o.ts)) / 86400.0
            as days_since_previous
    from market.observations o
),
coverage as (
    select
        i.series_id,
        count(*)                   as observation_count,
        min(i.ts)                  as first_observation,
        max(i.ts)                  as last_observation,
        max(i.days_since_previous) as largest_interval_days
    from intervals i
    group by i.series_id
),
gaps as (
    select i.series_id, count(*) as gap_count
    from intervals i
    join market.series s on s.id = i.series_id
    where i.days_since_previous
        > coalesce(s.gap_threshold_days, web.gap_threshold_days(s.frequency))
    group by i.series_id
)
select
    s.code,
    s.name,
    s.commodity,
    s.region,
    s.unit,
    s.frequency,
    s.source,
    s.source_ref,
    s.description,
    s.is_unofficial,
    s.price_kind,
    s.license,
    s.license_url,
    s.attribution,
    s.publication_lag_days,
    coalesce(c.observation_count, 0) as observation_count,
    c.first_observation,
    c.last_observation,
    coalesce(g.gap_count, 0)         as gap_count,
    c.largest_interval_days
from market.series s
left join coverage c on c.series_id = s.id
left join gaps g on g.series_id = s.id
where s.is_active;
