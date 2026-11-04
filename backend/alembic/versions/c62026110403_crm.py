"""Private coach CRM and reversible coaching access."""
from alembic import op
import sqlalchemy as sa

revision = "c62026110403"
down_revision = "c62026110402"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('client_engagements',
        sa.Column('coach_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('client_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('status', sa.String(length=12), nullable=False, primary_key=False),
        sa.Column('starts_on', sa.Date(), nullable=True, primary_key=False),
        sa.Column('ends_on', sa.Date(), nullable=True, primary_key=False),
        sa.Column('monthly_fee', sa.Numeric(precision=12, scale=2), nullable=False, primary_key=False),
        sa.Column('notes', sa.Text(), nullable=False, primary_key=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['coach_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_table('client_payments',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('coach_id', sa.String(), nullable=False, primary_key=False),
        sa.Column('client_id', sa.String(), nullable=False, primary_key=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False, primary_key=False),
        sa.Column('paid_on', sa.Date(), nullable=False, primary_key=False),
        sa.Column('note', sa.String(length=300), nullable=False, primary_key=False),
        sa.Column('request_id', sa.String(length=160), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['coach_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('request_id'),
    )
    op.create_index('ix_client_payments_coach_id', 'client_payments', ['coach_id'])
    op.create_index('ix_client_payments_paid_on', 'client_payments', ['paid_on'])
    op.create_index('ix_client_payments_client_id', 'client_payments', ['client_id'])
    op.create_index("ix_client_engagement_client_updated", "client_engagements", ["client_id", "updated_at"])

def downgrade():
    op.drop_table('client_payments')
    op.drop_table('client_engagements')
