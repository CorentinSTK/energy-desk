import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { VerdictBadge } from "@/components/forecasts/verdict-badge";
import { ChartCardSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { type ForecastScore, getLatestLive, getScores } from "@/lib/data/forecasts";
import { attempt, loadContext, type PageContext } from "@/lib/data/page-context";
import { displayUnit } from "@/lib/display-units";
import { formatDate, formatNumber } from "@/lib/format";
import {
  FORECAST_MODELS,
  type ForecastModelInfo,
  formatSkill,
  headlineScore,
  verdict,
} from "@/lib/forecasts/models";

export const metadata: Metadata = {
  title: "Forecasts — Energy Desk",
  description:
    "Three energy forecasts stored when issued, never edited, and scored against simple baselines in backtests and live.",
};

export default function ForecastsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Forecasts</h1>
        <p className="text-text-secondary">
          The point is not to beat the market but to be honest and measurable. Every live forecast
          is stored when it is issued and never edited, then scored when the real value is
          published. Each model is compared with two simple baselines on the same targets; it is
          only said to beat them if it is at least 5% more accurate than each.
        </p>
      </div>
      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <Scoreboard />
      </Suspense>
    </main>
  );
}

async function Scoreboard() {
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "forecasts") : null;
  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Forecasts are unavailable"
            description="Our database did not respond. Try again in a few minutes."
          />
        </CardContent>
      </Card>
    );
  }
  const rows = await Promise.all(
    FORECAST_MODELS.map(async (model) => ({
      model,
      scores: await attempt(`${model.id} scores`, getScores(model.id)),
      latest: await attempt(`${model.id} latest`, getLatestLive(model.id)),
    })),
  );
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {rows.map(({ model, scores, latest }) => (
        <ModelCard key={model.id} model={model} scores={scores} latest={latest} ctx={ctx} />
      ))}
    </div>
  );
}

function ScoreLine({
  label,
  score,
  unit,
  factor,
  decimals,
}: {
  label: string;
  score: ForecastScore | undefined;
  unit: string;
  factor: number;
  decimals: number;
}) {
  return (
    <div className="space-y-1">
      <VerdictBadge verdict={verdict(score)} label={label} />
      {score && (
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          <dt className="text-muted-foreground">Mean absolute error</dt>
          <dd className="text-right tabular-nums">
            {formatNumber(score.mae * factor, decimals)} {unit}
          </dd>
          <dt className="text-muted-foreground">Skill vs naive</dt>
          <dd className="text-right tabular-nums">{formatSkill(score.skillNaive)}</dd>
          <dt className="text-muted-foreground">Skill vs seasonal</dt>
          <dd className="text-right tabular-nums">{formatSkill(score.skillSeasonal)}</dd>
          <dt className="text-muted-foreground">90% interval coverage</dt>
          <dd className="text-right tabular-nums">
            {score.coverage90 === null ? "—" : `${formatNumber(score.coverage90 * 100, 0)}%`}
          </dd>
          <dt className="text-muted-foreground">Scored forecasts</dt>
          <dd className="text-right tabular-nums">{formatNumber(score.n, 0)}</dd>
        </dl>
      )}
    </div>
  );
}

function ModelCard({
  model,
  scores,
  latest,
  ctx,
}: {
  model: ForecastModelInfo;
  scores: ForecastScore[] | null;
  latest: Awaited<ReturnType<typeof getLatestLive>> | null;
  ctx: PageContext;
}) {
  const { unit, factor } = displayUnit(ctx.series.get(model.targetCode)?.unit ?? "");
  const shownUnit = unit === "%" ? "pts" : unit;
  const headline = latest?.find((f) => f.horizon === model.headlineHorizon);
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">
            <Link href={`/forecasts/${model.id}`} className="hover:underline">
              {model.name}
            </Link>
          </h2>
          <p className="text-sm text-text-secondary">{model.target}.</p>
          <p className="text-xs text-muted-foreground">{model.cadence}.</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Latest live forecast</p>
          {headline ? (
            <>
              <p className="text-lg font-semibold tabular-nums">
                {formatNumber(headline.point * factor, model.decimals)}{" "}
                <span className="text-sm font-normal text-text-secondary">{unit}</span>
              </p>
              <p className="text-xs text-text-secondary">
                for {formatDate(headline.targetTs)}
                {headline.lo90 !== null &&
                  headline.hi90 !== null &&
                  `, 90% interval ${formatNumber(headline.lo90 * factor, model.decimals)}–${formatNumber(headline.hi90 * factor, model.decimals)}`}
                ; issued {formatDate(headline.issuedAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">No live forecast issued yet.</p>
          )}
        </div>
        {scores === null ? (
          <p className="text-sm text-negative">Scores could not be loaded.</p>
        ) : (
          <div className="space-y-3">
            <ScoreLine
              label="Live"
              score={headlineScore(scores, model, "live")}
              unit={shownUnit}
              factor={factor}
              decimals={model.decimals}
            />
            <ScoreLine
              label="Backtest"
              score={headlineScore(scores, model, "backtest")}
              unit={shownUnit}
              factor={factor}
              decimals={model.decimals}
            />
          </div>
        )}
        <Link
          href={`/forecasts/${model.id}`}
          className="inline-block text-sm text-primary underline underline-offset-2"
        >
          Method, history and every horizon →
        </Link>
      </CardContent>
    </Card>
  );
}
