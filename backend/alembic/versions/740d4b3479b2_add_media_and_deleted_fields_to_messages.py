"""add media and deleted fields to messages

Revision ID: 740d4b3479b2
Revises: 001_baseline_current_schema
Create Date: 2026-06-05 12:43:59.971457

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "740d4b3479b2"
down_revision: Union[str, None] = "001_baseline_current_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("media_url", sa.String(), nullable=True),
    )

    op.add_column(
        "messages",
        sa.Column("media_type", sa.String(), nullable=True),
    )

    op.add_column(
        "messages",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_messages_deleted_at",
        "messages",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_messages_deleted_at", table_name="messages")

    op.drop_column("messages", "deleted_at")
    op.drop_column("messages", "media_type")
    op.drop_column("messages", "media_url")