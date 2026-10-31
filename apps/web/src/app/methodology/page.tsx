import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { extractionDates } from "@/lib/data/attribution";
import { getRecentRuns, getSeriesCatalog } from "@/lib/data/catalog";
import { isDatabaseConfigured } from "@/lib/data/db";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { attempt } from "@/lib/data/page-context";
import { formatNumber } from "@/lib/format";
import { summariseSources } from "@/lib/methodology/sources";

export const metadata: Metadata = {
  title: "Methodology — Energy Desk",
  description:
    "How every number on Energy Desk is sourced, computed and labelled: seasonal norms, spreads, forecasts, the Lab, and the licence of every data source.",
};

const SECTIONS = [
  { id: "principles", title: "Principles" },
  { id: "seasonal", title: "Seasonal norms" },
  { id: "derived", title: "Derived series" },
  { id: "freshness", title: "Freshness, gaps and rejected values" },
  { id: "home", title: "Home map and Today in energy" },
  { id: "forecasts", title: "Forecasts" },
  { id: "lab", title: "Lab" },
  { id: "licensing", title: "Data licensing" },
  { id: "limits", title: "Known limits" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-3">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

const ADR_URL = "https://github.com/CorentinSTK/energy-desk/tree/main/docs/adr";

function Adr({ n, title }: { n: string; title: string }) {
  return (
    <a href={ADR_URL} className="text-primary underline-offset-2 hover:underline" title={title}>
      ADR {n}
    </a>
  );
}

export default function MethodologyPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">On this page</p>
        <ol className="space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-text-secondary hover:text-foreground hover:underline"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="max-w-3xl space-y-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Methodology</h1>
          <p className="text-text-secondary">
            How every number on the site is sourced, computed and labelled. The decisions behind it
            are recorded as architecture decision records (ADRs) in the public repository.
          </p>
        </header>

        <Section id="principles" title="Principles">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Official, free sources only</strong> (EIA, GIE,
              ENTSOG, SMARD, RTE, Elexon, CFTC, the European Commission, the ECB, Open-Meteo…).
              Exchange and price-reporting data that is licensed is never redistributed.
            </li>
            <li>
              <strong className="text-foreground">
                Nothing is invented, interpolated or filled.
              </strong>{" "}
              A missing value is shown as missing; a value outside a plausible physical range is
              rejected and counted, never corrected.
            </li>
            <li>
              <strong className="text-foreground">Values are stored in their source unit</strong>{" "}
              and converted only in one audited module (exact factors such as 42 gallons per
              barrel). The site may rescale prefixes for display (kb → mb, MW → GW, €/1000 L → €/L).
            </li>
            <li>
              <strong className="text-foreground">Price types are never mixed in one spread</strong>
              : spot with spot, day-ahead auction with day-ahead auction, futures with futures. The
              GB market index (Elexon MID) is never put in a spread with continental auction prices.
            </li>
            <li>
              <strong className="text-foreground">Unofficial data is labelled</strong>: futures
              settlements from Yahoo Finance appear only as derived indicators (spreads) and single
              front-month KPIs, always marked &ldquo;unofficial, delayed, research only&rdquo; (
              <Adr n="0003" title="Yahoo Finance futures policy" />
              ).
            </li>
            <li>
              Every chart states its source, unit, last date and how it is computed (the ⓘ button);
              every series is listed with its licence and freshness in the{" "}
              <Link href="/data" className="text-primary underline-offset-2 hover:underline">
                data catalogue
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section id="seasonal" title="Seasonal norms">
          <p>
            &ldquo;Against the five-year range&rdquo; compares a value with the same point of the
            five previous years; the current year is always excluded from its own norm.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Daily series</strong> (storage, power prices):
              same month and day. 29 February is left out, since it has no five-year norm.
            </li>
            <li>
              <strong className="text-foreground">Weekly series</strong> (US stocks, pump prices):
              same ISO week of the five previous ISO years. Week 53, which only some years have, is
              compared with week 52, keeping the later value, so every value shown is a stored one.
            </li>
            <li>
              The band is the minimum to maximum of those years and the dashed line their mean; the
              number of years available is shown when it is fewer than five.
            </li>
          </ul>
        </Section>

        <Section id="derived" title="Derived series">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Spreads</strong> (Brent − WTI, DE-LU − France) are
              computed only on dates both series have.
            </li>
            <li>
              <strong className="text-foreground">Crack spreads</strong>: US Gulf Coast 3-2-1 = (2 ×
              gasoline + 1 × ULSD) ÷ 3, converted from $/gal at 42 gal/bbl, minus WTI; NY Harbor
              diesel crack = ULSD − Brent. All EIA spot prices of the same date.
            </li>
            <li>
              <strong className="text-foreground">Daily power</strong>: consumption and generation
              are the average power over complete local delivery days only (23 or 25 hours on
              clock-change days); an incomplete day is a gap. The GB base price is computed from the
              complete set of half-hours.
            </li>
            <li>
              <strong className="text-foreground">Futures curves</strong>: generic months M1, M2…
              are rebuilt from individual contracts with each exchange&apos;s expiry rule; a date
              where the rule&apos;s front contract is missing has no value (
              <Adr n="0007" title="Oil sources, futures expiry and units" />
              ).
            </li>
            <li>
              <strong className="text-foreground">Positioning</strong>: net position = long − short
              of each CFTC trader category; managed money is also shown as a share of open interest.
            </li>
            <li>
              <strong className="text-foreground">Pump prices</strong>: taxes = price with taxes −
              price before taxes, both from the same weekly bulletin.
            </li>
          </ul>
        </Section>

        <Section id="freshness" title="Freshness, gaps and rejected values">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Each series has a normal publication delay (e.g. one day for GIE storage, about a week
              for EIA spot prices). A series is <em>delayed</em> or <em>stale</em> only beyond that
              delay; the badge on each chart says which.
            </li>
            <li>
              A gap is an interval between observations longer than normal for the series (a missing
              day for daily power, more than five days for business-day prices).
            </li>
            <li>
              Every ingestion run records rows written and rejected, with reasons (outside a
              plausible range, timestamp in the future, duplicate). Runs with problems are listed on
              the data page.
            </li>
          </ul>
        </Section>

        <Section id="home" title="Home map and Today in energy">
          <p>
            The map compares different series on one colour scale using unit-free measures of each
            series&apos; latest observation (
            <Adr n="0008" title="Home map rendering and comparable measures" />
            ):
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">vs 5-year average</strong>: distance from the mean
              of the same day or ISO week, in % of that mean (at least three prior years).
            </li>
            <li>
              <strong className="text-foreground">Latest move</strong>: the latest change divided by
              the standard deviation of the changes over the year before it (a z-score).
            </li>
            <li>
              <strong className="text-foreground">5-year percentile</strong>: the share of the past
              five years&apos; values at or below the latest one.
            </li>
          </ul>
          <p>
            &ldquo;Today in energy&rdquo; sentences come from fixed rules: EU storage against its
            norm, moves of at least two standard deviations, values beyond the 95th or 5th
            percentile of five years, and the storage country furthest from its norm. Marker
            positions come from Natural Earth (public domain) and are approximate.
          </p>
        </Section>

        <Section id="forecasts" title="Forecasts">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Every live forecast is stored when it is made, with the real time, and can never be
              changed or deleted; a live forecast of an outcome already published is refused (
              <Adr n="0009" title="Forecast registry, scoring and backtests" />
              ).
            </li>
            <li>
              Each forecast carries its two baselines&apos; forecasts (naive and seasonal) for the
              same target. A model is said to beat its baselines only with at least 30 scored
              forecasts and a mean absolute error at least 5% lower than each.
            </li>
            <li>
              Backtests are walk-forward: each past forecast uses only the data published on its
              issue date. They use today&apos;s revised data, and the French demand backtest uses
              the observed weather, so backtest errors are optimistic; live and backtest results are
              always shown separately.
            </li>
            <li>
              90% intervals are the 5th–95th percentiles of earlier errors at the same horizon (at
              least 50 of them).
            </li>
          </ul>
          <p>
            <Link href="/forecasts" className="text-primary underline-offset-2 hover:underline">
              See the forecasts and their scores
            </Link>
            .
          </p>
        </Section>

        <Section id="lab" title="Lab">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Rules are built from a form of allowed choices and bounded numbers; nothing typed is
              run as code. Everything is computed in the browser (
              <Adr n="0010" title="Lab: client-side engine, safe rules, honest outputs" />
              ).
            </li>
            <li>
              A decision taken at the close of a day is executed at the next close, never at the
              price that produced it; costs are subtracted per round trip and shown at 0–4× the
              stated cost.
            </li>
            <li>
              Results are split into a tuning period (first 70%) and a control period (last 30%);
              the Sharpe ratio is marked as not meaningful below 20 trades. For spot spreads, the
              P&amp;L measures a signal, not something one can hold.
            </li>
            <li>
              The simulator replays blocks of the series&apos; own daily changes (full history,
              crisis or calm periods) with a fixed seed: it cannot produce moves larger than those
              in its sample.
            </li>
          </ul>
        </Section>

        <Section id="licensing" title="Data licensing">
          <p>
            Exchange prices (CME, ICE, EEX, EPEX SPOT) and price assessments (Platts, Argus) are
            licensed and are not redistributed here. The site shows instead official spot prices and
            fundamentals, day-ahead auction results published under open licences, and derived
            indicators from unofficial futures data, labelled as such. ICE Commitments of Traders
            cannot be republished under ICE&apos;s terms, so European positioning is a declared gap.
          </p>
          <p>
            Every source used, with its licence and required attribution (from the series
            catalogue):
          </p>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SourcesTable />
          </Suspense>
        </Section>

        <Section id="limits" title="Known limits">
          <p>What the site deliberately does not cover, and why:</p>
          <ul className="list-disc space-y-1 pl-5">
            {DECLARED_GAPS.map((gap) => (
              <li key={gap.title}>
                <strong className="text-foreground">{gap.title}.</strong> {gap.reason}
              </li>
            ))}
          </ul>
        </Section>
      </article>
    </main>
  );
}

async function SourcesTable() {
  await connection();
  const [catalog, runs] = isDatabaseConfigured()
    ? await Promise.all([attempt("catalog", getSeriesCatalog()), attempt("runs", getRecentRuns())])
    : [null, null];
  if (!catalog) {
    return <p className="text-negative">The source list could not be loaded; see the data page.</p>;
  }
  const sources = summariseSources(catalog, extractionDates(runs ?? []));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 text-right font-medium">Series</th>
            <th className="px-3 py-2 font-medium">Licence</th>
            <th className="px-3 py-2 font-medium">Attribution</th>
          </tr>
        </thead>
        <tbody className="divide-y align-top">
          {sources.map((s) => (
            <tr key={s.source}>
              <td className="px-3 py-2 font-medium text-foreground">
                <Link
                  href={`/data?source=${s.source}`}
                  className="underline-offset-2 hover:underline"
                >
                  {s.label}
                </Link>
                {s.unofficial && (
                  <span className="block text-xs font-normal text-warning">unofficial</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(s.series, 0)}</td>
              <td className="px-3 py-2">
                {s.licences.map((l) => (
                  <span key={l.name} className="block">
                    {l.url ? (
                      <a
                        href={l.url}
                        className="underline-offset-2 hover:underline"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {l.name}
                      </a>
                    ) : (
                      l.name
                    )}
                  </span>
                ))}
              </td>
              <td className="px-3 py-2 text-xs">
                {s.attributions.map((a) => (
                  <span key={a} className="block">
                    {a}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
