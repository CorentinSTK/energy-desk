import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { PRESETS } from "@/lib/lab/rules";

export const metadata: Metadata = {
  title: "Lab — Energy Desk",
  description:
    "Research tools on official energy data: a rule backtester with honest outputs and a Monte-Carlo trade simulator.",
};

export default function LabPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Lab</h1>
        <p className="text-text-secondary">
          Two research tools on the site&apos;s official series. They show what a simple idea would
          have done and how fragile the answer is: costs, drawdowns, number of trades, a control
          period you did not tune on. They are not trading advice.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-base font-semibold">
              <Link href="/lab/backtest" className="hover:underline">
                Rule backtester
              </Link>
            </h2>
            <p className="text-sm text-text-secondary">
              Trade a price or spread with entry and exit rules on a signal: thresholds, z-scores,
              percentiles, moving averages, stocks against their seasonal norm. Decisions are
              executed the day after the signal, costs are subtracted, and results are split into a
              tuning period and a control period.
            </p>
            <ul className="space-y-1 text-sm">
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/lab/backtest?preset=${p.id}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-base font-semibold">
              <Link href="/lab/simulator" className="hover:underline">
                Trade simulator
              </Link>
            </h2>
            <p className="text-sm text-text-secondary">
              Set an entry, a stop and a target on a price or spread and replay thousands of paths
              built from its own historical daily changes, from the whole history, crisis periods or
              calm periods: fill probability, target or stop first, P&L distribution and time in the
              trade.
            </p>
            <Link
              href="/lab/simulator"
              className="inline-block text-sm text-primary underline-offset-2 hover:underline"
            >
              Open the simulator →
            </Link>
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        Series with short or unofficial histories (futures calendar spreads from October 2026, the
        continuous TTF front month whose contract rolls distort P&L) are not offered.
      </p>
    </main>
  );
}
