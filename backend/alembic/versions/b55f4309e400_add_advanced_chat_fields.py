"""add advanced chat fields

Revision ID: b55f4309e400
Revises: 740d4b3479b2
Create Date: 2026-06-05 22:05:36.870649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b55f4309e400"
down_revision: Union[str, None] = "740d4b3479b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New message columns ───────────────────────────────────────────────────

    op.add_column(
        "messages",
        sa.Column("client_temp_id", sa.String(), nullable=True),
    )

    op.add_column(
        "messages",
        sa.Column("reply_to_id", sa.String(), nullable=True),
    )

    op.add_column(
        "messages",
        sa.Column("media_thumbnail_url", sa.String(), nullable=True),
    )

    op.add_column(
        "messages",
        sa.Column(
            "reactions",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )

    op.add_column(
        "messages",
        sa.Column(
            "pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "messages",
        sa.Column(
            "deleted_for_sender",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "messages",
        sa.Column(
            "deleted_for_receiver",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "messages",
        sa.Column(
            "deleted_for_everyone",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "messages",
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Foreign keys ──────────────────────────────────────────────────────────

    op.create_foreign_key(
        "fk_messages_reply_to_id_messages",
        "messages",
        "messages",
        ["reply_to_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ── Indexes ───────────────────────────────────────────────────────────────

    op.create_index(
        "ix_messages_client_temp_id",
        "messages",
        ["client_temp_id"],
        unique=False,
    )

    op.create_index(
        "ix_messages_reply_to_id",
        "messages",
        ["reply_to_id"],
        unique=False,
    )

    op.create_index(
        "ix_messages_edited_at",
        "messages",
        ["edited_at"],
        unique=False,
    )

    op.create_index(
        "ix_messages_pinned",
        "messages",
        ["pinned"],
        unique=False,
    )

    op.create_index(
        "ix_messages_deleted_for_everyone",
        "messages",
        ["deleted_for_everyone"],
        unique=False,
    )

    op.create_index(
        "uq_messages_client_temp_id_not_null",
        "messages",
        ["client_temp_id"],
        unique=True,
        postgresql_where=sa.text("client_temp_id IS NOT NULL"),
    )

    # Убираем server_default после заполнения существующих строк.
    op.alter_column(
        "messages",
        "reactions",
        server_default=None,
    )

    op.alter_column(
        "messages",
        "pinned",
        server_default=None,
    )

    op.alter_column(
        "messages",
        "deleted_for_sender",
        server_default=None,
    )

    op.alter_column(
        "messages",
        "deleted_for_receiver",
        server_default=None,
    )

    op.alter_column(
        "messages",
        "deleted_for_everyone",
        server_default=None,
    )


def downgrade() -> None:
    # ── Indexes ───────────────────────────────────────────────────────────────

    op.drop_index(
        "uq_messages_client_temp_id_not_null",
        table_name="messages",
        postgresql_where=sa.text("client_temp_id IS NOT NULL"),
    )

    op.drop_index("ix_messages_deleted_for_everyone", table_name="messages")
    op.drop_index("ix_messages_pinned", table_name="messages")
    op.drop_index("ix_messages_edited_at", table_name="messages")
    op.drop_index("ix_messages_reply_to_id", table_name="messages")
    op.drop_index("ix_messages_client_temp_id", table_name="messages")

    # ── Foreign keys ──────────────────────────────────────────────────────────

    op.drop_constraint(
        "fk_messages_reply_to_id_messages",
        "messages",
        type_="foreignkey",
    )

    # ── Columns ───────────────────────────────────────────────────────────────

    op.drop_column("messages", "edited_at")
    op.drop_column("messages", "deleted_for_everyone")
    op.drop_column("messages", "deleted_for_receiver")
    op.drop_column("messages", "deleted_for_sender")
    op.drop_column("messages", "pinned")
    op.drop_column("messages", "reactions")
    op.drop_column("messages", "media_thumbnail_url")
    op.drop_column("messages", "reply_to_id")
    op.drop_column("messages", "client_temp_id")