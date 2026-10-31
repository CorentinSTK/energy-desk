/**
 * Rule backtest on one traded series. Conventions (ADR 0010):
 * - Decisions are taken at the close of day t from the signal at t, and executed at the close of the
 *   next observation (t + 1): never at the price that produced the signal.
 * - P&L is the change of the traded series while in a position, in its own unit, minus the round-trip
 *   cost at exit. For a spot spread this measures a signal, not a tradable strategy.
 * - The history is split at 70%: "tuning" and "control" periods are reported separately.
 */

import type { Rule } from "./rules";

export type ExitReason = "signal" | "max hold" | "stop" | "target" | "open at end";

export interface Trade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  /** After the round-trip cost. */
  pnl: number;
  /** Observations held. */
  held: number;
  reason: ExitReason;
}

export interface Stats {
  trades: number;
  totalPnl: number;
  hitRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  /** Annualised: mean daily P&L ÷ its standard deviation × √(observations per year). */
  sharpe: number | null;
  maxDrawdown: number;
  /** Share of observations in a position (%). */
  exposure: number;
  tradesPerYear: number;
  years: number;
}

export interface BacktestResult {
  dates: string[];
  /** Position held over (t, t + 1]: +1 long, −1 short, 0 flat. */
  position: number[];
  /** P&L of each observation, after costs. */
  dailyPnl: number[];
  equity: number[];
  drawdown: number[];
  trades: Trade[];
  splitDate: string | null;
  all: Stats;
  tuning: Stats;
  control: Stats;
}

export const TUNING_SHARE = 0.7;
const DAY_MS = 864e5;

function holds(op: "gt" | "lt", value: number | null, threshold: number): boolean {
  return value !== null && (op === "gt" ? value > threshold : value < threshold);
}

export function runBacktest(
  dates: string[],
  values: number[],
  signal: (number | null)[],
  rule: Rule,
  costMultiplier = 1,
): BacktestResult {
  const n = dates.length;
  const sign = rule.side === "long" ? 1 : -1;
  const cost = rule.cost * costMultiplier;
  const position = new Array<number>(n).fill(0);
  const dailyPnl = new Array<number>(n).fill(0);
  const trades: Trade[] = [];
  let pos = 0;
  let entryIdx = -1;
  let pending: { action: "enter" } | { action: "exit"; reason: ExitReason } | null = null;

  for (let t = 0; t < n; t++) {
    // The move into today accrues to the position held since yesterday's close.
    if (t > 0) dailyPnl[t] = position[t - 1] * (values[t] - values[t - 1]);

    // Yesterday's decision is executed at today's close.
    if (pending?.action === "enter") {
      pos = sign;
      entryIdx = t;
    } else if (pending?.action === "exit") {
      trades.push(closeTrade(entryIdx, t, pending.reason));
      dailyPnl[t] -= cost;
      pos = 0;
    }
    pending = null;

    // Today's decision, for tomorrow's close.
    if (t < n - 1) {
      if (pos === 0) {
        if (holds(rule.entry.op, signal[t], rule.entry.threshold)) pending = { action: "enter" };
      } else {
        const tradePnl = sign * (values[t] - values[entryIdx]);
        const held = t - entryIdx;
        const reason: ExitReason | null =
          rule.stop !== null && tradePnl <= -rule.stop
            ? "stop"
            : rule.target !== null && tradePnl >= rule.target
              ? "target"
              : rule.exit && holds(rule.exit.op, signal[t], rule.exit.threshold)
                ? "signal"
                : rule.maxHold !== null && held >= rule.maxHold
                  ? "max hold"
                  : null;
        if (reason) pending = { action: "exit", reason };
      }
    } else if (pos !== 0) {
      trades.push(closeTrade(entryIdx, t, "open at end"));
      dailyPnl[t] -= cost;
      pos = 0;
    }
    position[t] = pos;
  }

  function closeTrade(from: number, to: number, reason: ExitReason): Trade {
    return {
      entryDate: dates[from],
      exitDate: dates[to],
      entryPrice: values[from],
      exitPrice: values[to],
      pnl: sign * (values[to] - values[from]) - cost,
      held: to - from,
      reason,
    };
  }

  const equity: number[] = [];
  const drawdown: number[] = [];
  let total = 0;
  let peak = 0;
  for (const p of dailyPnl) {
    total += p;
    peak = Math.max(peak, total);
    equity.push(total);
    drawdown.push(total - peak);
  }
  const split = n > 1 ? Math.floor(n * TUNING_SHARE) : n;
  return {
    dates,
    position,
    dailyPnl,
    equity,
    drawdown,
    trades,
    splitDate: n > 1 ? dates[split] : null,
    all: stats(dates, dailyPnl, position, trades, 0, n),
    tuning: stats(dates, dailyPnl, position, trades, 0, split),
    control: stats(dates, dailyPnl, position, trades, split, n),
  };
}

/** Statistics over observations [from, to); trades are counted in the period they were entered. */
export function stats(
  dates: string[],
  dailyPnl: number[],
  position: number[],
  trades: Trade[],
  from: number,
  to: number,
): Stats {
  const pnl = dailyPnl.slice(from, to);
  const span = to - from;
  const years =
    span > 1 ? (Date.parse(dates[to - 1]) - Date.parse(dates[from])) / (365.25 * DAY_MS) : 0;
  const start = dates[from];
  const end = dates[to - 1];
  const own = trades.filter((t) => t.entryDate >= start && t.entryDate <= end);
  const wins = own.filter((t) => t.pnl > 0);
  const losses = own.filter((t) => t.pnl <= 0);
  const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const mean = average(pnl) ?? 0;
  const sd =
    pnl.length > 1 ? Math.sqrt(pnl.reduce((a, x) => a + (x - mean) ** 2, 0) / (pnl.length - 1)) : 0;
  const perYear = years > 0 ? (span - 1) / years : 0;
  let total = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const p of pnl) {
    total += p;
    peak = Math.max(peak, total);
    maxDrawdown = Math.min(maxDrawdown, total - peak);
  }
  return {
    trades: own.length,
    totalPnl: total,
    hitRate: own.length ? (wins.length / own.length) * 100 : null,
    avgWin: average(wins.map((t) => t.pnl)),
    avgLoss: average(losses.map((t) => t.pnl)),
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(perYear) : null,
    maxDrawdown,
    exposure: span ? (position.slice(from, to).filter((p) => p !== 0).length / span) * 100 : 0,
    tradesPerYear: years > 0 ? own.length / years : 0,
    years,
  };
}
