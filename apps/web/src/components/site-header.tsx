import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/markets/gas", label: "Gas" },
  { href: "/markets/lng", label: "LNG" },
  { href: "/data", label: "Data" },
];

/** Site-wide header: name, market links, theme toggle. The style guide is deliberately not linked. */
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Energy Desk
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
