import "server-only";

import { differenceOnDates } from "@/lib/points";
import { instrument } from "@/lib/lab/rules";

import { getPoints, type Points } from "./series";

/** History given to the Lab: enough for decades of signals, small enough for the browser. */
export const LAB_HISTORY_START = "2000-01-01T00:00:00Z";

/**
 * Points of a Lab instrument: one series, or the spread of two series on the dates both have
 * (differenceOnDates; both are the same price kind by construction of the instrument list).
 */
export async function getInstrumentPoints(id: string): Promise<Points | null> {
  const meta = instrument(id);
  if (!meta) return null;
  const series = await Promise.all(meta.codes.map((code) => getPoints(code, LAB_HISTORY_START)));
  return series.length === 2 ? differenceOnDates(series[0], series[1]) : series[0];
}
