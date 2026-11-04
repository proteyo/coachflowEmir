from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from app.models.purchase_claim import PurchaseClaim
from app.models.subscription import Subscription


async def claim_purchase(db, token_hash: str, user_id: str) -> None:
    # Check legacy subscriptions as well, including before the backfill deploy.
    legacy = await db.execute(select(Subscription.coach_id).where(
        Subscription.google_purchase_token_hash == token_hash,
        Subscription.coach_id != user_id,
    ))
    if legacy.first() is not None:
        raise HTTPException(409, "This purchase belongs to another account")
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    await db.execute(insert(PurchaseClaim).values(token_hash=token_hash, user_id=user_id)
                     .on_conflict_do_nothing(index_elements=[PurchaseClaim.token_hash]))
    result = await db.execute(select(PurchaseClaim.user_id).where(PurchaseClaim.token_hash == token_hash))
    if result.scalar_one() != user_id:
        raise HTTPException(409, "This purchase belongs to another account")
