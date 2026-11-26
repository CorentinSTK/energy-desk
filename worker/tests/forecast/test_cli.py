"""The forecast command line can resolve every registered model before reading the database."""

import pytest

from worker.forecast.__main__ import MODEL_CLASSES, build_models, model_inputs
from worker.forecast.data import History


@pytest.mark.parametrize("model_id", list(MODEL_CLASSES))
def test_every_model_has_its_inputs_and_builds(
    model_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    inputs = model_inputs(model_id)
    assert inputs and all(isinstance(c, str) for c in inputs)
    # Backtest mode builds without network access except French holidays, stubbed here.
    monkeypatch.setattr("worker.forecast.__main__.fetch_holidays", lambda client: set())
    [model] = build_models([model_id], History(), live=False)
    assert model.id == model_id
    assert tuple(model.inputs) == tuple(inputs)


def test_a_late_scheduled_run_keeps_the_evening_issue_date() -> None:
    from datetime import UTC, date, datetime

    from worker.forecast.__main__ import scheduled_issue_date

    assert scheduled_issue_date(datetime(2026, 11, 25, 22, 31, tzinfo=UTC)) == date(2026, 11, 25)
    assert scheduled_issue_date(datetime(2026, 11, 26, 4, 15, tzinfo=UTC)) == date(2026, 11, 25)
