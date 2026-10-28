-- 001 — Core schema: series catalogue, observations, ingestion log; read-only access for the site.
-- See BUILD_SPEC §5 and ADR 0005.
--
-- Schemas:
--   market  tables, written only by the worker (database owner). Not exposed by the Supabase API.
--   web     views the site may read, through the `web_reader` role. Not exposed by the Supabase API.
-- Row Level Security is enabled on every table with no policies, as a second barrier: even if a table
-- were exposed, the Supabase `anon` and `authenticated` roles would see no rows.

create schema market;
create schema web;
revoke all on schema market from public;
revoke all on schema web from public;

-- Series catalogue -------------------------------------------------------------------------------

create table market.series (
    id            bigint generated always as identity primary key,
    code          text not null unique check (code ~ '^[a-z0-9][a-z0-9_.-]*$'),
    name          text not null,
    commodity     text not null
                  check (commodity in ('crude', 'products', 'natgas', 'lng', 'lpg', 'power', 'fx', 'macro')),
    region        text not null,
    unit          text not null,       -- the source's unit; conversions happen in the worker's units module
    frequency     text not null check (frequency in ('hourly', 'daily', 'weekly', 'monthly')),
    source        text not null,       -- e.g. 'eia', 'gie_agsi'
    source_ref    text not null,       -- the provider's identifier (series ID, route + facets…)
    description   text not null default '',
    is_unofficial boolean not null default false,
    -- Spreads are only computed between series of the same kind (BUILD_SPEC §4). Null for non-prices.
    price_kind    text check (price_kind in ('spot', 'futures', 'index', 'assessment')),
    license       text not null,       -- confirmed from the provider's terms when the source is integrated
    license_url   text,
    attribution   text,                -- null = no attribution required
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table market.series is 'One row per series; synced from worker/catalog/*.yaml.';

-- Observations -----------------------------------------------------------------------------------

-- A missing observation is a missing row: never a null, a zero or an interpolated value.
-- `ts` is UTC. Daily, weekly and monthly values are stored at 00:00 UTC of their reference date.
create table market.observations (
    series_id   bigint not null references market.series (id) on delete restrict,
    ts          timestamptz not null,
    value       double precision not null
                check (value <> 'NaN'::double precision
                       and value <> 'Infinity'::double precision
                       and value <> '-Infinity'::double precision),
    ingested_at timestamptz not null default now(),
    primary key (series_id, ts)
);

-- Ingestion log ----------------------------------------------------------------------------------

create table market.ingest_runs (
    id            bigint generated always as identity primary key,
    source        text not null,
    started_at    timestamptz not null default now(),
    finished_at   timestamptz,
    status        text not null check (status in ('running', 'ok', 'partial', 'failed', 'skipped')),
    rows_written  integer not null default 0 check (rows_written >= 0),
    rows_rejected integer not null default 0 check (rows_rejected >= 0),
    error         text,
    check (finished_at is null or finished_at >= started_at)
);

create index ingest_runs_source_started_idx on market.ingest_runs (source, started_at desc);

alter table market.series enable row level security;
alter table market.observations enable row level security;
alter table market.ingest_runs enable row level security;

-- Views for the site -----------------------------------------------------------------------------

-- Largest normal interval between two observations, in days, per frequency. A longer interval is a gap.
-- Daily allows 5 days: business-day series skip weekends, and Easter (Good Friday and Easter Monday
-- closed) leaves a Thursday-to-Tuesday interval. Checked on ECB reference rates since 1999.
create function web.gap_threshold_days(frequency text) returns double precision
    language sql immutable
    return case frequency
        when 'hourly' then 1
        when 'daily' then 5
        when 'weekly' then 10
        when 'monthly' then 45
    end;

-- Catalogue with coverage statistics, for the /data page.
create view web.series_catalog as
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
    where i.days_since_previous > web.gap_threshold_days(s.frequency)
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
    coalesce(c.observation_count, 0) as observation_count,
    c.first_observation,
    c.last_observation,
    coalesce(g.gap_count, 0)         as gap_count,
    c.largest_interval_days
from market.series s
left join coverage c on c.series_id = s.id
left join gaps g on g.series_id = s.id
where s.is_active;

-- Recent ingestion runs (failures included), for the /data page.
create view web.ingest_runs_recent as
select id, source, started_at, finished_at, status, rows_written, rows_rejected, error
from market.ingest_runs
where started_at > now() - interval '30 days'
order by started_at desc;

-- Read-only role for the site --------------------------------------------------------------------

-- Created without login. The password is set outside the repository (Supabase SQL editor):
--   alter role web_reader with login password '…';
do $$
begin
    if not exists (select from pg_roles where rolname = 'web_reader') then
        create role web_reader nologin;
    end if;
end
$$;

grant usage on schema web to web_reader;
grant select on all tables in schema web to web_reader;
grant execute on function web.gap_threshold_days(text) to web_reader;
alter default privileges in schema web grant select on tables to web_reader;
