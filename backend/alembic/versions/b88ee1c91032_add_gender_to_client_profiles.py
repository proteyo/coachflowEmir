"""add gender to client profiles

Revision ID: b88ee1c91032
Revises: b55f4309e400
Create Date: 2026-06-06 14:05:55.228745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b88ee1c91032"
down_revision: Union[str, None] = "b55f4309e400"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "client_profiles",
        sa.Column(
            "gender",
            sa.String(),
            nullable=False,
            server_default="male",
        ),
    )

    op.alter_column(
        "client_profiles",
        "gender",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("client_profiles", "gender")