/**
 * Date-aligned arithmetic on daily power series (generation groups, renewable share, spreads).
 *
 * Every function keeps a date only when all the inputs that should report that day did, so a late or
 * missing publication shows as a gap, never as a drop. A series that had not started yet (e.g. an
 * interconnector commissioned in 2024) counts as zero before its first observation: it did not exist,
 * it is not missing.
 */

type Points = [string, number][];

/** Sum of distinct quantities per date; dates where a started series has no value are left out. */
export function sumOnDates(series: Points[]): Points {
  const reporting = series.filter((s) => s.length > 0);
  if (reporting.length === 0) return [];
  const maps = reporting.map((s) => new Map(s));
  const firsts = reporting.map((s) => s[0][0]);
  const dates = [...new Set(reporting.flatMap((s) => s.map(([ts]) => ts)))].sort();
  const result: Points = [];
  for (const date of dates) {
    let total = 0;
    let complete = true;
    for (const [i, map] of maps.entries()) {
      const value = map.get(date);
      if (value !== undefined) total += value;
      else if (date >= firsts[i]) {
        complete = false;
        break;
      }
    }
    if (complete) result.push([date, total]);
  }
  return result;
}

/** part / whole × 100 on the dates both have; null-free. */
export function shareOnDates(part: Points, whole: Points): Points {
  const wholeByDate = new Map(whole);
  return part.flatMap(([date, value]): Points => {
    const total = wholeByDate.get(date);
    return total !== undefined && total > 0 ? [[date, (value / total) * 100]] : [];
  });
}

/** a − b on the dates both have. Only for prices of the same kind and unit (BUILD_SPEC §4). */
export function differenceOnDates(a: Points, b: Points): Points {
  const bByDate = new Map(b);
  return a.flatMap(([date, value]): Points => {
    const other = bByDate.get(date);
    return other !== undefined ? [[date, value - other]] : [];
  });
}
