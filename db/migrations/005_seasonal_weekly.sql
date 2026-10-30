-- 005 — Seasonal comparison for weekly series (M4: US oil stocks, refinery runs, product supplied).
--
-- "vs 5Y" for weekly data means the same week over the five prior years (BUILD_SPEC §4). Weeks are
-- ISO weeks of the observation date, so EIA weeks (ending Friday) line up across years within a
-- few days. ISO week 53 exists in some years only: it is folded into week 52 so it has a norm (the
-- convention of the author's oil-tracker project); the later of the two values is kept for that
-- week. `years_count` shows how many prior years had a value. Years are ISO years, so dates that
-- belong to the previous year's last week are not mixed into the new year.

create function web.seasonal_weekly(p_code text, p_year integer, p_years integer default 5)
returns table (
    day          date,             -- Monday of the ISO week in 2001, for the shared seasonal x-axis
    min_value    double precision,
    max_value    double precision,
    mean_value   double precision,
    years_count  integer,
    current_value double precision
)
language sql stable
as $$
    -- One value per year and week: the latest observation, so a folded week 53 replaces week 52
    -- and every value shown is a stored observation (never an average of two weeks).
    with weekly as (
        select distinct on (year, week) year, week, value
        from (
            select
                extract(isoyear from o.ts at time zone 'UTC')::integer as year,
                least(extract(week from o.ts at time zone 'UTC')::integer, 52) as week,
                o.ts,
                o.value
            from web.observations o
            where o.code = p_code
              and extract(isoyear from o.ts at time zone 'UTC') between p_year - p_years and p_year
        ) points
        order by year, week, ts desc
    ),
    calendar as (
        select w as week from generate_series(1, 52) as w
    )
    select
        date '2001-01-01' + (c.week - 1) * 7,  -- 1 January 2001 was a Monday (ISO week 1)
        min(p.value) filter (where p.year < p_year),
        max(p.value) filter (where p.year < p_year),
        avg(p.value) filter (where p.year < p_year),
        count(p.value) filter (where p.year < p_year)::integer,
        max(p.value) filter (where p.year = p_year)
    from calendar c
    left join weekly p on p.week = c.week
    group by c.week
    order by c.week
$$;

grant execute on function web.seasonal_weekly(text, integer, integer) to web_reader;
