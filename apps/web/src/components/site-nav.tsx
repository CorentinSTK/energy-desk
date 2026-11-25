"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

/** Main navigation: markets, then tools, with the current section highlighted. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <>
      {/* Wide screens: inline links. */}
      <nav
        aria-label="Main"
        className="hidden min-w-0 items-center overflow-x-auto text-sm lg:flex"
      >
        {MARKETS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-border" />
        {TOOLS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
      {/* Narrow screens: a menu button opening a side sheet. */}
      <MobileNav pathname={pathname} />
    </>
  );
}

function MobileGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </p>
      <ul>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <SheetClose asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-base transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-text-secondary hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </SheetClose>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0 p-4">
        <SheetTitle className="px-3 pb-1">Energy Desk</SheetTitle>
        <SheetDescription className="sr-only">Site navigation</SheetDescription>
        <nav aria-label="Main" className="mt-4 space-y-5 overflow-y-auto">
          <MobileGroup title="Markets" items={MARKETS} pathname={pathname} />
          <MobileGroup title="Tools" items={TOOLS} pathname={pathname} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
