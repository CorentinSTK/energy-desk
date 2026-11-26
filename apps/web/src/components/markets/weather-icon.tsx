import { formatNumber } from "@/lib/format";

/** Ratio of the latest value to its seasonal mean, bounded so the drawing stays readable. */
function boundedRatio(current: number, mean: number | null): number {
  if (mean === null || mean <= 0) return 1;
  return Math.min(2, Math.max(0.15, current / mean));
}

/**
 * A wind turbine whose rotor turns faster when the wind index is above normal, or a sun that
 * shines brighter when radiation is above normal. Illustrates the latest value of the chart beside
 * it; the motion is CSS and stops under reduced motion.
 */
export function WeatherIcon({
  kind,
  current,
  mean,
  unit,
}: {
  kind: "wind" | "sun";
  current: number;
  mean: number | null;
  unit: string;
}) {
  const ratio = boundedRatio(current, mean);
  const caption =
    mean === null
      ? `${formatNumber(current, 1)} ${unit}`
      : `${formatNumber(current, 1)} ${unit}, ${formatNumber(ratio * 100, 0)}% of normal`;
  return (
    <figure className="flex flex-col items-center gap-2">
      {kind === "wind" ? (
        <svg
          viewBox="0 0 100 130"
          className="h-36 w-auto"
          role="img"
          aria-label={`Wind: ${caption}`}
        >
          <path d="M47 50 L44 128 L56 128 L53 50 Z" fill="var(--border-strong)" />
          <g
            className="turbine-rotor"
            style={{ animationDuration: `${(3.2 / ratio).toFixed(2)}s` }}
          >
            {[0, 120, 240].map((angle) => (
              <path
                key={angle}
                d="M50 46 C47 30 48 12 50 4 C53 14 54 30 50 46 Z"
                fill="var(--c-power)"
                transform={`rotate(${angle} 50 46)`}
              />
            ))}
          </g>
          <circle cx="50" cy="46" r="4" fill="var(--foreground)" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 100 100"
          className="h-32 w-auto"
          role="img"
          aria-label={`Sunshine: ${caption}`}
        >
          <g className="sun-rays" style={{ opacity: Math.min(1, 0.25 + ratio * 0.45) }}>
            {Array.from({ length: 12 }, (_, i) => (
              <rect
                key={i}
                x="48.5"
                y={10 - ratio * 4}
                width="3"
                height={10 + ratio * 6}
                rx="1.5"
                fill="var(--c-products)"
                transform={`rotate(${i * 30} 50 50)`}
              />
            ))}
          </g>
          <circle
            cx="50"
            cy="50"
            r="22"
            fill="var(--c-products)"
            style={{ opacity: Math.min(1, 0.45 + ratio * 0.35) }}
          />
        </svg>
      )}
      <figcaption className="text-center text-xs text-text-secondary">
        Latest day: {caption}
      </figcaption>
    </figure>
  );
}
