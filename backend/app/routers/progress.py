"""
GET    /progress              — list entries
POST   /progress              — add entry
DELETE /progress/{id}         — delete entry

Access rules:
- Client can list/add/delete own progress.
- Coach with active subscription can list/add/delete progress for linked clients.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
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


async def _get_client_profile(
    client_id: str,
    db: AsyncSession,
) -> ClientProfile | None:
    res = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == client_id)
    )

    return res.scalar_one_or_none()


async def _read_json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        return {}

    return body if isinstance(body, dict) else {}


def _get_client_id_from_body(body: dict[str, Any]) -> str | None:
    raw = body.get("client_id") or body.get("clientId")

    if raw is None:
        return None

    value = str(raw).strip()

    return value or None


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
    request: Request,
    data: ProgressEntryIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Adds a weight progress entry.

    Client:
    - can add only own progress.

    Coach:
    - must have active subscription;
    - must provide client_id/clientId in request body;
    - can add progress only for a linked client.
    """
    body = await _read_json_body(request)

    if current_user.role == "client":
        target_client_id = current_user.id
        added_by = current_user.id
        client_profile = await _get_client_profile(target_client_id, db)

        if not client_profile:
            raise HTTPException(status_code=404, detail="Client profile not found")

    elif current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)

        target_client_id = _get_client_id_from_body(body)

        if not target_client_id:
            raise HTTPException(
                status_code=400,
                detail="client_id is required when coach adds client progress",
            )

        client_profile = await _verify_coach_client(
            current_user.id,
            target_client_id,
            db,
        )

        added_by = current_user.id

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.weight <= 0:
        raise HTTPException(status_code=400, detail="Weight must be greater than 0")

    if data.weight < 20 or data.weight > 350:
        raise HTTPException(
            status_code=400,
            detail="Weight must be between 20 and 350 kg",
        )

    entry = ProgressEntry(
        id=f"pe_{uuid.uuid4().hex[:12]}",
        client_id=target_client_id,
        weight=data.weight,
        date=data.date,
        notes=data.notes,
        added_by=added_by,
    )

    db.add(entry)

    if client_profile is not None:
        client_profile.current_weight = data.weight

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

    if current_user.role == "client":
        if entry.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    elif current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)
        await _verify_coach_client(current_user.id, entry.client_id, db)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(entry)
    await db.commit()