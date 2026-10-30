"""Time series as models see them: plain (date, value) points, cut at what was known at issue time.

A `History` holds every stored observation of the series a model needs. `History.as_of(cutoffs)`
returns a copy that only keeps, for each series, observations dated on or before that series'
cutoff: the last date that was published when the forecast was issued. Models only ever receive such
a vintage, so they cannot use the future (tests check that a forecast made from the full history
equals the one made from the truncated history).

Limit: stored values are the latest vintage of each observation; earlier, unrevised values are not
kept. Backtests therefore use revised data where a source revises (documented on each model page).
"""

from bisect import bisect_right
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date, timedelta


@dataclass(frozen=True)
class Series:
    dates: list[date]
    values: list[float]

    @classmethod
    def of(cls, points: Iterable[tuple[date, float]]) -> "Series":
        ordered = sorted(points)
        return cls([d for d, _ in ordered], [v for _, v in ordered])

    def upto(self, cutoff: date) -> "Series":
        i = bisect_right(self.dates, cutoff)
        return Series(self.dates[:i], self.values[:i])

    def last(self) -> tuple[date, float] | None:
        return (self.dates[-1], self.values[-1]) if self.dates else None

    def get(self, day: date) -> float | None:
        i = bisect_right(self.dates, day) - 1
        return self.values[i] if i >= 0 and self.dates[i] == day else None

    def as_dict(self) -> dict[date, float]:
        return dict(zip(self.dates, self.values, strict=True))


@dataclass(frozen=True)
class History:
    series: Mapping[str, Series] = field(default_factory=dict)

    def __getitem__(self, code: str) -> Series:
        return self.series.get(code, Series([], []))

    def as_of(self, cutoffs: Mapping[str, date]) -> "History":
        """Keep only what was published by the cutoff of each series (no cutoff: series dropped)."""
        return History({code: self[code].upto(cutoffs[code]) for code in cutoffs})


def same_day_in_prior_years(day: date, years: int) -> list[date]:
    """The same month and day in each of the `years` years before; 29 February is skipped."""
    out = []
    for back in range(1, years + 1):
        try:
            out.append(day.replace(year=day.year - back))
        except ValueError:
            continue
    return out


def days(start: date, end: date, step: int = 1) -> list[date]:
    """Dates from start to end inclusive."""
    return [start + timedelta(days=i) for i in range(0, (end - start).days + 1, step)]
