import { Chip } from "@/components/data/filter-bar";
import { type CatalogFilters, filterHref, type Page } from "@/lib/data/filters";
import { formatNumber } from "@/lib/format";

/** "Showing 51–100 of 318 series" and links to every page, keeping the active filters. */
export function Pagination({
  filters,
  page,
  label = "Catalogue pages",
}: {
  filters: CatalogFilters;
  page: Page<unknown>;
  /** Accessible name of the page links; each copy on a page needs its own. */
  label?: string;
}) {
  const pages = Array.from({ length: page.pageCount }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-secondary">
        Showing {formatNumber(page.from, 0)}–{formatNumber(page.to, 0)} of{" "}
        {formatNumber(page.total, 0)} series
      </p>
      {page.pageCount > 1 && (
        <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
          {pages.map((n) => (
            <Chip key={n} href={filterHref(filters, { page: n })} active={n === page.page}>
              <span className="sr-only">Page </span>
              {n}
            </Chip>
          ))}
        </nav>
      )}
    </div>
  );
}
