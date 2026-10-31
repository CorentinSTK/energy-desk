import Link from "next/link";

import { AUTHOR, REPO_URL } from "@/lib/site";

const LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/data", label: "Data catalogue" },
  { href: "/about", label: "About" },
];

/** Site-wide footer: the reference pages, the code, and the licensing reminder. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a href={REPO_URL} className="hover:text-foreground" rel="noreferrer" target="_blank">
            Source code
          </a>
        </nav>
        <p className="text-xs text-muted-foreground">
          Data remain under the licence of their sources (see{" "}
          <Link href="/methodology#licensing" className="underline underline-offset-2">
            Data licensing
          </Link>
          ). Built by {AUTHOR.name}.
        </p>
      </div>
    </footer>
  );
}
