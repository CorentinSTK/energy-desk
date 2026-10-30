# Energy Desk (working name)

A public research platform for European energy markets (gas, LNG, power) and global oil, built on free,
official data. Every number is sourced, labelled with its unit and licence, and traceable to its origin.

> Status: early development. Milestone M0 (scaffold, design system, CI, deploy) is done; live at
> https://energy-desk-two.vercel.app.

## Documentation

- [`BUILD_SPEC.md`](BUILD_SPEC.md): scope, data sources, architecture, design and milestones.
- [`docs/adr/`](docs/adr/): architecture decision records.
- [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md): progress log.

## Credits

Builds on ideas and code from the author's earlier project,
[oil-tracker](https://github.com/CorentinSTK/oil-tracker): EIA series IDs, the weekly seasonal norm
(ISO weeks, week 53 folded into 52) and the futures expiry rules used to rebuild generic months.

## Licence

Code: [MIT](LICENSE). Data shown on the site belongs to its sources and is used under each source's own
licence, listed on the `/data` page; no exchange or licensed data is redistributed.
