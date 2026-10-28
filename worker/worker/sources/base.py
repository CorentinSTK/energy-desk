"""What every data source module provides (one module per source, BUILD_SPEC §4)."""

from abc import ABC, abstractmethod
from datetime import date, timedelta

import httpx
import psycopg

from worker.catalog import SeriesSpec
from worker.http_client import make_client
from worker.validate import Observation


class Source(ABC):
    #: Catalogue name: worker/catalog/<name>.yaml
    name: str
    #: How far before the last stored observation to re-fetch, to pick up provider revisions.
    lookback: timedelta = timedelta(days=14)
    #: Pause between two requests to the same provider, in seconds (politeness, rate limits).
    request_interval: float = 0.5

    def client(self) -> httpx.Client:
        """HTTP client for this source; override to add authentication headers."""
        return make_client()

    @abstractmethod
    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        """Observations for one series from `since` (inclusive), or the full history if None."""

    def persist(self, conn: psycopg.Connection) -> int:
        """Store data that is not a series (e.g. raw futures settlements). Called after the series
        are written, in non-dry runs only. Returns the number of rows written."""
        return 0
