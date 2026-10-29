-- 003 — Power (M3): half-hourly frequency and tighter gap thresholds for intraday series.
--
-- GB prices (Elexon market index) are published per half-hour settlement period, so series gain a
-- `half_hourly` frequency. Intraday gap thresholds were one day, which hid holes of a few hours: a
-- gap is now any interval longer than 1.5 periods. Timestamps are UTC, so clock changes do not create
-- false gaps.

alter table market.series drop constraint series_frequency_check;
alter table market.series add constraint series_frequency_check
    check (frequency in ('half_hourly', 'hourly', 'daily', 'weekly', 'monthly'));

create or replace function web.gap_threshold_days(frequency text) returns double precision
    language sql immutable
    return case frequency
        when 'half_hourly' then 0.75 / 24
        when 'hourly' then 1.5 / 24
        when 'daily' then 5
        when 'weekly' then 10
        when 'monthly' then 45
    end;
