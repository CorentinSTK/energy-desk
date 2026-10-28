"""Worker settings, read from the environment or from `worker/.env` (gitignored).

Secrets are `SecretStr`, so they never appear in reprs, logs or tracebacks.
"""

from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

WORKER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = WORKER_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=WORKER_DIR / ".env", extra="ignore")

    # Postgres URL of the database owner (Supabase session pooler), for migrations and ingestion.
    database_url: SecretStr | None = None

    eia_api_key: SecretStr | None = None
    fred_api_key: SecretStr | None = None
    gie_api_key: SecretStr | None = None
    entsoe_api_token: SecretStr | None = None


def get_settings() -> Settings:
    return Settings()


def require(value: SecretStr | None, name: str) -> str:
    """Return a secret's value, or fail naming the missing variable (never printing a value)."""
    if value is None or not value.get_secret_value():
        raise RuntimeError(f"{name} is not set. Add it to worker/.env or to the environment.")
    return value.get_secret_value()
