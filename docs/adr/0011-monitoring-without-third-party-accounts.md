# ADR 0011 — Monitoring without third-party accounts

- Status: accepted
- Date: 2026-10-31

## Context

M8 asks for error monitoring. The site has two ways to break:
- the web app fails to render a page;
- the data stops arriving: an ingestion source fails, a series goes stale, or the forecast job stops.

A hosted error tracker (Sentry) would need an account, a DSN secret and client-side JavaScript. The
owner chose an approach without a third-party account.

## Decision

- **Server errors.** `apps/web/src/instrumentation.ts` implements `onRequestError` and logs one JSON
  line per error: route, render kind, digest, error name and message. It logs no headers, bodies or
  query values. The lines are readable in the Vercel runtime logs.
- **Health check.** `python -m worker.health` is run every 6 hours and on demand by `health.yml`. It
  fails if:
  - a key page does not answer 200, or shows the site's error state;
  - a series is **stale by the site's own rule**. The thresholds are mirrored from
    `apps/web/src/lib/freshness.ts`, and a test fails if the two drift apart;
  - the latest ingestion run of a source **failed**;
  - **no live forecast** was issued in the last 36 hours.
- It reads the database with the site's **read-only** role (`DATABASE_URL_READONLY`, a GitHub Actions
  secret), so it can read the web views and nothing else.
- A failing workflow emails the repository owner, which is GitHub's default for failed workflows.

## Consequences

- No browser-side error capture: client-side errors are not reported. The site's interactive code is
  small (the charts and the Lab), and both are covered by unit and end-to-end tests.
- Alerts come at most every 6 hours. Ingestion and forecast workflows also email on failure, as soon
  as they fail.
- Adding Sentry later only needs its SDK and a DSN; nothing here would need to change.
