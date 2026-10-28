"""Apply SQL migrations from db/migrations/ in order.

    uv run python -m worker.migrate            # apply pending migrations
    uv run python -m worker.migrate --status   # list applied and pending, change nothing

Each applied file is recorded in `ops.schema_migrations` with a SHA-256 checksum. If a migration
that was already applied has changed on disk, the runner stops: migrations are never edited once
applied (CLAUDE.md); a change goes in a new file. Each migration runs in its own transaction.
"""

import argparse
import hashlib
import re
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import psycopg

from worker.config import REPO_ROOT, get_settings, require

MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"
FILENAME_PATTERN = re.compile(r"^\d{3}_[a-z0-9_]+\.sql$")

BOOTSTRAP_SQL = """
create schema if not exists ops;
revoke all on schema ops from public;
create table if not exists ops.schema_migrations (
    filename   text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
);
"""


class MigrationError(Exception):
    pass


@dataclass(frozen=True)
class Migration:
    filename: str
    sql: str

    @property
    def checksum(self) -> str:
        return hashlib.sha256(self.sql.encode()).hexdigest()


def load_migrations(directory: Path = MIGRATIONS_DIR) -> list[Migration]:
    """Read migration files in filename order; reject names not shaped NNN_description.sql."""
    migrations = []
    for path in sorted(directory.glob("*.sql")):
        if not FILENAME_PATTERN.match(path.name):
            raise MigrationError(
                f"Bad migration filename {path.name!r}: expected NNN_description.sql"
            )
        migrations.append(Migration(path.name, path.read_text()))
    numbers = [m.filename[:3] for m in migrations]
    if len(numbers) != len(set(numbers)):
        raise MigrationError("Two migrations share the same number.")
    return migrations


def pending(conn: psycopg.Connection, migrations: list[Migration]) -> list[Migration]:
    """Migrations not yet applied. Raises if an applied migration was modified or deleted."""
    conn.execute(BOOTSTRAP_SQL)
    rows = conn.execute("select filename, checksum from ops.schema_migrations").fetchall()
    applied: dict[str, str] = dict(rows)
    on_disk = {m.filename for m in migrations}
    missing = sorted(set(applied) - on_disk)
    if missing:
        raise MigrationError(f"Applied migrations missing from disk: {', '.join(missing)}")
    for m in migrations:
        if m.filename in applied and applied[m.filename] != m.checksum:
            raise MigrationError(
                f"{m.filename} was modified after being applied. Revert it and add a new migration."
            )
    return [m for m in migrations if m.filename not in applied]


def apply(conn: psycopg.Connection, migrations: list[Migration]) -> list[str]:
    """Apply pending migrations, each in its own transaction. Returns the filenames applied."""
    todo = pending(conn, migrations)
    conn.commit()
    done = []
    for m in todo:
        with conn.transaction():
            conn.execute(m.sql.encode())
            conn.execute(
                "insert into ops.schema_migrations (filename, checksum) values (%s, %s)",
                (m.filename, m.checksum),
            )
        done.append(m.filename)
    return done


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worker.migrate", description=__doc__.splitlines()[0])
    parser.add_argument("--status", action="store_true", help="list pending migrations, apply none")
    args = parser.parse_args(argv)

    url = require(get_settings().database_url, "DATABASE_URL")
    migrations = load_migrations()
    with psycopg.connect(url) as conn:
        if args.status:
            todo = pending(conn, migrations)
            print(f"{len(migrations) - len(todo)} applied, {len(todo)} pending")
            for m in todo:
                print(f"  pending: {m.filename}")
            return 0
        done = apply(conn, migrations)
    print(f"Applied {len(done)} migration(s)" + (f": {', '.join(done)}" if done else ""))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except MigrationError as error:
        print(f"Migration error: {error}", file=sys.stderr)
        sys.exit(1)
