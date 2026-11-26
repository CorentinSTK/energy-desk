import { ChartCard } from "@/components/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { CurveChart } from "@/components/charts/curve-chart";
import { ComputedSeasonalCard } from "@/components/markets/computed-seasonal-card";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, getPointsMany } from "@/lib/data/series";
import { formatNumber } from "@/lib/format";
import { hourlyProfile, negativeHoursByMonth } from "@/lib/power/hourly";

import type { PowerZone } from "./data";

const HEIGHT = 280;
const PROFILE_DAYS = 30;
const NEGATIVE_MONTHS = 12;
const DE_TZ = "Europe/Berlin";
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}h`);

/** Average price by hour of the day: last 30 days against the same 30 days a year earlier. */
export async function PriceShape({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const code = zone.price.intraday;
  const tz = zone.id === "fr" ? "Europe/Paris" : DE_TZ;
  const end = ctx.now.getTime();
  const from = daysAgo(ctx.now, PROFILE_DAYS);
  const lastYearFrom = new Date(end - (365 + PROFILE_DAYS) * 86_400_000).toISOString();
  const lastYearTo = new Date(end - 365 * 86_400_000).toISOString();
  const all = await attempt(`${zone.id} hourly profile`, getPoints(code, lastYearFrom));
  const recent = all?.filter(([ts]) => ts >= from) ?? [];
  const before = all?.filter(([ts]) => ts < lastYearTo) ?? [];
  const now = hourlyProfile(recent, tz);
  const then = hourlyProfile(before, tz);
  const valid = now.filter((v): v is number => v !== null);
  const low = valid.length ? Math.min(...valid) : null;
  const high = valid.length ? Math.max(...valid) : null;
  const lowHour = low === null ? -1 : now.indexOf(low);
  const highHour = high === null ? -1 : now.indexOf(high);

  return (
    <ChartCard
      title={`What shape does a ${zone.label} power day have?`}
      takeaway={
        low !== null && high !== null
          ? `Over the last ${PROFILE_DAYS} days, power was cheapest around ${HOURS[lowHour]} (${formatNumber(low, 0)} €/MWh on average) and dearest around ${HOURS[highHour]} (${formatNumber(high, 0)} €/MWh).`
          : undefined
      }
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            The average day-ahead price for each hour of the day ({tz.replace("_", " ")} time) over
            the last {PROFILE_DAYS} days, and over the same {PROFILE_DAYS} days a year earlier. A
            midday dip is the sign of solar output; an evening peak, of demand when the sun has set.
          </p>
          <p className="font-medium text-foreground">Caveats</p>
          <p>
            Since October 2025 each hourly value is the mean of four quarter-hour prices. Hours not
            published are left out of the average.
          </p>
        </>
      }
      info={chartInfo(seriesOf(ctx, code), ctx.extractionDates, ctx.now, {
        source: "SMARD",
        unit: "€/MWh",
      })}
      status={all === null ? "error" : recent.length === 0 ? "empty" : "ready"}
      height={HEIGHT}
    >
      <CurveChart
        tenors={HOURS}
        series={[
          { name: `Last ${PROFILE_DAYS} days`, values: now, colorIndex: 4 },
          { name: "Same days a year earlier", values: then, colorIndex: 6 },
        ]}
        unit="€/MWh"
        decimals={0}
        height={HEIGHT}
        ariaLabel={`${zone.label} average day-ahead price by hour of the day, last ${PROFILE_DAYS} days and a year earlier`}
      />
    </ChartCard>
  );
}

const NEGATIVE_ZONES = [
  { code: "smard.de_lu.price_da", name: "Germany-Luxembourg", colorIndex: 0 },
  { code: "smard.fr.price_da", name: "France", colorIndex: 4 },
];

/** Hours with a negative day-ahead price, per month, Germany-Luxembourg and France. */
export async function NegativeHours({ ctx }: { ctx: PageContext }) {
  const from = new Date(
    Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth() - NEGATIVE_MONTHS + 1, 1) - 86_400_000,
  ).toISOString();
  const codes = NEGATIVE_ZONES.map((z) => z.code);
  const loaded = await attempt("negative hours", getPointsMany(codes, from));
  const counts = NEGATIVE_ZONES.map((z) => negativeHoursByMonth(loaded?.get(z.code) ?? [], DE_TZ));
  const months = [...new Set(counts.flatMap((c) => c.map((r) => r.month)))]
    .sort()
    .slice(-NEGATIVE_MONTHS);
  const label = (m: string) =>
    new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
      new Date(`${m}-01T00:00:00Z`),
    );
  const totals = counts.map((c) =>
    c.filter((r) => months.includes(r.month)).reduce((s, r) => s + r.negative, 0),
  );

  return (
    <ChartCard
      title="How often do prices go negative?"
      takeaway={
        months.length
          ? `In the last ${months.length} months, the day-ahead price was below zero in ${formatNumber(totals[0], 0)} hours in Germany-Luxembourg and ${formatNumber(totals[1], 0)} in France.`
          : undefined
      }
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            The number of hours per month with a day-ahead price below zero (Europe/Berlin months).
            Negative prices come when wind and solar output exceed what the market can absorb, often
            on sunny weekend middays.
          </p>
          <p className="font-medium text-foreground">Caveats</p>
          <p>
            Since October 2025 the hourly value is the mean of four quarter-hour prices, so a single
            negative quarter-hour may not make a negative hour. The current month is incomplete.
          </p>
        </>
      }
      info={{
        ...chartInfo(seriesOf(ctx, ...codes), ctx.extractionDates, ctx.now, {
          source: "SMARD",
          unit: "hours",
        }),
        unit: "hours with a negative price",
      }}
      status={loaded === null ? "error" : months.length === 0 ? "empty" : "ready"}
      height={HEIGHT + 120}
    >
      <BarChart
        categories={months.map(label)}
        series={NEGATIVE_ZONES.map((z, i) => ({
          name: z.name,
          colorIndex: z.colorIndex,
          values: months.map((m) => counts[i].find((r) => r.month === m)?.negative ?? null),
        }))}
        unit="hours"
        decimals={0}
        height={HEIGHT + 120}
        ariaLabel="Hours with a negative day-ahead price per month, Germany-Luxembourg and France, last twelve months"
      />
    </ChartCard>
  );
}

const WIND = ["german_bight", "baltic", "husum", "emden", "magdeburg", "cottbus"].map(
  (s) => `open_meteo_de.wind.${s}`,
);
const SOLAR = ["munich", "nuremberg", "stuttgart", "cologne", "hanover", "berlin"].map(
  (s) => `open_meteo_de.solar.${s}`,
);
/** Population weights of the French temperature, as in the demand model (worker fr_power.py). */
const CITY_WEIGHTS: Record<string, number> = {
  paris: 9_904_000,
  lyon: 1_423_000,
  marseille: 1_400_000,
  lille: 1_044_000,
  nice: 927_000,
  toulouse: 847_000,
  bordeaux: 803_000,
  rouen: 532_559,
};
const CITIES = Object.keys(CITY_WEIGHTS);
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

const WEATHER_METHOD = (what: string, rangeLabel: string) => (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>{what}</p>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      For each calendar day, the band is the minimum to maximum and the dashed line the mean of the
      same day in {rangeLabel}; a day counts only if every site has a value. Observed weather from
      the Open-Meteo archive (ERA5 reanalysis), final about five days after the day.
    </p>
  </>
);

/** Weather that drives the zone: German wind and sunshine, French temperature. */
export function ZoneWeather({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  if (zone.id === "de") {
    return (
      <>
        <ComputedSeasonalCard
          ctx={ctx}
          codes={WIND}
          combine={mean}
          title="Is it windy in Germany for the season?"
          subject="The German wind index"
          method={WEATHER_METHOD(
            "The mean wind speed at 100 m (hub height) over six sites where German wind capacity concentrates: North Sea and Baltic offshore, the northern coasts, Saxony-Anhalt and Brandenburg. More wind means more wind output and lower prices. The same index feeds the day-ahead price forecast.",
            ctx.rangeLabel,
          )}
          source="Open-Meteo"
          unit="km/h"
          illustration="wind"
          commodity="power"
          decimals={1}
          height={HEIGHT}
        />
        <ComputedSeasonalCard
          ctx={ctx}
          codes={SOLAR}
          combine={mean}
          title="Is it sunny in Germany for the season?"
          subject="The German sunshine index"
          method={WEATHER_METHOD(
            "Daily shortwave radiation averaged over six cities in the states with the most solar capacity. More sun means more solar output at midday. The same index feeds the day-ahead price forecast.",
            ctx.rangeLabel,
          )}
          source="Open-Meteo"
          unit="MJ/m²"
          illustration="sun"
          commodity="power"
          decimals={1}
          height={HEIGHT}
        />
      </>
    );
  }
  if (zone.id === "fr") {
    const total = CITIES.reduce((s, c) => s + CITY_WEIGHTS[c], 0);
    return (
      <ComputedSeasonalCard
        ctx={ctx}
        codes={CITIES.map((c) => `open_meteo.fr.${c}.tmean`)}
        combine={(v) => v.reduce((s, t, i) => s + t * CITY_WEIGHTS[CITIES[i]], 0) / total}
        title="Is France colder than usual?"
        subject="The French population-weighted temperature"
        method={WEATHER_METHOD(
          "The daily mean temperature of eight large French cities, weighted by population. France heats largely with electricity, so each degree of cold raises demand; the same temperature feeds the demand and price forecasts.",
          ctx.rangeLabel,
        )}
        source="Open-Meteo"
        unit="°C"
        compare="absolute"
        commodity="power"
        decimals={1}
        height={HEIGHT}
      />
    );
  }
  return null;
}
