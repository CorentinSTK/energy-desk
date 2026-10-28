from pathlib import Path

import psycopg
import pytest

from worker.migrate import Migration, MigrationError, apply, load_migrations, pending


def test_all_migrations_applied_and_rerun_is_a_no_op(conn: psycopg.Connection) -> None:
    assert pending(conn, load_migrations()) == []
    assert apply(conn, load_migrations()) == []


def test_modified_migration_is_refused(conn: psycopg.Connection) -> None:
    edited = [Migration(m.filename, m.sql + "\n-- edited") for m in load_migrations()]
    with pytest.raises(MigrationError, match="modified after being applied"):
        pending(conn, edited)


def test_deleted_migration_is_refused(conn: psycopg.Connection) -> None:
    with pytest.raises(MigrationError, match="missing from disk"):
        pending(conn, [])


def test_bad_filename_is_refused(tmp_path: Path) -> None:
    (tmp_path / "1_bad.sql").write_text("select 1;")
    with pytest.raises(MigrationError, match="Bad migration filename"):
        load_migrations(tmp_path)


def test_duplicate_number_is_refused(tmp_path: Path) -> None:
    (tmp_path / "002_a.sql").write_text("select 1;")
    (tmp_path / "002_b.sql").write_text("select 1;")
    with pytest.raises(MigrationError, match="same number"):
        load_migrations(tmp_path)
