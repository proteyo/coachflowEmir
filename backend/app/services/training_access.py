from datetime import date, datetime, timezone
from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, require_active_coach_subscription, require_active_client_coach_subscription
from app.db.database import get_db
from app.models.engagement import ClientEngagement
from app.models.profile import ClientProfile
from app.models.user import User


def engagement_active(item: ClientEngagement | None, today: date | None = None):
    today = today or datetime.now(timezone.utc).date()
    return item is None or (item.status == "active" and (item.ends_on is None or item.ends_on >= today) and (item.starts_on is None or item.starts_on <= today))


async def access_state(user_id: str, db: AsyncSession):
    profile = (await db.execute(select(ClientProfile).where(ClientProfile.user_id == user_id))).scalar_one_or_none()
    query = select(ClientEngagement).where(ClientEngagement.client_id == user_id)
    if profile and profile.coach_id:
        query = query.where(ClientEngagement.coach_id == profile.coach_id)
    item = (await db.execute(query.order_by(ClientEngagement.updated_at.desc()).limit(1))).scalar_one_or_none()
    allowed=bool(profile and profile.coach_id and engagement_active(item))
    return {"allowed": allowed, "coachId": profile.coach_id if profile else None,
            "endsOn": item.ends_on.isoformat() if item and item.ends_on else None,
            "status": "active" if allowed else "closed"}


async def require_training_access(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == "coach":
        await require_active_coach_subscription(user, db)
    if user.role == "client" and not (await access_state(user.id, db))["allowed"]:
        raise HTTPException(403, "TRAINING_ACCESS_CLOSED")
    return user


async def client_coach_id(user_id: str, db: AsyncSession):
    return (await db.execute(select(ClientProfile.coach_id).where(ClientProfile.user_id == user_id))).scalar_one_or_none()


async def require_places_access(user: User = Depends(require_training_access), db: AsyncSession = Depends(get_db)):
    # Check entitlement before cache reads or any billable provider call.
    if user.role == "client":
        await require_active_client_coach_subscription(user, db)
    return user
