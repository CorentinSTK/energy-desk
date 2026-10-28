import type { Metadata } from "next";

import { Showcase } from "./showcase";

// Not linked from the site and not indexed (BUILD_SPEC §8). Synthetic data only.
export const metadata: Metadata = {
  title: "Style guide — Energy Desk",
  robots: { index: false, follow: false },
};

const THEMES = ["dark", "light"] as const;

export default function StyleguidePage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Style guide</h1>
          <p className="text-text-secondary">
            Every core component in both themes. Not linked publicly. All data on this page is
            synthetic.
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        {THEMES.map((theme) => (
          // The theme class re-scopes the tokens for this panel only.
          <section
            key={theme}
            data-testid={`theme-panel-${theme}`}
            aria-label={`${theme} theme`}
            className={`${theme} min-w-0 rounded-xl border bg-background p-4 text-foreground sm:p-6`}
          >
            <p className="mb-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {theme} theme
            </p>
            <Showcase />
          </section>
        ))}
      </div>
    </main>
  );
}
