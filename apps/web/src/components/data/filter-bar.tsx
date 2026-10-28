import Link from "next/link";

import { COMMODITIES, type Commodity } from "@/lib/commodities";
import {
  COMMODITY_FILTERS,
  type CatalogFilters,
  filterHref,
  SOURCE_LABELS,
} from "@/lib/data/filters";
import { cn } from "@/lib/utils";

const FX_LABEL = "FX";

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted",
        active && "border-primary bg-muted font-medium",
      )}
    >
      {children}
    </Link>
  );
}

/** Filters as links, so every filtered view has its own shareable URL. */
export function FilterBar({ filters }: { filters: CatalogFilters }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
      <nav aria-label="Filter by commodity" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Commodity</span>
        <Chip href={filterHref(filters, { commodity: undefined })} active={!filters.commodity}>
          All
        </Chip>
        {COMMODITY_FILTERS.map((c) => (
          <Chip
            key={c}
            href={filterHref(filters, { commodity: c })}
            active={filters.commodity === c}
          >
            {c === "fx" ? FX_LABEL : COMMODITIES[c as Commodity].label}
          </Chip>
        ))}
      </nav>
      <nav aria-label="Filter by source" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Source</span>
        <Chip href={filterHref(filters, { source: undefined })} active={!filters.source}>
          All
        </Chip>
        {Object.entries(SOURCE_LABELS).map(([key, label]) => (
          <Chip
            key={key}
            href={filterHref(filters, { source: key })}
            active={filters.source === key}
          >
            {label}
          </Chip>
        ))}
      </nav>
    </div>
  );
}
