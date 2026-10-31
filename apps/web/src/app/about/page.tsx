import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

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
    <main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">About</h1>
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
        <p>
          A Python worker, run on a schedule by GitHub Actions, fetches each source, validates it
          and stores it in Postgres (Supabase). The site is a Next.js application on Vercel that
          reads the database through a read-only role. The main choices and their trade-offs are
          recorded as{" "}
          <a href={ADR_URL} className={LINK} rel="noreferrer" target="_blank">
            architecture decision records
          </a>
          , and the{" "}
          <a href={REPO_URL} className={LINK} rel="noreferrer" target="_blank">
            source code
          </a>{" "}
          is public.
        </p>
      </Section>

      <Section title="Author">
        <p>
          I am {AUTHOR.name}, a Master in Finance student (financial markets) at ESSEC Business
          School in Singapore, with an engineering degree in information systems from EPF. I am
          currently an intern in commodity trading and quantitative analytics at Tradition in
          Singapore, alongside crude oil and gasoline desks. Before that, I researched commodity
          futures strategies at the ESSEC Hedge Fund, a student fund.
        </p>
        <p>
          I built Energy Desk to learn the fundamentals behind energy prices, and to practise
          handling market data the way a trading desk needs it.
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
