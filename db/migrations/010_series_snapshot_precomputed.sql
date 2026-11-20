-- 010 — Precomputed series snapshots for the home page (ADR 0012).
--
-- web.series_snapshot (006) computed the move z-score, 5-year percentile and seasonal gap of each
-- requested series on every call: about 23 ms per series, about 500 ms per home page view. These
-- measures depend only on stored observations, which change only when the worker ingests, so they
-- are now computed for every series once per ingestion run, like the catalogue's coverage (009).
--
-- The calculation itself is unchanged: the 006 function is moved and renamed, not rewritten.
-- web.series_snapshot keeps its signature and returns the stored rows.

alter function web.series_snapshot(text[]) set schema market;
alter function market.series_snapshot(text[]) rename to compute_series_snapshot;
revoke execute on function market.compute_series_snapshot(text[]) from web_reader;

create materialized view market.series_snapshots as
select *
from market.compute_series_snapshot(array(select code from web.series_catalog));

-- Required by `refresh materialized view concurrently`.
create unique index series_snapshots_code on market.series_snapshots (code);

-- A materialized view cannot have Row Level Security: keep it out of reach of the Supabase API roles.
revoke all on market.series_snapshots from public;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on market.series_snapshots from anon, authenticated';
    end if;
end
$$;

-- The site reads the stored rows through a web view (owner's rights), as for every other table.
create view web.series_snapshots as
select * from market.series_snapshots;
grant select on web.series_snapshots to web_reader;

create function web.series_snapshot(p_codes text[])
returns table (
    code                   text,
    frequency              text,
    last_ts                timestamptz,
    last_value             double precision,
    prev_ts                timestamptz,
    prev_value             double precision,
    move_z                 double precision,
    move_count             integer,
    percentile_5y          double precision,
    history_count          integer,
    seasonal_mean          double precision,
    seasonal_years         integer,
    seasonal_deviation_pct double precision
)
language sql stable
as $$
    select s.code, s.frequency, s.last_ts, s.last_value, s.prev_ts, s.prev_value, s.move_z,
           s.move_count, s.percentile_5y, s.history_count, s.seasonal_mean, s.seasonal_years,
           s.seasonal_deviation_pct
    from web.series_snapshots s
    where s.code = any(p_codes)
    order by s.code
$$;

grant execute on function web.series_snapshot(text[]) to web_reader;
