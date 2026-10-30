"""Series catalogue as code: one YAML file per source in worker/catalog/.

Each file states the source's licence (confirmed from the provider's terms, with the date it was
checked) and its series. A series may override the licence fields. The catalogue is validated by
pydantic and synced into `market.series`.
"""

from datetime import date
from pathlib import Path
from typing import Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from worker.config import WORKER_DIR

CATALOG_DIR = WORKER_DIR / "catalog"

Commodity = Literal["crude", "products", "natgas", "lng", "lpg", "power", "fx", "macro"]
Frequency = Literal["half_hourly", "hourly", "daily", "weekly", "monthly"]
PriceKind = Literal["spot", "futures", "index", "assessment"]


class Licence(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str
    url: str | None = None
    attribution: str | None = None


class SeriesSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    code: str = Field(pattern=r"^[a-z0-9][a-z0-9_.-]*$")
    name: str
    commodity: Commodity
    region: str
    unit: str
    frequency: Frequency
    source_ref: str
    description: str = ""
    price_kind: PriceKind | None = None
    is_unofficial: bool = False
    # The unit string the provider returns, when it differs in spelling from `unit` (e.g. "$/BBL").
    # Sources that report units check it, so a provider-side unit change fails loudly.
    source_unit: str | None = None
    # Normal delay between a value's date and its publication; freshness ignores this much age.
    publication_lag_days: int = Field(default=0, ge=0)
    # Largest normal interval between observations, when the frequency's default does not fit (e.g.
    # 1 for daily series published every calendar day, where the default allows for weekends).
    gap_threshold_days: float | None = Field(default=None, gt=0)
    # Days ahead of today a value may be dated: day-ahead auctions price tomorrow's delivery hours.
    # Validation only (not stored); everything else is rejected beyond one day of time-zone slack.
    delivery_lead_days: int = Field(default=0, ge=0, le=7)
    # Values outside this range are rejected by validation, not stored.
    plausible_min: float
    plausible_max: float
    licence: Licence | None = None  # overrides the source licence

    @model_validator(mode="after")
    def _range_is_ordered(self) -> Self:
        if self.plausible_min >= self.plausible_max:
            raise ValueError(f"{self.code}: plausible_min must be below plausible_max")
        return self


class SourceCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source: str
    licence: Licence
    licence_checked: date  # when the provider's terms were last read
    series: list[SeriesSpec]

    @model_validator(mode="after")
    def _codes_are_unique(self) -> Self:
        codes = [s.code for s in self.series]
        duplicates = {c for c in codes if codes.count(c) > 1}
        if duplicates:
            raise ValueError(f"duplicate series codes: {sorted(duplicates)}")
        return self

    def licence_for(self, spec: SeriesSpec) -> Licence:
        return spec.licence or self.licence


def load_catalog(source: str, directory: Path = CATALOG_DIR) -> SourceCatalog:
    path = directory / f"{source}.yaml"
    catalog = SourceCatalog.model_validate(yaml.safe_load(path.read_text()))
    if catalog.source != source:
        raise ValueError(f"{path.name} declares source {catalog.source!r}, expected {source!r}")
    return catalog


def available_sources(directory: Path = CATALOG_DIR) -> list[str]:
    return sorted(p.stem for p in directory.glob("*.yaml"))
