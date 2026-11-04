"""Add social inbox, groups and opt-in publications."""
from alembic import op
import sqlalchemy as sa

revision = "c62026110402"
down_revision = "c62026110401"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('conversation_settings',
        sa.Column('user_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('partner_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('pinned', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('muted', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('hidden', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('theme', sa.String(length=40), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['partner_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_table('user_blocks',
        sa.Column('user_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('target_id', sa.String(), nullable=False, primary_key=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_table('chat_groups',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('owner_id', sa.String(), nullable=False, primary_key=False),
        sa.Column('name', sa.String(length=80), nullable=False, primary_key=False),
        sa.Column('theme', sa.String(length=40), nullable=False, primary_key=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_table('chat_members',
        sa.Column('group_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('pinned', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('muted', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('hidden', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True, primary_key=False),
        sa.ForeignKeyConstraint(['group_id'], ['chat_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_table('group_messages',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('group_id', sa.String(), nullable=False, primary_key=False),
        sa.Column('sender_id', sa.String(), nullable=False, primary_key=False),
        sa.Column('client_id', sa.String(length=160), nullable=False, primary_key=False),
        sa.Column('content', sa.Text(), nullable=False, primary_key=False),
        sa.Column('media_url', sa.String(), nullable=True, primary_key=False),
        sa.Column('media_type', sa.String(length=10), nullable=True, primary_key=False),
        sa.Column('hidden_for', sa.JSON(), nullable=False, primary_key=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['group_id'], ['chat_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('client_id'),
    )
    op.create_index('ix_group_messages_created_at', 'group_messages', ['created_at'])
    op.create_index('ix_group_messages_group_id', 'group_messages', ['group_id'])
    op.create_table('social_profiles',
        sa.Column('user_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('bio', sa.String(length=400), nullable=False, primary_key=False),
        sa.Column('birth_year', sa.String(length=4), nullable=False, primary_key=False),
        sa.Column('goal', sa.String(length=160), nullable=False, primary_key=False),
        sa.Column('show_rating', sa.Boolean(), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_table('stories',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False, primary_key=False),
        sa.Column('media_url', sa.String(), nullable=False, primary_key=False),
        sa.Column('media_type', sa.String(length=10), nullable=False, primary_key=False),
        sa.Column('caption', sa.String(length=500), nullable=False, primary_key=False),
        sa.Column('visibility', sa.String(length=12), nullable=False, primary_key=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True, primary_key=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_stories_user_id', 'stories', ['user_id'])
    op.create_index('ix_stories_expires_at', 'stories', ['expires_at'])
    op.create_table('story_views',
        sa.Column('story_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False, primary_key=True),
        sa.Column('liked', sa.Boolean(), nullable=False, primary_key=False),
        sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.ForeignKeyConstraint(['story_id'], ['stories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )

def downgrade():
    op.drop_table('story_views')
    op.drop_table('stories')
    op.drop_table('social_profiles')
    op.drop_table('group_messages')
    op.drop_table('chat_members')
    op.drop_table('chat_groups')
    op.drop_table('user_blocks')
    op.drop_table('conversation_settings')
