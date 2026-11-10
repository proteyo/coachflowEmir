"""Current coaching circle, deliberately separate from historical chat contacts."""
from sqlalchemy import select
from app.models.profile import ClientProfile


async def story_circle(user, db):
    if user.role == "coach":
        rows = (await db.execute(select(ClientProfile.user_id).where(ClientProfile.coach_id == user.id))).scalars().all()
        return set(rows) | {user.id}
    profile = (await db.execute(select(ClientProfile).where(ClientProfile.user_id == user.id))).scalar_one_or_none()
    if not profile or not profile.coach_id:
        return {user.id}
    peers = (await db.execute(select(ClientProfile.user_id).where(ClientProfile.coach_id == profile.coach_id))).scalars().all()
    return set(peers) | {user.id, profile.coach_id}
