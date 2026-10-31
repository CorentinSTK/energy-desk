# ADR 0010 — Lab: client-side engine, safe rules, honest outputs

- Status: accepted
- Date: 2026-10-31

## Context

M7 adds a rule backtester and a trade simulator (BUILD_SPEC §7). Visitors choose the rules, so the tool
must not run arbitrary code. It must answer instantly, and it must not overstate what a backtest shows.
Several presets in the spec relied on data we do not have with a usable history:
- the WTI, Brent and TTF M1–M2 spreads only start in October 2026;
- US gas storage is not covered;
- the continuous TTF front month jumps at every contract roll, which distorts P&L.

## Decision

- **The engine runs in the browser.** `lib/lab` is pure TypeScript and unit-tested. The server only
  sends allow-listed official series, read-only and cached, from 2000. There is no server-side
  computation on visitor input and no load on the serverless functions.
- **A safe rule grammar.** A typed rule is read from the URL:
  - allow-listed series, indicators (value, z-score, percentile, change, distance from a moving average,
    seasonal gap), sides and comparators;
  - bounded numbers (window 5–756, maximum hold 1–750…);
  - anything else is ignored, and nothing is evaluated as code;
  - an emptied form field means "no limit".
  - Forms are plain GET forms, so every result has a shareable URL.
- **No look-ahead.**
  - Indicators use data up to each point only, at the signal's own frequency.
  - Weekly EIA stocks reach the traded dates only once published (Friday + 5 days).
  - A decision at the close of day t is executed at the close of t+1, never at the price that produced
    the signal.
- **Honest outputs.**
  - P&L is the change of the traded series while in a position, in its unit, minus a round-trip cost.
    For spot spreads (DE–FR, Brent–WTI, cracks) this measures a signal, not something one can hold,
    and the page says so.
  - Results are given for a tuning period (first 70%) and a control period (last 30%).
  - Cost sensitivity is shown at 0×, 1×, 2× and 4× the cost.
  - The Sharpe ratio is marked as not meaningful below 20 trades, and an in-sample warning is always
    shown.
- **Presets on long official series**, replacing those without data:
  - DE–FR day-ahead spread, mean reversion (the European preset);
  - Brent–WTI, mean reversion;
  - 3-2-1 crack at a 3-year low;
  - diesel crack when US distillate stocks are below their seasonal norm;
  - Brent above its 100-day average.
- **Simulator.** A seeded block bootstrap (mulberry32, blocks of 20, 2,000 paths) of the series' own
  daily changes.
  - Regimes: full history, crisis (Mar–Jun 2020; 24 Feb 2022 – Jun 2023) or calm.
  - Blocks never join separate periods.
  - Stops and targets exit at the observed level of the day, so gaps are included.
  - The same seed always gives the same result.

## Consequences

- Results are reproducible from the URL. A hand check of a real preset trade matched the database:
  Brent–WTI on 7 → 18 July 2000, 0.36 → −3.48, short P&L +3.74 after a 0.10 cost.
- The browser downloads up to two series of about 7,000 points. This is acceptable for the Lab pages,
  which are not linked from the home page's first view.
- The bootstrap replays the past. Moves larger than anything in the sample cannot appear, and the page
  says so.
