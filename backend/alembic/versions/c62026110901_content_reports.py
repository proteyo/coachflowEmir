"""Private moderation queue; additive, no existing data changes."""
from alembic import op
import sqlalchemy as sa
revision = "c62026110901"
down_revision = "c62026110701"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users",sa.Column("terms_version",sa.String(40),nullable=True))
    for name in ("terms_accepted_at","adult_confirmed_at","health_consent_at"):
        op.add_column("users",sa.Column(name,sa.DateTime(timezone=True),nullable=True))
    op.create_table("content_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("reporter_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.String(160), nullable=False),
        sa.Column("reason", sa.String(20), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("reporter_id", "target_type", "target_id", name="uq_report_target_owner"))
    op.create_index("ix_content_reports_reporter_id", "content_reports", ["reporter_id"])
    op.create_index("ix_content_reports_status", "content_reports", ["status"])


def downgrade():
    op.drop_table("content_reports")
    for name in ("health_consent_at","adult_confirmed_at","terms_accepted_at","terms_version"):
        op.drop_column("users",name)
