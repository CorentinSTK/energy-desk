# ADR 0009 — Forecast registry, scoring and backtests

- Status: accepted
- Date: 2026-10-30

## Context

M6 publishes forecasts. Their value for the site is that they are honest: a reader must be able to see
what was forecast, when, how it turned out, and whether the model does better than something
trivial. A forecast that can be edited afterwards, or a backtest that has seen the future, is worse
than no forecast.

## Decision

### Registry (migration 007)

- `market.forecasts` stores one row per forecast:
  - the model and version, and whether it is **live** or a **backtest**;
  - the issue time and the target observation, and the horizon;
  - the point forecast and its 90% interval;
  - the **forecasts of the baselines** for the same target;
  - the **inputs** used, as JSON (for example the weather forecast).
- Two triggers guard the live rows:
  - an UPDATE or DELETE of a live forecast is **refused**;
  - a live forecast whose **outcome is already published** is **refused**.
  - The target may be in the past: on Tuesday, the US stocks model forecasts the level for the previous
    Friday, which is published on Wednesday.
- Scores are **computed in views**, by joining the realised observation (`web.forecast_scores`):
  - MAE, RMSE and bias;
  - skill = 1 − MAE(model) / MAE(baseline), on the targets that baseline covers;
  - 90% interval coverage.
  - Nothing is copied, so a revised observation changes the score.
- Backtests are kept apart (kind `backtest`). A new model version replaces its own backtest. Live and
  backtest results are always shown separately and labelled.

### No look-ahead (worker/forecast)

- A model only receives `History.as_of(cutoffs)`: each input series cut at the last date that was
  published on the issue date.
- A test checks that changing every value after the cutoff leaves a forecast unchanged.
- The French demand model needs the temperature of the target days. That input comes from an explicit,
  labelled source:
  - the **observed** temperature in backtests (a perfect weather forecast);
  - the **Open-Meteo forecast** in live, stored in the forecast's inputs.
  - The page states that backtest errors are therefore optimistic.
- Stored values are the latest vintage. Backtests use revised data where a source revises, and the pages
  say so.

### Intervals and verdict

- The 90% interval is the 5th to 95th percentile of **earlier** errors at the same horizon. In
  backtests, only errors whose outcome was published at the issue date are used; in live, the version's
  backtest errors are used.
- It needs at least 50 errors, otherwise there is no interval. If all past errors have the same sign,
  the interval is widened to include the point.
- **Verdict rule**: with at least 30 scored forecasts, a model "beats its baselines" only if its MAE is
  **at least 5% lower than each baseline's**.
  - Between 0 and 5% the site says "no clear edge". The US crude model's backtest (+2% and +1%) is one
    example.
  - This is a deliberately simple threshold rather than a statistical test, and it is stated on the page.

### Models (numpy only)

- **EU storage in 30 days**: the seasonal 30-day trajectory plus a learned correction for the recent
  14-day filling pace.
- **France daily demand, 1 to 7 days ahead**: a regression on population-weighted degree-days, weekday,
  holidays and month over the last three years, plus the average error of the last seven known days.
- **US crude stocks in the next EIA report**: the seasonal weekly change plus a regression on the
  previous week's surprise, refinery utilisation and net imports.

### Sources added

- **Open-Meteo archive**: daily mean temperature of eight cities, from 2015.
  - CC BY 4.0, credited "Weather data by Open-Meteo.com"; ERA5 from Copernicus C3S.
  - The free API is for non-commercial use: no subscriptions and no advertising, which is the case for
    this site.
- **Public holidays**: calendrier.api.gouv.fr (Licence Ouverte), read at run time.
- **ODRÉ history** now starts in 2015, matching the weather history.

## Consequences

- Live scores start empty and become meaningful after about 30 scored forecasts per model. That is about
  a month for the daily models and seven months for the weekly one.
- Backtest results at 30 October 2026, from a local run:

  | Model | MAE | Skill vs naive | Skill vs seasonal | 90% coverage |
  |---|---|---|---|---|
  | EU storage | 1.8 pts | +77% | +19% | 89% |
  | France demand, day 1 | 1.6 GW | +54% | +62% | 92% |
  | US crude stocks | 4.2 mb | +2% | +1% | 88% |

  The French demand figures assume a perfect weather forecast.
