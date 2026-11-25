"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

const MARKETS: NavItem[] = [
  { href: "/markets/gas", label: "Gas" },
  { href: "/markets/lng", label: "LNG" },
  { href: "/markets/power", label: "Power" },
  { href: "/markets/crude", label: "Crude" },
  { href: "/markets/products", label: "Products" },
  { href: "/markets/lpg", label: "LPG" },
  { href: "/markets/freight", label: "Freight" },
];

const TOOLS: NavItem[] = [
  { href: "/forecasts", label: "Forecasts" },
  { href: "/lab", label: "Lab" },
  { href: "/data", label: "Data" },
  { href: "/methodology", label: "Methodology" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative shrink-0 rounded-md px-2 py-1.5 whitespace-nowrap transition-colors sm:px-2.5",
        active
          ? "bg-muted text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary sm:after:inset-x-2.5"
          : "text-text-secondary hover:bg-muted hover:text-foreground",
      )}
    >
      {item.label}
    </Link>
  );
}

/** Main navigation: markets, then tools, with the current section underlined. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    // On a phone the links scroll sideways rather than push the page wider.
    <nav aria-label="Main" className="flex min-w-0 items-center overflow-x-auto text-sm">
      {MARKETS.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
      <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-border" />
      {TOOLS.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  );
}
