"""Fixtures for tests that need a real Postgres (migrations, roles, views).

Set TEST_DATABASE_URL to a superuser connection on a disposable server, e.g.
    TEST_DATABASE_URL=postgresql://postgres@localhost:54329/postgres
Each test session creates a fresh database `energy_desk_test` and drops it afterwards.
Without TEST_DATABASE_URL these tests are skipped (CI always sets it).
"""

import os
from collections.abc import Iterator

import psycopg
import pytest
from psycopg.conninfo import make_conninfo

from worker.migrate import apply, load_migrations

TEST_DB = "energy_desk_test"
# Roles that exist on Supabase but not on a plain Postgres server.
SUPABASE_ROLES = ("anon", "authenticated")


def admin_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        if os.environ.get("CI"):
            pytest.fail("TEST_DATABASE_URL must be set in CI: database tests may not be skipped")
        pytest.skip("TEST_DATABASE_URL not set")
    return url


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    url = admin_url()
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute(f"drop database if exists {TEST_DB} with (force)")
        admin.execute(f"create database {TEST_DB}")
        for role in SUPABASE_ROLES:
            exists = admin.execute("select 1 from pg_roles where rolname = %s", (role,)).fetchone()
            if not exists:
                admin.execute(f"create role {role} nologin")
    test_url = make_conninfo(url, dbname=TEST_DB)
    with psycopg.connect(test_url) as conn:
        apply(conn, load_migrations())
    yield test_url
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute(f"drop database if exists {TEST_DB} with (force)")


@pytest.fixture
def conn(database_url: str) -> Iterator[psycopg.Connection]:
    """A connection whose changes are rolled back after each test."""
    with psycopg.connect(database_url) as connection:
        yield connection
        connection.rollback()
