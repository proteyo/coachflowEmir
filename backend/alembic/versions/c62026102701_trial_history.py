"""Persist trial history and normalize historical weight dates.

Revision ID: c62026102701
Revises: b88ee1c91032
"""
from alembic import op
import sqlalchemy as sa

revision = "c62026102701"
down_revision = "b88ee1c91032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("progress_entries", sa.Column("created_at", sa.DateTime(timezone=True),
                                               nullable=False, server_default=sa.func.now()))
    # A previously started subscription must not grant another trial on upgrade.
    op.execute("""UPDATE users SET trial_started_at = (
        SELECT MIN(start_date) FROM subscriptions WHERE subscriptions.coach_id = users.id
    ) WHERE role = 'coach'""")
    op.execute("""UPDATE progress_entries SET created_at = date::timestamptz
        WHERE date ~ '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}'""")
    op.execute("""UPDATE progress_entries SET date = SUBSTRING(date FROM 1 FOR 10)
        WHERE date ~ '^\\d{4}-\\d{2}-\\d{2}T'""")
    op.execute("""UPDATE client_profiles SET current_weight = COALESCE(
        (SELECT weight FROM progress_entries WHERE client_id = client_profiles.user_id
         ORDER BY date DESC, created_at DESC, id DESC LIMIT 1), start_weight)
        WHERE EXISTS (SELECT 1 FROM progress_entries WHERE client_id = client_profiles.user_id)""")


def downgrade() -> None:
    op.drop_column("progress_entries", "created_at")
    op.drop_column("users", "trial_started_at")
