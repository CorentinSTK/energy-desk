import { formatChange, formatDate, formatNumber } from "@/lib/format";

interface StorageTankProps {
  /** Filling level, % of working gas capacity. */
  pct: number;
  /** Mean level on the same day in the norm years, %; null without a norm. */
  normPct: number | null;
  /** Reference line, e.g. the 90 % filling target; null to hide it. */
  targetPct: number | null;
  date: string;
  label: string;
  rangeLabel: string;
}

const W = 120;
const H = 200;
const TOP = 14;
const BOTTOM = H - 14;
const LEFT = 18;
const RIGHT = W - 18;

function yOf(pct: number): number {
  return BOTTOM - (Math.min(100, Math.max(0, pct)) / 100) * (BOTTOM - TOP);
}

/**
 * A storage tank filled to the latest level, with the seasonal mean and the filling target drawn
 * across it. The fill rises when the page opens (CSS, off under reduced motion).
 */
export function StorageTank({
  pct,
  normPct,
  targetPct,
  date,
  label,
  rangeLabel,
}: StorageTankProps) {
  const level = yOf(pct);
  const gap = normPct === null ? null : pct - normPct;
  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-auto"
        role="img"
        aria-label={`${label} gas storage ${formatNumber(pct, 1)}% full on ${formatDate(date)}`}
      >
        <defs>
          <clipPath id="tank-body">
            <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} rx={16} />
          </clipPath>
          <linearGradient id="tank-gas" x1="0" x2="1">
            <stop offset="0" stopColor="var(--c-natgas)" stopOpacity="0.75" />
            <stop offset="0.5" stopColor="var(--c-natgas)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--c-natgas)" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <rect
          x={LEFT}
          y={TOP}
          width={RIGHT - LEFT}
          height={BOTTOM - TOP}
          rx={16}
          fill="var(--muted)"
        />
        <g clipPath="url(#tank-body)">
          <rect
            x={LEFT}
            y={level}
            width={RIGHT - LEFT}
            height={BOTTOM - level}
            fill="url(#tank-gas)"
            className="tank-fill"
          />
        </g>
        {normPct !== null && (
          <line
            x1={LEFT - 6}
            x2={RIGHT + 6}
            y1={yOf(normPct)}
            y2={yOf(normPct)}
            stroke="var(--chart-avg)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          >
            <title>{`${rangeLabel} average for this date: ${formatNumber(normPct, 1)}%`}</title>
          </line>
        )}
        {targetPct !== null && (
          <line
            x1={LEFT - 6}
            x2={RIGHT + 6}
            y1={yOf(targetPct)}
            y2={yOf(targetPct)}
            stroke="var(--foreground)"
            strokeWidth={1.2}
          >
            <title>{`Filling target: ${targetPct}%`}</title>
          </line>
        )}
        <rect
          x={LEFT}
          y={TOP}
          width={RIGHT - LEFT}
          height={BOTTOM - TOP}
          rx={16}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={1.5}
        />
        <text
          x={W / 2}
          y={Math.min(level + 22, BOTTOM - 8)}
          textAnchor="middle"
          className="fill-foreground font-mono text-[18px] font-semibold"
          stroke="var(--surface)"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {formatNumber(pct, 1)}%
        </text>
      </svg>
      <figcaption className="space-y-1 text-center text-xs text-text-secondary">
        <p className="text-sm font-medium text-foreground">
          {label} storage on {formatDate(date)}
        </p>
        {gap !== null && (
          <p>
            {formatChange(gap, 1)} pts vs the {rangeLabel} average (dashed line)
          </p>
        )}
        {targetPct !== null && <p>Solid line: the {targetPct}% filling target</p>}
      </figcaption>
    </figure>
  );
}
