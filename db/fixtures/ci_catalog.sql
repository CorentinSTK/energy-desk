-- CI FIXTURE — NOT MARKET DATA.
-- Loaded only into the throwaway Postgres of the CI `web` job, so the /data page can be tested end to
-- end. Never applied to any real database. Values are round placeholders, not observations.

insert into market.series (code, name, commodity, region, unit, frequency, source, source_ref,
                           license, attribution, publication_lag_days)
values
    ('fx.eurusd', 'CI fixture — EUR/USD', 'fx', 'Euro area', 'USD per EUR', 'daily', 'ecb',
     'D.USD.EUR.SP00.A', 'CI fixture licence', 'CI fixture attribution', 0),
    ('agsi.de.storage', 'CI fixture — Germany gas in storage', 'natgas', 'Germany', 'TWh', 'daily',
     'gie_agsi', 'DE|gasInStorage', 'CI fixture licence', 'CI fixture attribution', 1),
    ('eia.us_crude_stocks', 'CI fixture — US crude stocks', 'crude', 'US', 'mb', 'weekly', 'eia',
     'petroleum/stoc/wstk|WCESTUS1', 'CI fixture licence', null, 5);

-- Recent daily points (so freshness is computed against the current date), with one gap.
insert into market.observations (series_id, ts, value)
select s.id, d, 1.0
from market.series s,
     generate_series(current_date - 30, current_date - 1, interval '1 day') as d
where s.code in ('fx.eurusd', 'agsi.de.storage')
  and d not between current_date - 20 and current_date - 12;

insert into market.observations (series_id, ts, value)
select s.id, d, 1.0
from market.series s, generate_series(current_date - 70, current_date - 7, interval '7 days') as d
where s.code = 'eia.us_crude_stocks';

insert into market.ingest_runs (source, started_at, finished_at, status, rows_written, rows_rejected, error)
values
    ('ecb', now() - interval '2 hours', now() - interval '2 hours', 'ok', 30, 0, null),
    ('gie_agsi', now() - interval '1 hour', now() - interval '1 hour', 'partial', 20, 1,
     'CI fixture — rejected rows example');
