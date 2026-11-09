"""Explicit self-service erasure. Never run against an arbitrary supplied user ID.

The authenticated account becomes an irreversible tombstone so receipt hashes
stay bound for replay prevention. Personal fields and cascaded records go away;
media cleanup retries from role='deleting' without keeping an email or password.
"""
import asyncio
import logging
import secrets
import uuid
from sqlalchemy import String, cast, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base
from app.models.user import User
from app.models.social import ChatGroup, ChatMember
from app.models.message import Message
from app.models.progress import ProgressEntry
from app.core.security import hash_password

logger = logging.getLogger(__name__)


async def erase_account(user: User, db: AsyncSession):
    # Keep other participants' groups and messages when an owner leaves.
    groups = (await db.execute(select(ChatGroup).where(ChatGroup.owner_id == user.id))).scalars().all()
    for group in groups:
        successor = (await db.execute(select(ChatMember.user_id).where(
            ChatMember.group_id == group.id, ChatMember.user_id != user.id,
        ).order_by(ChatMember.user_id).limit(1))).scalar_one_or_none()
        if successor:
            group.owner_id = successor
    await db.flush()

    # Construct bounded, parameterized ownership queries from declared FKs.
    # SET NULL edges preserve records belonging to someone else. Receipt claims
    # intentionally retain only their hash and irreversible tombstone owner.
    users = User.__table__
    predicates = {users: users.c.id == user.id}
    tables = list(Base.metadata.sorted_tables)
    for table in tables:
        if table is users:
            continue
        clauses = []
        for fk in table.foreign_keys:
            parent = predicates.get(fk.column.table)
            if parent is not None and fk.ondelete == "CASCADE":
                clauses.append(fk.parent.in_(select(fk.column).where(parent)))
        if clauses:
            predicates[table] = or_(*clauses)
    for table in tables:
        for fk in table.foreign_keys:
            parent = predicates.get(fk.column.table)
            if parent is not None and fk.ondelete == "SET NULL":
                await db.execute(update(table).where(fk.parent.in_(select(fk.column).where(parent))).values({fk.parent.name: None}))

    # Reactions are JSON references, not foreign keys. Inspect only candidates
    # and page them rather than loading every conversation into memory.
    after = ""
    while True:
        messages = (await db.execute(select(Message).where(
            Message.id > after,
            cast(Message.reactions, String).contains('"' + user.id + '"', autoescape=True),
        ).order_by(Message.id).limit(250))).scalars().all()
        if not messages:
            break
        for message in messages:
            if isinstance(message.reactions, dict):
                message.reactions = {emoji: [owner for owner in owners if owner != user.id]
                                     for emoji, owners in message.reactions.items()
                                     if isinstance(owners, list) and any(owner != user.id for owner in owners)}
        after = messages[-1].id
    await db.flush()
    await db.execute(update(ProgressEntry).where(ProgressEntry.added_by == user.id).values(added_by="deleted"))
    for table in reversed(tables):
        if table is not users and table in predicates:
            await db.execute(delete(table).where(predicates[table]))

    # A tombstone cannot be authenticated, contacted, or linked to the old email.
    user.email = f"deleted_{uuid.uuid4().hex}@account.invalid"
    user.name = "Deleted account"
    user.password_hash = hash_password(secrets.token_urlsafe(48))
    user.role = "deleting"
    user.phone = user.avatar_url = user.client_code = None
    user.email_verified = False
    user.email_verification_code_hash = None
    user.email_verification_expires_at = user.email_verification_sent_at = None
    user.last_seen_at = user.trial_started_at = None
    user.terms_version = user.terms_accepted_at = user.adult_confirmed_at = user.health_consent_at = None
    db.add(user)
    await db.commit()


async def cleanup_erased_accounts():
    from app.db.database import AsyncSessionLocal
    from app.services.storage_service import delete_user_uploads
    async with AsyncSessionLocal() as db:
        ids = (await db.execute(select(User.id).where(User.role == "deleting").limit(10))).scalars().all()
    for owner in ids:
        try:
            complete = await asyncio.to_thread(delete_user_uploads, owner)
            if complete:
                async with AsyncSessionLocal() as db:
                    await db.execute(update(User).where(User.id == owner, User.role == "deleting").values(role="deleted"))
                    await db.commit()
        except Exception:
            # No credentials, media URLs, personal names or emails in this log.
            logger.warning("Account media cleanup will be retried")


async def erasure_worker():
    while True:
        try:
            await cleanup_erased_accounts()
        except Exception:
            logger.warning("Account cleanup worker will retry")
        await asyncio.sleep(300)
