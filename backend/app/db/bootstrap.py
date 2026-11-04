"""Initialize a new empty database only: python -m app.db.bootstrap.

Existing databases must use Alembic upgrades; this command refuses their tables.
"""
import asyncio
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect

import app.models  # noqa: F401
from app.db.base import Base
from app.db.database import engine


def initialize(connection):
    if inspect(connection).get_table_names():
        raise RuntimeError("Database is not empty. Use alembic upgrade head instead.")
    Base.metadata.create_all(connection)
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    script = ScriptDirectory.from_config(config)
    MigrationContext.configure(connection).stamp(script, "head")


async def main():
    async with engine.begin() as connection:
        await connection.run_sync(initialize)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
