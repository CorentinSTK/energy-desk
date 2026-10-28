# Session log

Newest entries at the bottom. One entry per working session or milestone.

## 2026-10-28 — Kickoff and spec revision

- Checked the environment: git, Python 3.13 (worker will pin 3.12 via uv), gh logged in; Node 24 and uv
  installed by the user.
- Revised `BUILD_SPEC.md`: Europe focus (gas, LNG, power DE/FR/GB in phase 1), source licences, Yahoo
  Finance policy, Frankfurt region, cron keep-alive, milestones M0–M8, forecast model 2 = France daily
  power demand.
- ADRs 0001–0004 written.
- Verified live: Yahoo `BZ=F` / `TTF=F` are NYMEX contracts, ICE gasoil and NBP absent; ODRÉ licence is
  Licence Ouverte v2.0; Energy-Charts DE price is CC BY 4.0 from SMARD.
- Started M0, step 1 (repository and root files).
