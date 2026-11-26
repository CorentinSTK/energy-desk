# ADR 0016 — Day-ahead price forecasts for Germany-Luxembourg and France

- Status: accepted
- Date: 2026-11-25

## Context

Phase 2 adds a day-ahead power price forecast for one or two European zones (BUILD_SPEC §6). The owner
chose both Germany-Luxembourg and France. The model had to:
- be explainable in a few sentences;
- use only what is known at issue time;
- be scored against simple baselines, like the M6 models (ADR 0009).

Timing constraints:
- The day-ahead auction for day D clears at about 12:45 CET on D-1.
- The Forecast workflow runs at 22:30 UTC. Tomorrow is already priced by then, so the first unknown
  day is the day after tomorrow.
- Official day-ahead wind and solar forecasts (ENTSO-E 14.1.D) are due by 18:00 on D-1, after the
  auction. The ENTSO-E token is pending anyway. Using them would mean forecasting with information the
  market did not have.

## Decision

- Two models, `de_lu_da_price` and `fr_da_price`, issued daily with horizon 2. At 22:30 UTC on day X
  the target is the base price of X+2.
- A linear regression refitted each issue date on the past 365 days (at least 200 complete days):
  - the latest known base price, i.e. that of the day before the target. It carries the gas and
    carbon cost level, so no futures prices are needed;
  - German wind: the unweighted mean of the daily mean wind speed at 100 m over six sites where wind
    capacity concentrates (North Sea and Baltic offshore, the northern coasts, Saxony-Anhalt,
    Brandenburg), linear and squared;
  - German sunshine: mean daily shortwave radiation over six sites in the states with the most PV
    capacity;
  - weekday dummies;
  - France only: heating degree-days of the population-weighted temperature (the eight cities of the
    demand model) and a public-holiday flag.
- Weather: archive values for training (Open-Meteo, new source `open_meteo_de`). For the target day,
  live forecasts read the Open-Meteo forecast at issue time and keep it in the forecast inputs, as the
  French demand model does. Backtests use the observed weather.
- Baselines: "naive" is tomorrow's price, the latest known; "seasonal" is the price on the same
  weekday one week before the target.

## Consequences

- A local walk-forward backtest (1 Jan 2024 to 15 Nov 2026, 1,050 forecasts per zone, observed
  weather) gave:

  | Zone | MAE | Skill vs naive | Skill vs seasonal | 90 % interval coverage |
  |---|---|---|---|---|
  | DE-LU | 16.3 €/MWh | 30 % | 48 % | 85 % |
  | France | 16.3 €/MWh | 10 % | 46 % | 85 % |

  - Germany: wind and sunshine explain much of the day-to-day move.
  - France: prices follow nuclear availability, which has no free source, so the edge over persistence
    is small. The site says so.
- The production backtest (Forecast workflow, 1 Jan 2020 to 25 Nov 2026, including the 2022 price
  crisis) is the one the site shows:

  | Zone | Scored | MAE | Skill vs naive | Skill vs seasonal | 90 % coverage |
  |---|---|---|---|---|---|
  | DE-LU | 2,308 | 21.3 €/MWh | 17 % | 42 % | 87 % |
  | France | 2,309 | 18.5 €/MWh | 10 % | 44 % | 85 % |

- When prices trend, the one-year refit reacts late. In autumn 2026, with prices up on the Hormuz
  disruption, DE-LU forecasts ran about 32 €/MWh too low on average.
- Live errors will be larger than backtest errors, which use a perfect weather forecast.
- Not modelled:
  - German public holidays;
  - gas and carbon moves after the latest known price;
  - plant outages and interconnector limits.
- 90 % intervals covered 85 % in the backtest: slightly too narrow, and reported as such by the
  scores.
- Twelve new weather series (`open_meteo_de`), ingested daily with the French temperatures.

## Update — version 2: recent days weighted more (2026-11-25)

The one-year fit reacted late to the autumn 2026 price rise (DE-LU bias about −32 €/MWh). Variants were
compared on the same walk-forward backtest (1 Jan 2020 to 25 Nov 2026, observed weather):

| Variant | DE-LU MAE | DE-LU skill vs naive | FR MAE | FR skill vs naive | DE-LU bias, autumn 2026 |
|---|---|---|---|---|---|
| Version 1 (unweighted year) | 21.3 | 17 % | 18.5 | 10 % | −32.2 |
| Half-life 30 days | 18.2 | 29 % | 17.3 | 16 % | −13.4 |
| **Half-life 45 days (version 2)** | **18.4** | **28 %** | **17.1** | **17 %** | **−16.6** |
| Half-life 60 days | 18.6 | 27 % | 17.2 | 16 % | −19.2 |
| Half-life 90 days | 19.1 | 25 % | 17.4 | 15 % | −22.5 |
| Price change as target (coefficient 1 on the last price) | 22.0 | 14 % | 17.8 | 13 % | +0.3 |
| Version 1 + German public holidays | 21.2 | 18 % | — | — | −33.0 |

Decision: weighted least squares, each training day weighted 0.5^(age / 45 days); the training window
stays one year. Every half-life helped both zones; 45 days is the middle value, chosen to avoid tuning to
the decimal on the period being scored. Modelling the price change removes the bias but loses accuracy
(it trusts yesterday's level fully); German public holidays changed nothing and are left out.

Caveat: the half-life was chosen on the same backtest it is scored on, so the gain is slightly
optimistic; the live track record is the real test. Version 1 live forecasts stay in the registry
under their version.

### Tested and rejected: French nuclear output (2026-11-26)

French nuclear output (RTE éCO2mix, daily average MW, known up to the day before issue, so three days
before the target) was added to version 2 of the France model. Backtest 1 Jan 2022 to 25 Nov 2026,
same rows: MAE 19.09 → 19.12 €/MWh, skill vs naive 15.4 % → 15.1 %. No gain: the latest known price
already reflects the state of the fleet. Nuclear availability forecasts (planned outages) would be the
useful input, but no open source is confirmed (ADR 0017).
