import Link from "next/link";

import { PRESETS } from "@/lib/lab/rules";

/** "Related" section of the market template: Lab presets that use this market's series. */
export function RelatedPresets({ ids }: { ids: string[] }) {
  const presets = PRESETS.filter((p) => ids.includes(p.id));
  if (presets.length === 0) return null;
  return (
    <section aria-label="Related Lab presets" className="text-sm text-muted-foreground">
      Lab:{" "}
      {presets.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ", "}
          <Link
            href={`/lab/backtest?preset=${p.id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {p.label}
          </Link>
        </span>
      ))}
      .
    </section>
  );
}
