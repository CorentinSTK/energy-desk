import "server-only";

import { cacheLife } from "next/cache";

import { db, ISO_UTC } from "./db";

export type ForecastKind = "live" | "backtest";

/** One row of `web.forecast_scores` (migration 007): scored forecasts of one model version. */
export interface ForecastScore {
  modelId: string;
  version: string;
  kind: ForecastKind;
  horizon: number;
  n: number;
  mae: number;
  rmse: number;
  bias: number;
  maeNaive: number | null;
  maeSeasonal: number | null;
  /** 1 − MAE(model) / MAE(baseline), on the targets that baseline covers. Positive = better. */
  skillNaive: number | null;
  skillSeasonal: number | null;
  coverage90: number | null;
  nIntervals: number;
}

/** One forecast with its realised value (null until published). */
export interface ForecastRow {
  issuedAt: string;
  targetTs: string;
  horizon: number;
  point: number;
  lo90: number | null;
  hi90: number | null;
  realised: number | null;
  naive: number | null;
  seasonal: number | null;
  inputs: Record<string, unknown>;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getScores(modelId: string): Promise<ForecastScore[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select model_id, version, kind, horizon, n, mae, rmse, bias, mae_naive, mae_seasonal,
           skill_naive, skill_seasonal, coverage90, n_intervals
    from web.forecast_scores
    where model_id = ${modelId}
    order by kind, horizon
  `;
  return rows.map((r) => ({
    modelId: r.model_id as string,
    version: r.version as string,
    kind: r.kind as ForecastKind,
    horizon: Number(r.horizon),
    n: Number(r.n),
    mae: Number(r.mae),
    rmse: Number(r.rmse),
    bias: Number(r.bias),
    maeNaive: num(r.mae_naive),
    maeSeasonal: num(r.mae_seasonal),
    skillNaive: num(r.skill_naive),
    skillSeasonal: num(r.skill_seasonal),
    coverage90: num(r.coverage90),
    nIntervals: Number(r.n_intervals),
  }));
}

/** Forecasts of one model, kind and horizon whose target is on or after `fromIso`, oldest first. */
export async function getForecasts(
  modelId: string,
  kind: ForecastKind,
  horizon: number,
  fromIso: string,
): Promise<ForecastRow[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select to_char(issued_at at time zone 'UTC', ${ISO_UTC}) as issued_at,
           to_char(target_ts at time zone 'UTC', ${ISO_UTC}) as target_ts,
           horizon, point, lo90, hi90, realised,
           (baselines ->> 'naive')::double precision as naive,
           (baselines ->> 'seasonal')::double precision as seasonal,
           inputs
    from web.forecasts
    where model_id = ${modelId} and kind = ${kind} and horizon = ${horizon}
      and target_ts >= ${fromIso}::timestamptz
    order by target_ts, issued_at
  `;
  return rows.map(toRow);
}

/** The latest live forecasts of a model (every horizon of the last issue date). */
export async function getLatestLive(modelId: string): Promise<ForecastRow[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select to_char(issued_at at time zone 'UTC', ${ISO_UTC}) as issued_at,
           to_char(target_ts at time zone 'UTC', ${ISO_UTC}) as target_ts,
           horizon, point, lo90, hi90, realised,
           (baselines ->> 'naive')::double precision as naive,
           (baselines ->> 'seasonal')::double precision as seasonal,
           inputs
    from web.forecasts
    where model_id = ${modelId} and kind = 'live'
      and issued_at = (select max(issued_at) from web.forecasts
                       where model_id = ${modelId} and kind = 'live')
    order by horizon
  `;
  return rows.map(toRow);
}

function toRow(r: Record<string, unknown>): ForecastRow {
  return {
    issuedAt: r.issued_at as string,
    targetTs: r.target_ts as string,
    horizon: Number(r.horizon),
    point: Number(r.point),
    lo90: num(r.lo90),
    hi90: num(r.hi90),
    realised: num(r.realised),
    naive: num(r.naive),
    seasonal: num(r.seasonal),
    inputs: (r.inputs as Record<string, unknown>) ?? {},
  };
}
