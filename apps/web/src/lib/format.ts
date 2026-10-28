/**
 * Number and date formatting for every figure on the site (BUILD_SPEC §8):
 * thousands separators, consistent precision per unit, explicit signs on changes, "92nd pct".
 * Missing values render as an em dash, never as 0.
 */

export const MISSING = "—";
const MINUS = "−"; // typographic minus: same width as "+" in tabular figures

/** Display precision per unit. Units not listed use DEFAULT_DECIMALS. */
export const UNIT_DECIMALS: Record<string, number> = {
  "$/bbl": 2,
  "¢/gal": 1,
  "$/t": 0,
  "$/MMBtu": 3,
  "€/MWh": 2,
  "£/MWh": 2,
  "p/therm": 2,
  mb: 1,
  TWh: 1,
  "GWh/d": 0,
  GW: 1,
  "%": 1,
};
const DEFAULT_DECIMALS = 2;

export function decimalsFor(unit: string | undefined): number {
  return unit !== undefined && unit in UNIT_DECIMALS ? UNIT_DECIMALS[unit] : DEFAULT_DECIMALS;
}

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || !Number.isFinite(value);
}

function grouped(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** 1234.5 → "1,234.50". Negative values use a typographic minus. */
export function formatNumber(
  value: number | null | undefined,
  decimals = DEFAULT_DECIMALS,
): string {
  if (isMissing(value)) return MISSING;
  const text = grouped(Math.abs(value), decimals);
  return isNegativeAfterRounding(value, decimals) ? `${MINUS}${text}` : text;
}

/** Change with an explicit sign: "+1.20", "−0.40", "0.00". */
export function formatChange(
  value: number | null | undefined,
  decimals = DEFAULT_DECIMALS,
): string {
  if (isMissing(value)) return MISSING;
  const text = grouped(Math.abs(value), decimals);
  if (isZeroAfterRounding(value, decimals)) return text;
  return `${value > 0 ? "+" : MINUS}${text}`;
}

/** Signed percentage change, given in percent (not as a fraction): 1.23 → "+1.2%". */
export function formatPercentChange(value: number | null | undefined, decimals = 1): string {
  const text = formatChange(value, decimals);
  return text === MISSING ? MISSING : `${text}%`;
}

/** Percentile rank 0–100 → "92nd pct". Rounded to the nearest integer. */
export function formatPercentile(value: number | null | undefined): string {
  if (isMissing(value)) return MISSING;
  const n = Math.round(Math.min(100, Math.max(0, value)));
  return `${n}${ordinalSuffix(n)} pct`;
}

export function ordinalSuffix(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** ISO date or Date → "28 Oct 2026" (UTC, so the server and browser agree). */
export function formatDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return MISSING;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function isZeroAfterRounding(value: number, decimals: number): boolean {
  return Math.abs(value) < 0.5 * 10 ** -decimals;
}

function isNegativeAfterRounding(value: number, decimals: number): boolean {
  return value < 0 && !isZeroAfterRounding(value, decimals);
}
