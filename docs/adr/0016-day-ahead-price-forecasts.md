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
- Live errors will be larger than backtest errors, which use a perfect weather forecast.
- Not modelled:
  - German public holidays;
  - gas and carbon moves after the latest known price;
  - plant outages and interconnector limits.
- 90 % intervals covered 85 % in the backtest: slightly too narrow, and reported as such by the
  scores.
- Twelve new weather series (`open_meteo_de`), ingested daily with the French temperatures.
