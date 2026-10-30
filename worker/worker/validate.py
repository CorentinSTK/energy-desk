"""Validation of fetched observations before they are stored (BUILD_SPEC §9).

Pure functions. Invalid rows are rejected with a reason and counted in `ingest_runs`; they are never
silently dropped, corrected or filled. Gaps are not errors: they are reported by the /data page.
"""

import math
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta

from worker.catalog import SeriesSpec


@dataclass(frozen=True)
class Observation:
    series_code: str
    ts: datetime  # timezone-aware, UTC
    value: float


@dataclass(frozen=True)
class Rejection:
    observation: Observation
    reason: str


@dataclass(frozen=True)
class ValidationResult:
    valid: list[Observation]
    rejected: list[Rejection]


# Allows for providers that stamp today's value with tomorrow's date in UTC (time zones).
FUTURE_TOLERANCE = timedelta(days=1)


def validate(
    observations: Iterable[Observation],
    specs: dict[str, SeriesSpec],
    now: datetime,
) -> ValidationResult:
    """Check each observation; the first problem found is the rejection reason."""
    valid: list[Observation] = []
    rejected: list[Rejection] = []
    seen: set[tuple[str, datetime]] = set()

    for obs in observations:
        reason = _problem(obs, specs, now, seen)
        if reason is None:
            valid.append(obs)
            seen.add((obs.series_code, obs.ts))
        else:
            rejected.append(Rejection(obs, reason))
    return ValidationResult(valid, rejected)


def _problem(
    obs: Observation,
    specs: dict[str, SeriesSpec],
    now: datetime,
    seen: set[tuple[str, datetime]],
) -> str | None:
    spec = specs.get(obs.series_code)
    if spec is None:
        return "unknown series"
    if obs.ts.tzinfo is None:
        return "timestamp without time zone"
    if obs.ts > now + FUTURE_TOLERANCE + timedelta(days=spec.delivery_lead_days):
        return "timestamp in the future"
    if not math.isfinite(obs.value):
        return "non-finite value"
    if not spec.plausible_min <= obs.value <= spec.plausible_max:
        return f"outside plausible range [{spec.plausible_min}, {spec.plausible_max}]"
    if (obs.series_code, obs.ts) in seen:
        return "duplicate timestamp"
    return None


def summarise_rejections(rejections: list[Rejection], limit: int = 5) -> str:
    """Short text for `ingest_runs.error`: counts per reason plus a few examples."""
    by_reason: dict[str, int] = {}
    for r in rejections:
        by_reason[r.reason] = by_reason.get(r.reason, 0) + 1
    counts = "; ".join(f"{reason}: {n}" for reason, n in sorted(by_reason.items()))
    examples = ", ".join(
        f"{r.observation.series_code}@{r.observation.ts.date()}={r.observation.value}"
        for r in rejections[:limit]
    )
    return f"Rejected rows — {counts}. Examples: {examples}"
