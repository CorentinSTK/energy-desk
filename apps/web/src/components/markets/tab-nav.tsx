import Link from "next/link";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

/**
 * Market page tabs as links (`?tab=…`): each view has its own shareable URL, and only the active tab's
 * data is loaded.
 */
export function TabNav({
  tabs,
  active,
  hrefFor,
}: {
  tabs: Tab[];
  active: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="inline-flex min-w-full gap-1 border-b">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={hrefFor(tab.id)}
              scroll={false}
              aria-current={tab.id === active ? "page" : undefined}
              className={cn(
                "-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                tab.id === active && "border-primary font-medium text-foreground",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
