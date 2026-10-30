import Link from "next/link";

import { FORECAST_MODELS } from "@/lib/forecasts/models";

/** "Related" section of the market template: links to the forecasts of this market's series. */
export function RelatedForecasts({ ids }: { ids: string[] }) {
  const models = FORECAST_MODELS.filter((m) => ids.includes(m.id));
  if (models.length === 0) return null;
  return (
    <section aria-label="Related forecasts" className="text-sm text-muted-foreground">
      Related forecast{models.length > 1 ? "s" : ""}:{" "}
      {models.map((m, i) => (
        <span key={m.id}>
          {i > 0 && ", "}
          <Link
            href={`/forecasts/${m.id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {m.name}
          </Link>
        </span>
      ))}
      , scored against simple baselines.
    </section>
  );
}
