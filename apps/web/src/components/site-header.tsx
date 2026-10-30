import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/markets/gas", label: "Gas" },
  { href: "/markets/lng", label: "LNG" },
  { href: "/markets/power", label: "Power" },
  { href: "/markets/crude", label: "Crude" },
  { href: "/markets/products", label: "Products" },
  { href: "/forecasts", label: "Forecasts" },
  { href: "/data", label: "Data" },
];

/** Site-wide header: name, market links, theme toggle. The style guide is deliberately not linked. */
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          Energy Desk
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          {/* On a phone the links scroll sideways rather than push the page wider. */}
          <nav aria-label="Main" className="flex min-w-0 items-center overflow-x-auto text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-md px-2 py-1.5 whitespace-nowrap text-text-secondary transition-colors hover:bg-muted hover:text-foreground sm:px-2.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
