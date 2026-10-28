from pathlib import Path

import pytest
from pydantic import ValidationError

from worker.catalog import available_sources, load_catalog


def test_every_catalogue_file_is_valid() -> None:
    sources = available_sources()
    assert sources, "no catalogue files found"
    for source in sources:
        catalog = load_catalog(source)
        assert catalog.series
        for spec in catalog.series:
            assert catalog.licence_for(spec).name


def test_series_codes_are_unique_across_sources() -> None:
    codes = [s.code for source in available_sources() for s in load_catalog(source).series]
    assert len(codes) == len(set(codes))


def test_invalid_catalogue_is_rejected(tmp_path: Path) -> None:
    (tmp_path / "bad.yaml").write_text(
        "source: bad\nlicence: {name: x}\nlicence_checked: 2026-01-01\nseries:\n"
        "  - {code: a, name: a, commodity: gold, region: x, unit: x, frequency: daily,"
        " source_ref: x, plausible_min: 0, plausible_max: 1}\n"
    )
    with pytest.raises(ValidationError):
        load_catalog("bad", tmp_path)


def test_plausible_range_must_be_ordered(tmp_path: Path) -> None:
    (tmp_path / "bad.yaml").write_text(
        "source: bad\nlicence: {name: x}\nlicence_checked: 2026-01-01\nseries:\n"
        "  - {code: a, name: a, commodity: fx, region: x, unit: x, frequency: daily,"
        " source_ref: x, plausible_min: 5, plausible_max: 1}\n"
    )
    with pytest.raises(ValidationError, match="plausible_min"):
        load_catalog("bad", tmp_path)
