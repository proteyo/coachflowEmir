"""
Streak router.

GET  /streak
POST /streak/activity
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.streak import Streak
from app.models.user import User
from app.schemas.other import StreakOut
from app.services.mappers import streak_out


router = APIRouter(prefix="/streak", tags=["Streak"])


def require_client(current_user: User) -> None:
    if current_user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access required",
        )


async def get_or_create_streak(
    db: AsyncSession,
    client_id: str,
) -> Streak:
    result = await db.execute(
        select(Streak).where(Streak.client_id == client_id)
    )

    streak = result.scalar_one_or_none()

    if streak:
        return streak

    streak = Streak(
        client_id=client_id,
        current_streak=0,
        best_streak=0,
        last_activity_date=None,
    )

    db.add(streak)
    await db.commit()
    await db.refresh(streak)

    return streak


@router.get("", response_model=StreakOut)
async def get_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreakOut:
    require_client(current_user)

    streak = await get_or_create_streak(
        db=db,
        client_id=current_user.id,
    )

    return streak_out(streak)


@router.post("/activity", response_model=StreakOut)
async def record_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreakOut:
    """
    Records today's client activity and recalculates streak.

    Logic:
    - If activity is already recorded today, streak does not change.
    - If previous activity was yesterday, current streak increases by 1.
    - If previous activity was earlier than yesterday or missing, streak starts from 1.
    """
    require_client(current_user)

    streak = await get_or_create_streak(
        db=db,
        client_id=current_user.id,
    )

    today_date = date.today()
    today = today_date.isoformat()
    yesterday = (today_date - timedelta(days=1)).isoformat()

    if streak.last_activity_date == today:
        return streak_out(streak)

    if streak.last_activity_date == yesterday:
        streak.current_streak += 1
    else:
        streak.current_streak = 1

    streak.last_activity_date = today
    streak.best_streak = max(streak.best_streak, streak.current_streak)

    db.add(streak)
    await db.commit()
    await db.refresh(streak)

    return streak_out(streak)