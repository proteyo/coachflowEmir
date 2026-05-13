"""
GET  /progress              — list entries (client: own; coach: ?client_id= + active subscription)
POST /progress              — add entry
DELETE /progress/{id}       — delete entry
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.progress import ProgressEntry
from app.models.user import User
from app.schemas.other import ProgressEntryIn, ProgressEntryOut
from app.services.mappers import progress_out

router = APIRouter(prefix="/progress", tags=["Progress"])


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
        raise HTTPException(status_code=403, detail="Client is not linked to you")

    return profile


@router.get("", response_model=list[ProgressEntryOut])
async def list_progress(
    client_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ProgressEntry)

    if current_user.role == "client":
        query = query.where(ProgressEntry.client_id == current_user.id)

    elif current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)

        if not client_id:
            raise HTTPException(
                status_code=400,
                detail="client_id query param required for coach",
            )

        await _verify_coach_client(current_user.id, client_id, db)

        query = query.where(ProgressEntry.client_id == client_id)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    query = query.order_by(ProgressEntry.date.desc())

    res = await db.execute(query)

    return [progress_out(entry) for entry in res.scalars().all()]


@router.post("", response_model=ProgressEntryOut, status_code=201)
async def add_progress(
    data: ProgressEntryIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Clients add their own progress.
    Coaches should not add progress here; coach-side weight editing should go through profile logic.
    """
    if current_user.role != "client":
        raise HTTPException(
            status_code=403,
            detail="Only clients can add their own progress entries",
        )

    entry = ProgressEntry(
        id=f"pe_{uuid.uuid4().hex[:12]}",
        client_id=current_user.id,
        weight=data.weight,
        date=data.date,
        notes=data.notes,
        added_by=current_user.id,
    )

    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return progress_out(entry)


@router.delete("/{entry_id}", status_code=204)
async def delete_progress(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(ProgressEntry).where(ProgressEntry.id == entry_id))
    entry = res.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)

    if entry.client_id != current_user.id and entry.added_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(entry)
    await db.commit()