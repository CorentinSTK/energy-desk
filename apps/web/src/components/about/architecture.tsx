import { ArrowDown, ArrowRight } from "lucide-react";
import { Fragment } from "react";

interface Stage {
  title: string;
  detail: string;
}

const STAGES: Stage[] = [
  {
    title: "Public sources",
    detail: "Official APIs and files: EIA, GIE, ENTSOG, SMARD, RTE, Elexon, CFTC, IMF, ECB…",
  },
  {
    title: "Python worker",
    detail:
      "GitHub Actions on four daily schedules. One module per source; validates, keeps source units.",
  },
  {
    title: "Postgres",
    detail: "Supabase. Observations, ingestion runs and the forecast registry; SQL migrations.",
  },
  {
    title: "Next.js site",
    detail: "Vercel. Server components through a read-only role, with a shared data cache.",
  },
];

/** The data flow, left to right on wide screens and top to bottom on a phone. */
export function Architecture() {
  return (
    <figure className="space-y-3">
      <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {STAGES.map((stage, i) => (
          <Fragment key={stage.title}>
            {i > 0 && (
              <li aria-hidden className="flex justify-center text-muted-foreground">
                <ArrowDown className="size-4 md:hidden" />
                <ArrowRight className="hidden size-4 md:block" />
              </li>
            )}
            <li className="flex-1 space-y-1 self-stretch rounded-xl border bg-card p-3">
              <p className="text-[11px] font-medium tracking-[0.12em] text-primary uppercase">
                Step {i + 1}
              </p>
              <p className="font-medium text-foreground">{stage.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{stage.detail}</p>
            </li>
          </Fragment>
        ))}
      </ol>
      <figcaption className="text-xs text-muted-foreground">
        A second job issues the forecasts every evening and scores them once the outcome is
        published, against naive and seasonal baselines.
      </figcaption>
    </figure>
  );
}
