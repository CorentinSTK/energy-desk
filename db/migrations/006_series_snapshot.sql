-- 006 — Latest-value snapshot of several series at once, for the home page map and "Today in energy".
--
-- The map compares very different things (storage, prices, flows) on one colour scale, so each
-- series is summarised by unit-free measures of its latest observation:
-- - move_z: the latest change divided by the standard deviation of the changes over the year before
--   it ("how unusual is today's move"); needs at least 20 earlier changes, else null.
-- - percentile_5y: share of observations in the five years up to the latest one that are at or below
--   it (0–100, the same rule as the site's percentileRank).
-- - seasonal_deviation_pct: distance from the mean of the same calendar day (daily series), ISO week
--   (weekly, week 53 folded into 52) or month (monthly) in the five years before the latest one's
--   year, in % of that mean. Intraday series have no seasonal measure.
-- Every input is a stored observation; nothing is filled. A measure without enough data is null and the
-- site shows "no data". Reads web views only, so it runs with the caller's rights as web_reader.

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
    with latest as (
        select c.code, c.frequency, l.last_ts, l.last_value, p.prev_ts, p.prev_value
        from web.series_catalog c
        cross join lateral (
            select o.ts as last_ts, o.value as last_value
            from web.observations o where o.code = c.code order by o.ts desc limit 1
        ) l
        left join lateral (
            select o.ts as prev_ts, o.value as prev_value
            from web.observations o where o.code = c.code and o.ts < l.last_ts
            order by o.ts desc limit 1
        ) p on true
        where c.code = any(p_codes)
    )
    select
        l.code, l.frequency, l.last_ts, l.last_value, l.prev_ts, l.prev_value,
        case
            when mv.n >= 20 and mv.sd > 0 and l.prev_value is not null
            then (l.last_value - l.prev_value) / mv.sd
        end,
        mv.n,
        pc.pct,
        pc.n,
        se.mean,
        se.years,
        case when se.mean is not null and se.mean <> 0
             then (l.last_value - se.mean) / abs(se.mean) * 100 end
    from latest l
    -- Changes between consecutive observations in the year before the latest change.
    left join lateral (
        select stddev_samp(d) as sd, count(d)::integer as n
        from (
            select o.value - lag(o.value) over (order by o.ts) as d
            from web.observations o
            where o.code = l.code
              and o.ts >= l.last_ts - interval '366 days'
              and o.ts < l.last_ts
        ) changes
    ) mv on true
    left join lateral (
        select 100.0 * count(*) filter (where o.value <= l.last_value) / count(*) as pct,
               count(*)::integer as n
        from web.observations o
        where o.code = l.code and o.ts > l.last_ts - interval '5 years' and o.ts <= l.last_ts
    ) pc on true
    left join lateral (
        select avg(v.value) as mean, count(*)::integer as years
        from (
            -- One value per prior year: the latest observation of the matching period.
            select distinct on (period_year) period_year, value
            from (
                select
                    case when l.frequency = 'weekly'
                         then extract(isoyear from o.ts at time zone 'UTC')
                         else extract(year from o.ts at time zone 'UTC') end::integer as period_year,
                    o.ts,
                    o.value
                from web.observations o
                where o.code = l.code
                  and case l.frequency
                      when 'daily' then
                          extract(month from o.ts at time zone 'UTC')
                              = extract(month from l.last_ts at time zone 'UTC')
                          and extract(day from o.ts at time zone 'UTC')
                              = extract(day from l.last_ts at time zone 'UTC')
                      when 'weekly' then
                          least(extract(week from o.ts at time zone 'UTC'), 52)
                              = least(extract(week from l.last_ts at time zone 'UTC'), 52)
                      when 'monthly' then
                          extract(month from o.ts at time zone 'UTC')
                              = extract(month from l.last_ts at time zone 'UTC')
                      else false
                  end
            ) matches
            where period_year between
                (case when l.frequency = 'weekly'
                      then extract(isoyear from l.last_ts at time zone 'UTC')
                      else extract(year from l.last_ts at time zone 'UTC') end)::integer - 5
                and
                (case when l.frequency = 'weekly'
                      then extract(isoyear from l.last_ts at time zone 'UTC')
                      else extract(year from l.last_ts at time zone 'UTC') end)::integer - 1
            order by period_year, ts desc
        ) v
    ) se on true
    order by l.code
$$;

grant execute on function web.series_snapshot(text[]) to web_reader;
