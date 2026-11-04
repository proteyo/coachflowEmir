"""Read-only deployment checks: python -m app.db.preflight."""
import asyncio
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from app.db.database import engine


def check(connection):
    tables = set(inspect(connection).get_table_names())
    if not tables:
        raise RuntimeError("Empty database: initialize it with python -m app.db.bootstrap")
    if "alembic_version" not in tables:
        raise RuntimeError("Existing schema is not stamped. Review its schema before assigning a baseline revision.")
    revisions = list(connection.execute(text("SELECT version_num FROM alembic_version")).scalars())
    script = ScriptDirectory.from_config(Config("alembic.ini"))
    if len(revisions) != 1 or script.get_revision(revisions[0]) is None:
        raise RuntimeError("Unexpected Alembic revision. Review database history before deployment.")
    duplicates = connection.execute(text("""SELECT COUNT(*) FROM (
        SELECT google_purchase_token_hash FROM subscriptions
        WHERE google_purchase_token_hash IS NOT NULL GROUP BY google_purchase_token_hash
        HAVING COUNT(DISTINCT coach_id) > 1
    ) conflicts""")).scalar_one()
    if duplicates:
        raise RuntimeError("Conflicting purchase ownership found. Resolve it before migration.")
    print(f"Preflight passed; current revision {revisions[0]}, target {script.get_current_head()}. No data changed.")


async def main():
    async with engine.connect() as connection:
        await connection.run_sync(check)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
