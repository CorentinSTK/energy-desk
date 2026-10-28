-- 002 — Unofficial futures contracts (not readable by the site), observations and seasonal views.
-- See BUILD_SPEC §5 and ADR 0003.

-- Futures settlements -------------------------------------------------------------------------------

-- Raw settlements from an unofficial source (Yahoo Finance). Not redistributed: `web_reader` has no
-- access. The worker derives indicators from them (calendar spreads, percentiles), stored as series
-- with is_unofficial = true; only those reach the site.
create table market.futures_contracts (
    contract       text not null,     -- provider ticker, e.g. 'TTFZ26.NYM'
    root           text not null,     -- e.g. 'TTF'
    exchange       text not null,     -- the actual listing exchange, e.g. 'NYMEX'
    delivery_month date not null check (extract(day from delivery_month) = 1),
    ts             timestamptz not null,
    settle         double precision not null
                   check (settle <> 'NaN'::double precision
                          and settle <> 'Infinity'::double precision
                          and settle <> '-Infinity'::double precision),
    source         text not null,
    ingested_at    timestamptz not null default now(),
    primary key (contract, ts)
);

create index futures_contracts_root_ts_idx on market.futures_contracts (root, ts);

alter table market.futures_contracts enable row level security;

-- Observations for the site -------------------------------------------------------------------------

-- Every observation of every active series, addressed by series code. Unofficial series here are
-- derived indicators only; raw futures settlements stay in market.futures_contracts.
create view web.observations as
select s.code, o.ts, o.value
from market.observations o
join market.series s on s.id = o.series_id
where s.is_active;

-- Seasonal comparison for daily series ----------------------------------------------------------------

-- For each calendar day, the min, max and mean over the `p_years` years before `p_year` (the current
-- year is excluded, BUILD_SPEC §4), and the value in `p_year`.
-- Days are aligned on month and day, so 1 March is compared with 1 March in leap and non-leap years.
-- 29 February is left out: it exists in one year out of four and has no five-year norm.
-- `years_count` says how many prior years had a value on that day, so a thin norm is visible.
-- Reads web.observations (not market tables), so it runs with the caller's rights as web_reader.
create function web.seasonal_daily(p_code text, p_year integer, p_years integer default 5)
returns table (
    day          date,             -- the day in a fixed non-leap year (2001), for the x-axis
    min_value    double precision,
    max_value    double precision,
    mean_value   double precision,
    years_count  integer,
    current_value double precision
)
language sql stable
as $$
    with points as (
        select
            extract(year from o.ts at time zone 'UTC')::integer as year,
            make_date(2001, extract(month from o.ts at time zone 'UTC')::integer,
                      extract(day from o.ts at time zone 'UTC')::integer) as day,
            o.value
        from web.observations o
        where o.code = p_code
          and extract(year from o.ts at time zone 'UTC') between p_year - p_years and p_year
          and not (extract(month from o.ts at time zone 'UTC') = 2
                   and extract(day from o.ts at time zone 'UTC') = 29)
    ),
    calendar as (
        select d::date as day
        from generate_series(date '2001-01-01', date '2001-12-31', interval '1 day') as d
    )
    select
        c.day,
        min(p.value) filter (where p.year < p_year),
        max(p.value) filter (where p.year < p_year),
        avg(p.value) filter (where p.year < p_year),
        count(p.value) filter (where p.year < p_year)::integer,
        max(p.value) filter (where p.year = p_year)
    from calendar c
    left join points p on p.day = c.day
    group by c.day
    order by c.day
$$;

grant select on web.observations to web_reader;
grant execute on function web.seasonal_daily(text, integer, integer) to web_reader;
