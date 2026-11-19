-- 009 — Precomputed coverage for the series catalogue (ADR 0012).
--
-- web.series_catalog counted observations and gaps with a window function over the whole
-- observations table on every read: about 2.5 s from the site's region, paid by every page (source
-- footers and freshness read the catalogue, and web.series_snapshot reads it too). Observations only
-- change when the worker ingests, so the same figures are now computed once per ingestion run, in a
-- materialized view the worker refreshes at the end of each run (store.refresh_coverage).
--
-- The view keeps the same columns and the same definitions as in 004: only where the coverage
-- figures come from changes. A series added since the last refresh shows 0 observations until the
-- next run, exactly as a series without observations does.

create materialized view market.series_coverage as
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
    c.series_id,
    c.observation_count,
    c.first_observation,
    c.last_observation,
    coalesce(g.gap_count, 0) as gap_count,
    c.largest_interval_days
from coverage c
left join gaps g on g.series_id = c.series_id;

-- Required by `refresh materialized view concurrently`, which keeps the old rows readable while the
-- new ones are computed.
create unique index series_coverage_series_id on market.series_coverage (series_id);

-- A materialized view cannot have Row Level Security: keep it out of reach of the Supabase API roles.
-- The site reads it only through web.series_catalog, which runs with its owner's rights.
revoke all on market.series_coverage from public;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on market.series_coverage from anon, authenticated';
    end if;
end
$$;

create or replace view web.series_catalog as
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
    coalesce(c.gap_count, 0)         as gap_count,
    c.largest_interval_days
from market.series s
left join market.series_coverage c on c.series_id = s.id
where s.is_active;
