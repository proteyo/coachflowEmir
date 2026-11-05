"""Private expenses and per-story reply preference; additive."""
from alembic import op
import sqlalchemy as sa
revision = "c62026110501"
down_revision = "c62026110403"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("stories", sa.Column("replies_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table("coach_expenses", sa.Column("id", sa.String(), primary_key=True), sa.Column("coach_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("amount", sa.Numeric(12, 2), nullable=False), sa.Column("paid_on", sa.Date(), nullable=False), sa.Column("note", sa.String(300), nullable=False), sa.Column("request_id", sa.String(160), nullable=False, unique=True))
    op.create_index("ix_coach_expenses_coach_id", "coach_expenses", ["coach_id"])
    op.create_index("ix_coach_expenses_paid_on", "coach_expenses", ["paid_on"])

def downgrade():
    op.drop_table("coach_expenses")
    op.drop_column("stories", "replies_enabled")
