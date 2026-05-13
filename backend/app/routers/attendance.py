"""
Attendance API.

Routes:
GET    /attendance              — list attendance records
POST   /attendance              — create or update attendance record (coach + active subscription)
GET    /attendance/{record_id}  — get one attendance record
DELETE /attendance/{record_id}  — delete attendance record (coach + active subscription)

Rules:
- Client can see only own attendance.
- Coach can see attendance only for linked clients and only with active subscription.
- Coach can create/update/delete attendance only for linked clients and only with active subscription.
- One client can have only one attendance record per date.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.attendance import Attendance
from app.models.profile import ClientProfile
from app.models.user import User
from app.schemas.attendance import AttendanceIn, AttendanceOut
from app.services.mappers import attendance_out

router = APIRouter(prefix="/attendance", tags=["Attendance"])


VALID_STATUSES = {"attended", "missed", "rest"}


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
    Checks that the selected client is linked to the current coach.
    If not linked, the coach must not be able to read or modify attendance.
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


async def _get_attendance_record(
    record_id: str,
    db: AsyncSession,
) -> Attendance:
    """
    Loads one attendance record by id.
    """
    res = await db.execute(select(Attendance).where(Attendance.id == record_id))

    record = res.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    return record


def _validate_status(status: str) -> None:
    """
    Extra backend validation for safety.
    Pydantic schema already validates it, but this keeps the router safer.
    """
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail="Status must be one of: attended, missed, rest",
        )


@router.get("", response_model=list[AttendanceOut])
async def list_attendance(
    client_id: str | None = Query(default=None),
    date: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns attendance records.

    Client:
    - Can get only own attendance.
    - client_id query is ignored unless it equals the current user's id.

    Coach:
    - Must have active subscription.
    - If client_id is provided, returns attendance for this linked client.
    - If client_id is not provided, returns attendance for all clients linked to this coach.
    """
    query = select(Attendance)

    if current_user.role == "client":
        if client_id and client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        query = query.where(Attendance.client_id == current_user.id)

    elif current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        query = query.where(Attendance.coach_id == current_user.id)

        if client_id:
            await _verify_coach_client(current_user.id, client_id, db)
            query = query.where(Attendance.client_id == client_id)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if date:
        query = query.where(Attendance.date == date)

    if date_from:
        query = query.where(Attendance.date >= date_from)

    if date_to:
        query = query.where(Attendance.date <= date_to)

    query = query.order_by(Attendance.date.desc())

    res = await db.execute(query)

    return [attendance_out(record) for record in res.scalars().all()]


@router.post("", response_model=AttendanceOut, status_code=201)
async def upsert_attendance(
    data: AttendanceIn,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates or updates an attendance record.

    This is an upsert:
    - If this client already has attendance for this date, update it.
    - If not, create a new record.

    Only coach with active subscription can mark attendance.
    """
    _validate_status(data.status)

    await _verify_coach_client(coach.id, data.client_id, db)

    res = await db.execute(
        select(Attendance).where(
            Attendance.client_id == data.client_id,
            Attendance.date == data.date,
        )
    )

    record = res.scalar_one_or_none()

    if record:
        if record.coach_id != coach.id:
            raise HTTPException(status_code=403, detail="Access denied")

        record.status = data.status
        record.notes = data.notes
    else:
        record = Attendance(
            client_id=data.client_id,
            coach_id=coach.id,
            date=data.date,
            status=data.status,
            notes=data.notes,
        )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    return attendance_out(record)


@router.get("/{record_id}", response_model=AttendanceOut)
async def get_attendance_record(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns one attendance record by id.

    Coach must have active subscription.
    Client can read only own attendance.
    """
    record = await _get_attendance_record(record_id, db)

    if current_user.role == "client":
        if record.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    elif current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        if record.coach_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        await _verify_coach_client(current_user.id, record.client_id, db)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return attendance_out(record)


@router.delete("/{record_id}", status_code=204)
async def delete_attendance_record(
    record_id: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes an attendance record.

    Only coach with active subscription who owns this client relationship can delete it.
    """
    record = await _get_attendance_record(record_id, db)

    if record.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await _verify_coach_client(coach.id, record.client_id, db)

    await db.delete(record)
    await db.commit()