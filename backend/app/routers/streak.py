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

    from app.models.attendance import Attendance
    from app.services.attendance_stats import attendance_stats
    records = (await db.execute(select(Attendance).where(Attendance.client_id == current_user.id))).scalars().all()
    stats = attendance_stats(records)
    return StreakOut(attendedTotal=stats["attended"], clientId=current_user.id, currentStreak=stats["currentStreak"], bestStreak=stats["bestStreak"], lastActivityDate=stats["lastActivityDate"])


@router.post("/activity", response_model=StreakOut)
async def record_activity(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Compatibility route: exercise completion never changes attendance.
    return await get_streak(current_user, db)
