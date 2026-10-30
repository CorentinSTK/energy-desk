import { MIN_CLEAR_SKILL, MIN_SCORED_FORECASTS, type Verdict } from "@/lib/forecasts/models";
import { cn } from "@/lib/utils";

/** Whether a model beats both baselines, with the number of scored forecasts it is based on. */
export function VerdictBadge({ verdict, label }: { verdict: Verdict; label: string }) {
  const text =
    verdict.status === "beats"
      ? "Beats both baselines"
      : verdict.status === "no-clear-edge"
        ? `No clear edge (under ${MIN_CLEAR_SKILL * 100}% better)`
        : verdict.status === "does-not-beat"
          ? "Does not beat both baselines"
          : `Too few scored (${verdict.n}/${MIN_SCORED_FORECASTS})`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
        verdict.status === "beats" && "border-positive text-positive",
        verdict.status === "does-not-beat" && "border-negative text-negative",
        verdict.status === "too-few" && "text-muted-foreground",
      )}
    >
      <span className="text-muted-foreground">{label}:</span> {text}
    </span>
  );
}
