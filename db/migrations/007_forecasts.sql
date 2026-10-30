-- 007 — Forecast registry (M6, BUILD_SPEC §6, ADR 0009).
--
-- Every forecast is stored when it is issued and never edited: a trigger refuses UPDATE and DELETE
-- on live forecasts. Each forecast is the predicted value of a catalogued series at one timestamp
-- (e.g. US crude stocks on a Friday, French daily load on a date), with its 90% interval and the
-- forecasts of its simple baselines, so model and baselines are scored on the same targets.
-- Scores are computed in views by joining the realised observation: nothing is copied, so a revised
-- observation is reflected in the score automatically.
-- Walk-forward backtests are stored with kind = 'backtest' and may be replaced when a new model version
-- is backtested; they are always reported separately from live forecasts.

create table market.forecast_models (
    id          text primary key check (id ~ '^[a-z0-9_]+$'),
    name        text not null,
    target_code text not null,      -- series code in market.series, the value being forecast
    horizon_unit text not null check (horizon_unit in ('day', 'week')),
    description text not null default '',
    created_at  timestamptz not null default now()
);

create table market.forecasts (
    id          bigint generated always as identity primary key,
    model_id    text not null references market.forecast_models (id),
    version     text not null,
    kind        text not null check (kind in ('live', 'backtest')),
    issued_at   timestamptz not null,   -- when the forecast was made (simulated for backtests)
    target_ts   timestamptz not null,   -- the observation timestamp being forecast
    horizon     integer not null check (horizon > 0),  -- in the model's horizon unit
    point       double precision not null
                check (point <> 'NaN'::double precision
                       and point <> 'Infinity'::double precision
                       and point <> '-Infinity'::double precision),
    lo90        double precision,
    hi90        double precision,
    -- Baseline forecasts for the same target, e.g. {"naive": 410.6, "seasonal": 412.3}.
    baselines   jsonb not null default '{}'::jsonb,
    -- What the forecast was made from (latest values used, weather forecast…), for traceability.
    inputs      jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    check (target_ts > issued_at),
    check ((lo90 is null) = (hi90 is null)),
    check (lo90 is null or (lo90 <= point and point <= hi90)),
    unique (model_id, version, kind, issued_at, target_ts)
);

create index forecasts_model_kind_idx on market.forecasts (model_id, kind, target_ts);

alter table market.forecast_models enable row level security;
alter table market.forecasts enable row level security;

-- Live forecasts are immutable: no correction after the fact, no deletion of bad forecasts.
create function market.refuse_live_forecast_change() returns trigger
    language plpgsql
as $$
begin
    if old.kind = 'live' then
        raise exception 'live forecasts cannot be changed or deleted (forecast %)', old.id
            using errcode = 'restrict_violation';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger forecasts_live_immutable
    before update or delete on market.forecasts
    for each row execute function market.refuse_live_forecast_change();

-- Forecasts with their realised value (null until the target observation is published).
create view web.forecasts as
select
    f.id,
    f.model_id,
    m.name as model_name,
    m.target_code,
    f.version,
    f.kind,
    f.issued_at,
    f.target_ts,
    f.horizon,
    f.point,
    f.lo90,
    f.hi90,
    f.baselines,
    f.inputs,
    o.value as realised
from market.forecasts f
join market.forecast_models m on m.id = f.model_id
left join web.observations o on o.code = m.target_code and o.ts = f.target_ts;

-- Scores per model, version, kind and horizon, on forecasts whose target has been published.
-- Skill against a baseline compares mean absolute errors on the same targets (rows where that
-- baseline exists): 1 − MAE(model) / MAE(baseline); positive means the model did better.
create view web.forecast_scores as
with scored as (
    select
        model_id, version, kind, horizon, point, lo90, hi90, realised,
        (baselines ->> 'naive')::double precision as naive,
        (baselines ->> 'seasonal')::double precision as seasonal
    from web.forecasts
    where realised is not null
),
summary as (
    select
        model_id, version, kind, horizon,
        count(*)::integer as n,
        avg(abs(point - realised)) as mae,
        sqrt(avg((point - realised) ^ 2)) as rmse,
        avg(point - realised) as bias,
        avg(abs(point - realised)) filter (where naive is not null) as mae_on_naive_rows,
        avg(abs(naive - realised)) as mae_naive,
        avg(abs(point - realised)) filter (where seasonal is not null) as mae_on_seasonal_rows,
        avg(abs(seasonal - realised)) as mae_seasonal,
        (avg(case when realised between lo90 and hi90 then 1.0 else 0.0 end)
            filter (where lo90 is not null))::double precision as coverage90,
        count(*) filter (where lo90 is not null)::integer as n_intervals
    from scored
    group by model_id, version, kind, horizon
)
select
    model_id, version, kind, horizon, n, mae, rmse, bias, mae_naive, mae_seasonal,
    case when mae_naive > 0 then 1 - mae_on_naive_rows / mae_naive end as skill_naive,
    case when mae_seasonal > 0 then 1 - mae_on_seasonal_rows / mae_seasonal end as skill_seasonal,
    coverage90,
    n_intervals
from summary;

create view web.forecast_models as
select id, name, target_code, horizon_unit, description from market.forecast_models;

grant select on web.forecasts, web.forecast_scores, web.forecast_models to web_reader;
