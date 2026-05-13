"""
Supplements API.

Routes:
GET    /supplements/plans                    — list plans
POST   /supplements/plans                    — create plan (coach + active subscription)
GET    /supplements/plans/{plan_id}          — get plan
PATCH  /supplements/plans/{plan_id}          — update plan items safely (coach + active subscription)
DELETE /supplements/plans/{plan_id}          — delete plan (coach + active subscription)

GET    /supplements/logs                     — list logs (client own / coach by client_id + active subscription)
POST   /supplements/logs                     — upsert log (client)

Rules:
- Coach can manage supplement plans only for linked clients and only with active subscription.
- Coach can view linked client supplement data only with active subscription.
- Client can see only own supplement plans and logs.
- Client can mark only supplements that belong to their own plan.
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.supplement import SupplementItem, SupplementLog, SupplementPlan
from app.models.user import User
from app.schemas.supplement import (
    SupplementLogIn,
    SupplementLogOut,
    SupplementPlanIn,
    SupplementPlanOut,
)
from app.services.mappers import supplement_log_out, supplement_plan_out

router = APIRouter(prefix="/supplements", tags=["Supplements"])

DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


async def _ensure_coach_subscription_if_needed(
    current_user: User,
    db: AsyncSession,
) -> None:
    """
    If current user is coach, require active subscription.
    Clients are not checked here because subscription belongs to coach accounts.
    """
    if current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)


async def _verify_coach_client(
    coach_id: str,
    client_id: str,
    db: AsyncSession,
) -> ClientProfile:
    """
    Checks that the client is linked to the current coach.
    """
    res = await db.execute(
        select(ClientProfile).where(
            ClientProfile.user_id == client_id,
            ClientProfile.coach_id == coach_id,
        )
    )

    client_profile = res.scalar_one_or_none()

    if not client_profile:
        raise HTTPException(status_code=403, detail="Client is not linked to you")

    return client_profile


async def _get_plan(
    plan_id: str,
    db: AsyncSession,
) -> SupplementPlan:
    """
    Loads a supplement plan with items.
    """
    res = await db.execute(
        select(SupplementPlan)
        .where(SupplementPlan.id == plan_id)
        .options(selectinload(SupplementPlan.items))
    )

    plan = res.scalar_one_or_none()

    if not plan:
        raise HTTPException(status_code=404, detail="Supplement plan not found")

    return plan


async def _get_client_item(
    client_id: str,
    supplement_item_id: str,
    db: AsyncSession,
) -> SupplementItem:
    """
    Checks that supplement item exists and belongs to the current client.
    This prevents a client from marking another user's supplement as taken.
    """
    res = await db.execute(
        select(SupplementItem)
        .join(SupplementPlan, SupplementPlan.id == SupplementItem.plan_id)
        .where(
            SupplementItem.id == supplement_item_id,
            SupplementPlan.client_id == client_id,
        )
    )

    item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Supplement item not found for this client",
        )

    return item


def _json_list(
    value: list[str] | None,
    fallback: list[str],
) -> str:
    """
    Safely converts a list into a JSON string for DB storage.
    Empty values are removed.
    If list is empty, fallback is used.
    """
    if not value:
        return json.dumps(fallback)

    cleaned = [str(v).strip() for v in value if str(v).strip()]

    return json.dumps(cleaned or fallback)


# ── Plans ──────────────────────────────────────────────────────────────────────


@router.get("/plans", response_model=list[SupplementPlanOut])
async def list_plans(
    client_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists supplement plans.

    Coach:
    - Must have active subscription.
    - Can list plans for all linked clients.
    - If client_id is provided, only this linked client's plans are returned.

    Client:
    - Can list only own plans.
    """
    query = select(SupplementPlan).options(selectinload(SupplementPlan.items))

    if current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        query = query.where(SupplementPlan.coach_id == current_user.id)

        if client_id:
            await _verify_coach_client(current_user.id, client_id, db)
            query = query.where(SupplementPlan.client_id == client_id)

    elif current_user.role == "client":
        if client_id and client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        query = query.where(SupplementPlan.client_id == current_user.id)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    query = query.order_by(SupplementPlan.start_date.desc())

    res = await db.execute(query)

    return [supplement_plan_out(plan) for plan in res.scalars().all()]


@router.post("/plans", response_model=SupplementPlanOut, status_code=201)
async def create_plan(
    data: SupplementPlanIn,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a new supplement plan for a linked client.
    Only coach with active subscription can create plans.
    """
    await _verify_coach_client(coach.id, data.client_id, db)

    plan_id = f"sp_{uuid.uuid4().hex[:12]}"

    plan = SupplementPlan(
        id=plan_id,
        coach_id=coach.id,
        client_id=data.client_id,
        start_date=data.start_date,
    )

    db.add(plan)

    for item in data.items:
        db.add(
            SupplementItem(
                id=item.id or f"si_{uuid.uuid4().hex[:12]}",
                plan_id=plan_id,
                name=item.name,
                dosage=item.dosage,
                times_per_day=item.times_per_day,
                specific_times=_json_list(item.specific_times, []),
                days_of_week=_json_list(
                    getattr(item, "days_of_week", None),
                    DEFAULT_DAYS,
                ),
                notes=item.notes,
            )
        )

    await db.commit()

    return supplement_plan_out(await _get_plan(plan_id, db))


@router.get("/plans/{plan_id}", response_model=SupplementPlanOut)
async def get_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns one supplement plan.

    Coach must have active subscription.
    Client can read only own plan.
    """
    plan = await _get_plan(plan_id, db)

    if current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        if plan.coach_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        await _verify_coach_client(current_user.id, plan.client_id, db)

    elif current_user.role == "client":
        if plan.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return supplement_plan_out(plan)


@router.patch("/plans/{plan_id}", response_model=SupplementPlanOut)
async def update_plan(
    plan_id: str,
    data: SupplementPlanIn,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates a supplement plan safely.

    Important:
    - Coach must have active subscription.
    - Existing item ids are preserved.
    - Logs connected to unchanged supplement items are preserved.
    - Only removed items are deleted.
    - plan.client_id cannot be changed.
    """
    plan = await _get_plan(plan_id, db)

    if plan.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if plan.client_id != data.client_id:
        raise HTTPException(
            status_code=400,
            detail="Plan client_id cannot be changed",
        )

    await _verify_coach_client(coach.id, data.client_id, db)

    plan.start_date = data.start_date

    existing_items = {item.id: item for item in plan.items}
    kept_existing_ids: set[str] = set()

    for incoming in data.items:
        incoming_id = incoming.id

        if incoming_id and incoming_id in existing_items:
            item = existing_items[incoming_id]
            kept_existing_ids.add(incoming_id)

            item.name = incoming.name
            item.dosage = incoming.dosage
            item.times_per_day = incoming.times_per_day
            item.specific_times = _json_list(incoming.specific_times, [])
            item.days_of_week = _json_list(
                getattr(incoming, "days_of_week", None),
                DEFAULT_DAYS,
            )
            item.notes = incoming.notes

            db.add(item)

        else:
            new_item = SupplementItem(
                id=f"si_{uuid.uuid4().hex[:12]}",
                plan_id=plan_id,
                name=incoming.name,
                dosage=incoming.dosage,
                times_per_day=incoming.times_per_day,
                specific_times=_json_list(incoming.specific_times, []),
                days_of_week=_json_list(
                    getattr(incoming, "days_of_week", None),
                    DEFAULT_DAYS,
                ),
                notes=incoming.notes,
            )

            db.add(new_item)

    for item_id, item in existing_items.items():
        if item_id not in kept_existing_ids:
            await db.delete(item)

    db.add(plan)
    await db.commit()

    return supplement_plan_out(await _get_plan(plan_id, db))


@router.delete("/plans/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes a supplement plan.
    Only coach with active subscription who owns this client relationship can delete it.
    """
    plan = await _get_plan(plan_id, db)

    if plan.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await _verify_coach_client(coach.id, plan.client_id, db)

    await db.delete(plan)
    await db.commit()


# ── Logs ───────────────────────────────────────────────────────────────────────


@router.get("/logs", response_model=list[SupplementLogOut])
async def list_logs(
    date: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists supplement logs.

    Client:
    - Can list only own logs.

    Coach:
    - Must have active subscription.
    - Must provide client_id.
    - Can list logs only for a linked client.
    """
    query = select(SupplementLog)

    if current_user.role == "client":
        if client_id and client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        query = query.where(SupplementLog.client_id == current_user.id)

    elif current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        if not client_id:
            raise HTTPException(
                status_code=400,
                detail="client_id required for coach",
            )

        await _verify_coach_client(current_user.id, client_id, db)

        query = query.where(SupplementLog.client_id == client_id)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if date:
        query = query.where(SupplementLog.date == date)

    query = query.order_by(SupplementLog.date.desc(), SupplementLog.time.asc())

    res = await db.execute(query)

    return [supplement_log_out(log) for log in res.scalars().all()]


@router.post("/logs", response_model=SupplementLogOut, status_code=201)
async def upsert_log(
    data: SupplementLogIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates or updates a supplement log.

    Only client can mark supplements as taken.
    Client can mark only supplement items that belong to their own plan.
    """
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Client access required")

    await _get_client_item(current_user.id, data.supplement_item_id, db)

    res = await db.execute(
        select(SupplementLog).where(
            SupplementLog.client_id == current_user.id,
            SupplementLog.supplement_item_id == data.supplement_item_id,
            SupplementLog.date == data.date,
            SupplementLog.time == data.time,
        )
    )

    log = res.scalar_one_or_none()

    if log:
        log.taken = data.taken
    else:
        log = SupplementLog(
            id=f"sl_{uuid.uuid4().hex[:12]}",
            client_id=current_user.id,
            supplement_item_id=data.supplement_item_id,
            date=data.date,
            time=data.time,
            taken=data.taken,
        )

    db.add(log)
    await db.commit()
    await db.refresh(log)

    return supplement_log_out(log)