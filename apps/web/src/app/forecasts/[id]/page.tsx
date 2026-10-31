import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { ErrorState } from "@/components/error-state";
import { VerdictBadge } from "@/components/forecasts/verdict-badge";
import { ChartCardSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { chartInfo } from "@/lib/data/chart-info";
import { isDatabaseConfigured } from "@/lib/data/db";
import { type ForecastRow, getForecasts, getLatestLive, getScores } from "@/lib/data/forecasts";
import { attempt, daysAgo, loadContext, type PageContext, seriesOf } from "@/lib/data/page-context";
import { displayUnit } from "@/lib/display-units";
import { formatChange, formatDate, formatNumber } from "@/lib/format";
import {
  FORECAST_MODELS,
  type ForecastModelInfo,
  formatSkill,
  headlineScore,
  modelInfo,
  verdict,
} from "@/lib/forecasts/models";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 320;

// The three models are known in advance, so the id is checked before streaming starts: an unknown
// id gets a real 404 status.
export function generateStaticParams() {
  return FORECAST_MODELS.map((m) => ({ id: m.id }));
}
const HISTORY_DAYS = 2 * 365;

export async function generateMetadata({
  params,
}: PageProps<"/forecasts/[id]">): Promise<Metadata> {
  const model = modelInfo((await params).id);
  return {
    title: model ? `${model.name} — Forecasts — Energy Desk` : "Forecast — Energy Desk",
    description: model?.target,
  };
}

export default async function ForecastPage({ params, searchParams }: PageProps<"/forecasts/[id]">) {
  const model = modelInfo((await params).id);
  if (!model) notFound();
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm">
          <Link href="/forecasts" className="text-muted-foreground hover:underline">
            ← All forecasts
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{model.name}</h1>
        <p className="text-text-secondary">
          {model.target}. {model.cadence}.
        </p>
      </div>
      <Suspense fallback={<ChartCardSkeleton height={CHART_HEIGHT} />}>
        <ForecastDetail model={model} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ForecastDetail({
  model,
  searchParams,
}: {
  model: ForecastModelInfo;
  searchParams: PageProps<"/forecasts/[id]">["searchParams"];
}) {
  const query = await searchParams;
  const requested = Number(typeof query.horizon === "string" ? query.horizon : NaN);
  const horizon = model.horizons.includes(requested) ? requested : model.headlineHorizon;
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "forecast") : null;
  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="This forecast is unavailable"
            description="Our database did not respond. Try again in a few minutes."
          />
        </CardContent>
      </Card>
    );
  }
  const from = daysAgo(ctx.now, HISTORY_DAYS);
  const [scores, latest, backtest, live] = await Promise.all([
    attempt("scores", getScores(model.id)),
    attempt("latest", getLatestLive(model.id)),
    attempt("backtest", getForecasts(model.id, "backtest", horizon, from)),
    attempt("live", getForecasts(model.id, "live", horizon, from)),
  ]);
  const { unit, factor } = displayUnit(ctx.series.get(model.targetCode)?.unit ?? "");
  const errorUnit = unit === "%" ? "pts" : unit;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <VerdictBadge
          verdict={verdict(scores ? headlineScore(scores, model, "live") : undefined)}
          label="Live"
        />
        <VerdictBadge
          verdict={verdict(scores ? headlineScore(scores, model, "backtest") : undefined)}
          label="Backtest"
        />
      </div>

      <LatestForecasts model={model} latest={latest} unit={unit} factor={factor} />

      {model.horizons.length > 1 && (
        <nav aria-label="Horizon" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Horizon</span>
          {model.horizons.map((h) => (
            <Link
              key={h}
              href={
                h === model.headlineHorizon
                  ? `/forecasts/${model.id}`
                  : `/forecasts/${model.id}?horizon=${h}`
              }
              scroll={false}
              aria-current={h === horizon ? "true" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted",
                h === horizon && "border-primary bg-muted font-medium",
              )}
            >
              {h} {model.horizonUnit}
              {h > 1 ? "s" : ""}
            </Link>
          ))}
        </nav>
      )}

      <HistoryChart
        model={model}
        ctx={ctx}
        horizon={horizon}
        backtest={backtest}
        live={live}
        unit={unit}
        factor={factor}
      />

      <ScoresTable model={model} scores={scores} unit={errorUnit} factor={factor} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 text-sm">
            <h2 className="text-base font-semibold">How it works</h2>
            {model.method.map((p) => (
              <p key={p} className="text-text-secondary">
                {p}
              </p>
            ))}
            <h3 className="font-medium">Baselines</h3>
            <ul className="list-disc space-y-1 pl-5 text-text-secondary">
              <li>
                <span className="text-foreground">Naive:</span> {model.baselines.naive}
              </li>
              <li>
                <span className="text-foreground">Seasonal:</span> {model.baselines.seasonal}
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 text-sm">
            <h2 className="text-base font-semibold">Limits</h2>
            <ul className="list-disc space-y-1 pl-5 text-text-secondary">
              {model.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
              <li>
                Backtests are walk-forward: each past forecast is made only from data published at
                its issue date, with the model refitted on that date (on all earlier data, or the
                last three years for the demand model), but with today&apos;s revised values where a
                source revises.
              </li>
            </ul>
            <p className="text-text-secondary">
              Target data:{" "}
              <Link href={model.href} className="text-primary underline underline-offset-2">
                market page
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function LatestForecasts({
  model,
  latest,
  unit,
  factor,
}: {
  model: ForecastModelInfo;
  latest: ForecastRow[] | null;
  unit: string;
  factor: number;
}) {
  const inputs = latest?.[0]?.inputs ?? {};
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-base font-semibold">Latest live forecast</h2>
        {!latest || latest.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No live forecast issued yet. The first one is issued by the scheduled job; backtest
            results are shown below.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Issued {formatDate(latest[0].issuedAt)}. Stored as issued and never edited.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Target</th>
                    <th className="py-1 pr-3 text-right font-medium">Forecast ({unit})</th>
                    <th className="py-1 pr-3 text-right font-medium">90% interval</th>
                    <th className="py-1 pr-3 text-right font-medium">Naive</th>
                    <th className="py-1 pr-3 text-right font-medium">Seasonal</th>
                    <th className="py-1 text-right font-medium">Realised</th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {latest.map((f) => (
                    <tr key={f.targetTs}>
                      <td className="py-1 pr-3">{formatDate(f.targetTs)}</td>
                      <td className="py-1 pr-3 text-right font-medium">
                        {formatNumber(f.point * factor, model.decimals)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {f.lo90 === null || f.hi90 === null
                          ? "—"
                          : `${formatNumber(f.lo90 * factor, model.decimals)}–${formatNumber(f.hi90 * factor, model.decimals)}`}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {formatNumber(f.naive === null ? null : f.naive * factor, model.decimals)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {formatNumber(
                          f.seasonal === null ? null : f.seasonal * factor,
                          model.decimals,
                        )}
                      </td>
                      <td className="py-1 text-right">
                        {f.realised === null
                          ? "not yet"
                          : formatNumber(f.realised * factor, model.decimals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Inputs of this forecast
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                {Object.entries(inputs).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground">{key.replaceAll("_", " ")}</dt>
                    <dd className="break-all tabular-nums">{JSON.stringify(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryChart({
  model,
  ctx,
  horizon,
  backtest,
  live,
  unit,
  factor,
}: {
  model: ForecastModelInfo;
  ctx: PageContext;
  horizon: number;
  backtest: ForecastRow[] | null;
  live: ForecastRow[] | null;
  unit: string;
  factor: number;
}) {
  const scale = (rows: ForecastRow[], pick: (r: ForecastRow) => number | null) =>
    rows.flatMap((r): [string, number][] => {
      const v = pick(r);
      return v === null ? [] : [[r.targetTs, v * factor]];
    });
  const all = [...(backtest ?? []), ...(live ?? [])].sort((a, b) =>
    a.targetTs.localeCompare(b.targetTs),
  );
  const realised = [...new Map(scale(all, (r) => r.realised)).entries()];
  const failed = backtest === null || live === null;
  const empty = all.length === 0;
  return (
    <ChartCard
      title={`Forecast against outcome, ${horizon} ${model.horizonUnit}${horizon > 1 ? "s" : ""} ahead`}
      takeaway={
        live && live.length > 0
          ? `${live.length} live forecast${live.length > 1 ? "s" : ""} at this horizon over the period shown.`
          : "No live forecast scored at this horizon yet: the chart shows the walk-forward backtest."
      }
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            Each point is placed at its target date. The backtest line is what the model would have
            forecast at the time, from the data published then; the live line is forecasts actually
            stored on their issue date. The outcome is the published value.
          </p>
        </>
      }
      info={chartInfo(seriesOf(ctx, model.targetCode), ctx.extractionDates, ctx.now, {
        source: "Energy Desk forecasts",
        unit,
      })}
      status={failed ? "error" : empty ? "empty" : "ready"}
      height={CHART_HEIGHT}
    >
      <MultiLineChart
        series={[
          { name: "Outcome", data: realised, colorIndex: 6 },
          { name: "Backtest forecast", data: scale(backtest ?? [], (r) => r.point), colorIndex: 1 },
          { name: "Live forecast", data: scale(live ?? [], (r) => r.point), colorIndex: 0 },
        ]}
        unit={unit}
        decimals={model.decimals}
        height={CHART_HEIGHT}
        ariaLabel={`${model.name}: forecasts and outcomes over the last two years`}
      />
    </ChartCard>
  );
}

function ScoresTable({
  model,
  scores,
  unit,
  factor,
}: {
  model: ForecastModelInfo;
  scores: Awaited<ReturnType<typeof getScores>> | null;
  unit: string;
  factor: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-base font-semibold">Scores</h2>
        <p className="text-xs text-muted-foreground">
          Mean absolute error and bias in {unit}. Skill = 1 − error of the model ÷ error of the
          baseline on the same targets: positive means the model did better. A good 90% interval
          contains the outcome about 90% of the time.
        </p>
        {scores === null ? (
          <p className="text-sm text-negative">Scores could not be loaded.</p>
        ) : scores.length === 0 ? (
          <p className="text-sm text-text-secondary">No scored forecasts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Kind</th>
                  <th className="py-1 pr-3 font-medium">Horizon</th>
                  <th className="py-1 pr-3 text-right font-medium">Scored</th>
                  <th className="py-1 pr-3 text-right font-medium">Mean abs. error</th>
                  <th className="py-1 pr-3 text-right font-medium">Bias</th>
                  <th className="py-1 pr-3 text-right font-medium">Skill vs naive</th>
                  <th className="py-1 pr-3 text-right font-medium">Skill vs seasonal</th>
                  <th className="py-1 text-right font-medium">90% coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {scores.map((s) => (
                  <tr key={`${s.kind}-${s.version}-${s.horizon}`}>
                    <td className="py-1 pr-3">
                      {s.kind === "live" ? "Live" : "Backtest"} (v{s.version})
                    </td>
                    <td className="py-1 pr-3">
                      {s.horizon} {model.horizonUnit}
                      {s.horizon > 1 ? "s" : ""}
                    </td>
                    <td className="py-1 pr-3 text-right">{formatNumber(s.n, 0)}</td>
                    <td className="py-1 pr-3 text-right">
                      {formatNumber(s.mae * factor, model.decimals)}
                    </td>
                    <td className="py-1 pr-3 text-right">
                      {formatChange(s.bias * factor, model.decimals)}
                    </td>
                    <td className="py-1 pr-3 text-right">{formatSkill(s.skillNaive)}</td>
                    <td className="py-1 pr-3 text-right">{formatSkill(s.skillSeasonal)}</td>
                    <td className="py-1 text-right">
                      {s.coverage90 === null ? "—" : `${formatNumber(s.coverage90 * 100, 0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
