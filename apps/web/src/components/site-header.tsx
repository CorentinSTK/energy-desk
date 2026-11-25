import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

/** The brand mark: three rising bars, in the accent colour. Decorative; the name carries the meaning. */
function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
      <rect width="24" height="24" rx="6" fill="var(--primary)" />
      <rect x="6" y="12" width="3" height="6" rx="1" fill="var(--primary-foreground)" />
      <rect x="10.5" y="8.5" width="3" height="9.5" rx="1" fill="var(--primary-foreground)" />
      <rect x="15" y="5.5" width="3" height="12.5" rx="1" fill="var(--primary-foreground)" />
    </svg>
  );
}

/** Site-wide header: name, navigation, theme toggle. The style guide is deliberately not linked. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          <span>Energy Desk</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <SiteNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
