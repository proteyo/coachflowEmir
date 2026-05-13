"""
GET   /weekly-goals              — list (client: own; coach: ?client_id= + active subscription)
POST  /weekly-goals              — create or upsert
PATCH /weekly-goals/{id}         — update progress
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.user import User
from app.models.weekly_goal import WeeklyGoal
from app.schemas.other import WeeklyGoalIn, WeeklyGoalOut, WeeklyGoalUpdate
from app.services.mappers import weekly_goal_out

router = APIRouter(prefix="/weekly-goals", tags=["Weekly Goals"])


async def _verify_coach_client(
    coach_id: str,
    client_id: str,
    db: AsyncSession,
) -> ClientProfile:
    res = await db.execute(
        select(ClientProfile).where(
            ClientProfile.user_id == client_id,
            ClientProfile.coach_id == coach_id,
        )
    )

    profile = res.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=403, detail="Client not linked to you")

    return profile


@router.get("", response_model=list[WeeklyGoalOut])
async def list_goals(
    client_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(WeeklyGoal)

    if current_user.role == "client":
        query = query.where(WeeklyGoal.client_id == current_user.id)

    elif current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)

        if not client_id:
            raise HTTPException(
                status_code=400,
                detail="client_id required for coach",
            )

        await _verify_coach_client(current_user.id, client_id, db)

        query = query.where(WeeklyGoal.client_id == client_id)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    query = query.order_by(WeeklyGoal.week_start.desc())

    res = await db.execute(query)

    return [weekly_goal_out(goal) for goal in res.scalars().all()]


@router.post("", response_model=WeeklyGoalOut, status_code=201)
async def create_or_upsert_goal(
    data: WeeklyGoalIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Only clients can set their own weekly goals.
    Coach subscription does not matter here because the action belongs to the client.
    """
    if current_user.role != "client":
        raise HTTPException(
            status_code=403,
            detail="Only clients can set their own weekly goals",
        )

    client_id = current_user.id

    res = await db.execute(
        select(WeeklyGoal).where(
            WeeklyGoal.client_id == client_id,
            WeeklyGoal.week_start == data.week_start,
        )
    )

    goal = res.scalar_one_or_none()

    if goal:
        goal.target_minutes = data.target_minutes
        goal.completed_minutes = data.completed_minutes
        goal.target_workouts = data.target_workouts
        goal.completed_workouts = data.completed_workouts
    else:
        goal = WeeklyGoal(
            id=f"wg_{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            week_start=data.week_start,
            target_minutes=data.target_minutes,
            completed_minutes=data.completed_minutes,
            target_workouts=data.target_workouts,
            completed_workouts=data.completed_workouts,
        )

    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    return weekly_goal_out(goal)


@router.patch("/{goal_id}", response_model=WeeklyGoalOut)
async def update_goal(
    goal_id: str,
    data: WeeklyGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Only the client who owns the goal can update it.
    """
    res = await db.execute(select(WeeklyGoal).where(WeeklyGoal.id == goal_id))
    goal = res.scalar_one_or_none()

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role != "client" or goal.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field in (
        "target_minutes",
        "completed_minutes",
        "target_workouts",
        "completed_workouts",
    ):
        value = getattr(data, field, None)

        if value is not None:
            setattr(goal, field, value)

    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    return weekly_goal_out(goal)