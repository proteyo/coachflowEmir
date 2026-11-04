"""Persist shared authentication request limits and refresh token rotation."""
from alembic import op
import sqlalchemy as sa

revision = "c62026110401"
down_revision = "c62026102701"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("purchase_claims",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False))
    op.create_index("ix_purchase_claims_user_id", "purchase_claims", ["user_id"])
    # Refuse ambiguous historical ownership instead of arbitrarily picking one.
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT google_purchase_token_hash FROM subscriptions
            WHERE google_purchase_token_hash IS NOT NULL GROUP BY google_purchase_token_hash
            HAVING COUNT(DISTINCT coach_id) > 1) THEN
            RAISE EXCEPTION 'Resolve duplicate Google purchase ownership before migration';
        END IF;
    END $$""")
    op.execute("""INSERT INTO purchase_claims (token_hash, user_id)
        SELECT DISTINCT google_purchase_token_hash, coach_id FROM subscriptions
        WHERE google_purchase_token_hash IS NOT NULL""")
    op.create_table("auth_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.create_table("auth_rate_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_auth_rate_limits_expires_at", "auth_rate_limits", ["expires_at"])


def downgrade():
    op.drop_table("purchase_claims")
    op.drop_table("auth_rate_limits")
    op.drop_table("auth_sessions")
