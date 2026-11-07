"""Optional public cover and its opacity for both account roles; additive."""
from alembic import op
import sqlalchemy as sa
revision = "c62026110701"
down_revision = "c62026110501"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("social_profiles", sa.Column("cover_image_url", sa.String(1000), nullable=True))
    op.add_column("social_profiles", sa.Column("cover_opacity", sa.Float(), nullable=False, server_default="0.35"))

def downgrade():
    op.drop_column("social_profiles", "cover_opacity")
    op.drop_column("social_profiles", "cover_image_url")
