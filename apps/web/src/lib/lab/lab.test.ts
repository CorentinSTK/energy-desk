import { describe, expect, it } from "vitest";

import { runBacktest } from "./backtest";
import { alignSignal, computeIndicator, isoWeek, type Points } from "./indicators";
import { parseRule, PRESETS, type Rule, ruleQuery } from "./rules";
import { mulberry32, regimeRuns, simulate } from "./simulate";

const day = (i: number) =>
  new Date(Date.UTC(2024, 0, 1) + i * 864e5).toISOString().slice(0, 19) + "Z";
const pts = (values: number[]): Points => values.map((v, i) => [day(i), v]);

const baseRule: Rule = {
  traded: "x",
  signal: "x",
  indicator: { kind: "value", window: 1 },
  side: "long",
  entry: { op: "lt", threshold: 10 },
  exit: { op: "gt", threshold: 12 },
  maxHold: null,
  stop: null,
  target: null,
  cost: 0,
};

describe("indicators", () => {
  it("only use data up to each point", () => {
    const values = [1, 2, 3, 4, 100];
    const full = computeIndicator(pts(values), { kind: "zscore", window: 3 });
    const truncated = computeIndicator(pts(values.slice(0, 4)), { kind: "zscore", window: 3 });
    expect(full.slice(0, 4)).toEqual(truncated);
  });

  it("compute z-scores, percentiles, changes and moving-average distances", () => {
    const series = pts([1, 2, 3]);
    expect(computeIndicator(series, { kind: "zscore", window: 3 })).toEqual([null, null, 1]);
    expect(computeIndicator(series, { kind: "percentile", window: 2 })).toEqual([null, 100, 100]);
    expect(computeIndicator(series, { kind: "change", window: 2 })).toEqual([null, null, 2]);
    expect(computeIndicator(series, { kind: "ma_distance", window: 3 })).toEqual([null, null, 1]);
  });

  it("compares weekly stocks with the same ISO week of prior years", () => {
    const fridays = [2019, 2020, 2021, 2022, 2023, 2024].map((y) => {
      const d = new Date(Date.UTC(y, 9, 1));
      while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCDate(d.getUTCDate() + 14);
      return d.toISOString();
    });
    expect(new Set(fridays.map((f) => isoWeek(f).week)).size).toBeLessThanOrEqual(2);
    const values = [100, 100, 100, 100, 100, 90];
    const deviation = computeIndicator(
      fridays.map((f, i) => [f, values[i]]),
      { kind: "seasonal", window: 1 },
    );
    expect(deviation.at(-1)).toBeCloseTo(-10);
  });

  it("uses a weekly signal only once it is published", () => {
    const traded = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"].map(
      (d) => `${d}T00:00:00Z`,
    );
    // Week ending Friday 23 Oct, published Wednesday 28 Oct.
    const aligned = alignSignal(traded, ["2026-10-23T00:00:00Z"], [-6], 5);
    expect(aligned).toEqual([null, null, -6, -6]);
  });

  it("knows ISO weeks across New Year", () => {
    expect(isoWeek("2021-01-01")).toEqual({ year: 2020, week: 52 }); // ISO week 53 folded
    expect(isoWeek("2026-10-30")).toEqual({ year: 2026, week: 44 });
  });
});

describe("backtest", () => {
  it("executes a day after the signal and measures P&L by hand", () => {
    // Signal at day 1 (9 < 10): enter at day 2's close (8). Exit signal at day 4 (13 > 12): exit at
    // day 5's close (14). Trade P&L = 14 − 8 = 6.
    const values = [11, 9, 8, 10, 13, 14, 15];
    const result = runBacktest(
      pts(values).map(([d]) => d),
      values,
      values,
      baseRule,
    );
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      entryPrice: 8,
      exitPrice: 14,
      pnl: 6,
      reason: "signal",
    });
    expect(result.equity.at(-1)).toBe(6);
    expect(result.position).toEqual([0, 0, 1, 1, 1, 0, 0]);
  });

  it("subtracts costs per round trip and scales them", () => {
    const values = [11, 9, 8, 10, 13, 14, 15];
    const dates = pts(values).map(([d]) => d);
    const rule = { ...baseRule, cost: 0.5 };
    expect(runBacktest(dates, values, values, rule).all.totalPnl).toBeCloseTo(5.5);
    expect(runBacktest(dates, values, values, rule, 4).all.totalPnl).toBeCloseTo(4);
  });

  it("applies short side, stop, maximum hold and closes at the end", () => {
    const values = [10, 12, 13, 15, 16, 16, 16];
    const dates = pts(values).map(([d]) => d);
    const short = {
      ...baseRule,
      side: "short" as const,
      entry: { op: "gt" as const, threshold: 11 },
      exit: null,
      stop: 2,
    };
    const stopped = runBacktest(dates, values, values, short);
    // Enter at 13 (day 2); at day 3 the trade is −2 → exit at day 4's close (16): −3.
    expect(stopped.trades[0]).toMatchObject({
      entryPrice: 13,
      exitPrice: 16,
      pnl: -3,
      reason: "stop",
    });
    const open = runBacktest(dates, values, values, { ...short, stop: null, maxHold: null });
    expect(open.trades.at(-1)?.reason).toBe("open at end");
  });

  it("reports tuning and control periods separately", () => {
    const values = Array.from({ length: 100 }, (_, i) => 10 + Math.sin(i / 3) * 3);
    const result = runBacktest(
      pts(values).map(([d]) => d),
      values,
      values,
      baseRule,
    );
    expect(result.tuning.trades + result.control.trades).toBe(result.all.trades);
    expect(result.splitDate).toBe(day(70));
  });
});

describe("rules from the URL", () => {
  it("starts from the preset and ignores invalid values", () => {
    const { preset, rule } = parseRule({
      preset: "brent_wti_mean_reversion",
      win: "99999",
      traded: "us_crude_stocks",
      eth: "abc",
    });
    expect(preset?.id).toBe("brent_wti_mean_reversion");
    expect(rule.indicator.window).toBe(120); // 99999 is out of bounds
    expect(rule.traded).toBe("brent_wti"); // a signal-only series cannot be traded
    expect(rule.entry.threshold).toBe(2);
  });

  it("round-trips through the URL", () => {
    for (const preset of PRESETS) {
      expect(parseRule({ preset: preset.id, ...ruleQuery(preset.rule) }).rule).toEqual(preset.rule);
    }
  });
});

describe("simulator", () => {
  const history = pts(Array.from({ length: 400 }, (_, i) => 50 + 5 * Math.sin(i / 10) + (i % 7)));
  const input = {
    points: history,
    regime: "full" as const,
    side: "long" as const,
    entry: history.at(-1)![1],
    stop: history.at(-1)![1] - 5,
    target: history.at(-1)![1] + 5,
    horizon: 60,
    paths: 500,
    blockSize: 20,
    seed: 42,
  };

  it("is reproducible for a given seed", () => {
    expect(simulate(input)).toEqual(simulate(input));
    expect(simulate({ ...input, seed: 7 })).not.toEqual(simulate(input));
    expect(mulberry32(1)()).toBe(mulberry32(1)());
  });

  it("accounts for every filled path", () => {
    const result = simulate(input)!;
    expect(result.filled).toBe(1); // entry at the current level fills at once
    expect(result.targetFirst + result.stopFirst + result.timedOut).toBeCloseTo(1);
    expect(result.pnl).toHaveLength(500);
  });

  it("separates crisis and calm changes without joining periods", () => {
    const series: Points = [
      ["2020-02-28T00:00:00Z", 1],
      ["2020-03-02T00:00:00Z", 2],
      ["2020-03-03T00:00:00Z", 4],
      ["2020-07-01T00:00:00Z", 5],
      ["2020-07-02T00:00:00Z", 8],
    ];
    expect(regimeRuns(series, "crisis")).toEqual([[2]]);
    expect(regimeRuns(series, "calm")).toEqual([[3]]);
    expect(regimeRuns(series, "full")).toEqual([[1, 2, 1, 3]]);
  });
});
