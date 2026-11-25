import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";

import { Architecture } from "@/components/about/architecture";
import { KeyFigures } from "@/components/about/key-figures";

import { ADR_URL, AUTHOR, REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About — Energy Desk",
  description: "Why Energy Desk exists, how it is built, and who built it.",
};

const LINK = "text-primary underline underline-offset-2";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-3 leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p className="text-text-secondary">A personal project, built in the open.</p>
      </header>

      <Section title="The project">
        <p>
          Energy Desk reads European gas, LNG and power, and global oil, from free official sources:
          storage, flows, demand, generation, inventories and prices. Each market page answers a few
          questions a desk asks every morning, such as whether storage is high for the season, or
          whether a spread is unusual.
        </p>
        <p>
          The rules are strict on purpose. Every number traces back to a published observation,
          units are always shown, and missing data stays missing rather than being estimated.
          Forecasts are stored before their outcome is known and scored against simple baselines.
          The{" "}
          <Link href="/methodology" className={LINK}>
            methodology
          </Link>{" "}
          explains each calculation, and the{" "}
          <Link href="/data" className={LINK}>
            data catalogue
          </Link>{" "}
          lists every series with its source, licence and freshness.
        </p>
      </Section>

      <Section title="How it is built">
        <Suspense fallback={null}>
          <KeyFigures />
        </Suspense>
        <Architecture />
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="text-foreground">Traceable numbers.</span> Every value on the site is a
            stored observation or a documented computation on them; units are converted in one
            module and always shown; missing data stays missing.
          </li>
          <li>
            <span className="text-foreground">Honest forecasts.</span> Forecasts are stored when
            issued, never revised, and scored against naive and seasonal baselines in walk-forward
            backtests and live.
          </li>
          <li>
            <span className="text-foreground">Tested and reviewed.</span> Unit tests for every
            transform (Python and TypeScript), browser tests on desktop and phone widths, and
            continuous integration that must pass before anything reaches the live site.
          </li>
          <li>
            <span className="text-foreground">Decisions on record.</span> Data, model and
            architecture choices, with their trade-offs, are written up as{" "}
            <a href={ADR_URL} className={LINK} rel="noreferrer" target="_blank">
              architecture decision records
            </a>
            ; the{" "}
            <a href={REPO_URL} className={LINK} rel="noreferrer" target="_blank">
              source code
            </a>{" "}
            is public.
          </li>
        </ul>
      </Section>

      <Section title="Author">
        <p>
          Built by {AUTHOR.name}, Master in Finance student at ESSEC Business School, Singapore.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a href={AUTHOR.linkedin} className={LINK} rel="noreferrer" target="_blank">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={`mailto:${AUTHOR.email}`} className={LINK}>
              {AUTHOR.email}
            </a>
          </li>
          <li>
            <a href={REPO_URL} className={LINK} rel="noreferrer" target="_blank">
              GitHub
            </a>
          </li>
        </ul>
      </Section>
    </main>
  );
}
