"""baseline current schema

Revision ID: 001_baseline_current_schema
Revises:
Create Date: 2026-05-22

This migration is a baseline for the existing production database.

The current Render PostgreSQL database already has all tables created by the
application. Therefore this migration intentionally does not create or drop
tables.

After deploying this migration, the production database must be marked with:

    alembic stamp head

All future schema changes must be added as normal Alembic migrations.
"""

from collections.abc import Sequence

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


revision: str = "001_baseline_current_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass