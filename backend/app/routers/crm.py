"""Coach-only CRM with decimal bookkeeping and reversible access suspension."""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, require_coach, require_active_coach_subscription, get_active_subscription
from app.db.database import get_db
from app.models.user import User
from app.models.profile import ClientProfile
from app.models.engagement import ClientEngagement, ClientPayment
from app.services.training_access import access_state, engagement_active

router = APIRouter(prefix="/crm", tags=["Coach CRM"])


class EngagementIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["active", "paused", "ended"] = "active"
    starts_on: date | None = None
    ends_on: date | None = None
    monthly_fee: Decimal = Field(default=Decimal("0"), ge=0, le=100000000, decimal_places=2, allow_inf_nan=False)
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def dates_ordered(self):
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("End date must follow start date")
        return self


class PaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount: Decimal = Field(gt=0, le=100000000, decimal_places=2, allow_inf_nan=False)
    paid_on: date
    note: str = Field(default="", max_length=300)
    request_id: str = Field(min_length=8, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")

    @model_validator(mode="after")
    def not_future(self):
        if self.paid_on > datetime.now(timezone.utc).date():
            raise ValueError("Payment date cannot be in the future")
        return self


async def relationship(coach_id, client_id, db, *, lock=False):
    query = select(ClientProfile).where(ClientProfile.user_id == client_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    profile = (await db.execute(query)).scalar_one_or_none()
    item = (await db.execute(select(ClientEngagement).where(ClientEngagement.coach_id == coach_id, ClientEngagement.client_id == client_id))).scalar_one_or_none()
    if not profile or (profile.coach_id != coach_id and item is None):
        raise HTTPException(404, "Client relationship not found")
    return profile, item


def entry_out(item, client, linked):
    active = linked and engagement_active(item)
    return {"id": client.id, "name": client.name, "avatarUrl": client.avatar_url,
            "status": (item.status if item else "active") if active else "closed",
            "linked": linked, "active": active, "startsOn": item.starts_on.isoformat() if item and item.starts_on else None,
            "endsOn": item.ends_on.isoformat() if item and item.ends_on else None,
            "monthlyFee": str(item.monthly_fee) if item else "0", "currency": "KZT", "notes": item.notes if item else ""}


@router.get("/access")
async def my_access(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await access_state(user.id, db) if user.role == "client" else {"allowed": True, "status": "active", "coachId": None, "endsOn": None}


@router.get("")
async def dashboard(month: str | None = None, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    try:
        start = date.fromisoformat((month or today.strftime("%Y-%m")) + "-01")
    except ValueError:
        raise HTTPException(422, "Invalid month")
    if not 1900 <= start.year <= 2100:
        raise HTTPException(422, "Invalid month")
    end = date(start.year + (start.month == 12), 1 if start.month == 12 else start.month + 1, 1)
    records = (await db.execute(select(ClientEngagement).where(ClientEngagement.coach_id == coach.id))).scalars().all()
    by_id = {r.client_id: r for r in records}
    clients = (await db.execute(select(User, ClientProfile).join(ClientProfile, ClientProfile.user_id == User.id).where(or_(ClientProfile.coach_id == coach.id, User.id.in_(by_id))))).all()
    rows = [entry_out(by_id.get(client.id), client, profile.coach_id == coach.id) for client, profile in clients]
    payments = (await db.execute(select(ClientPayment).where(ClientPayment.coach_id == coach.id, ClientPayment.paid_on >= start, ClientPayment.paid_on < end).order_by(ClientPayment.paid_on.desc()))).scalars().all()
    received = sum((p.amount for p in payments), Decimal("0"))
    # This is a planning estimate, not a claim that a real subscription payment occurred.
    subscription = await get_active_subscription(db, coach.id)
    cost = Decimal(str(subscription.price or 0)) if subscription and subscription.status == "active" else Decimal("0")
    names = {client.id: client.name for client, _ in clients}
    return {"month": start.strftime("%Y-%m"), "currency": "KZT", "received": str(received), "tariffEstimate": str(cost),
            "afterTariffEstimate": str(received - cost), "clients": rows,
            "expiring": sum(1 for row in rows if row["active"] and row["endsOn"] and 0 <= (date.fromisoformat(row["endsOn"]) - today).days <= 7),
            "payments": [{"id": p.id, "clientId": p.client_id, "name": names.get(p.client_id, ""), "amount": str(p.amount), "paidOn": p.paid_on.isoformat(), "note": p.note} for p in payments]}


@router.patch("/clients/{client_id}")
async def update_engagement(client_id: str, data: EngagementIn, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    # Lock the coach first, matching quota enforcement in /clients/link.
    await db.execute(select(User.id).where(User.id == coach.id).with_for_update())
    profile, item = await relationship(coach.id, client_id, db, lock=True)
    if "status" in data.model_fields_set and data.status == "active":
        await require_active_coach_subscription(coach, db)
        if profile.coach_id and profile.coach_id != coach.id:
            raise HTTPException(409, "Client is linked to another coach")
        if profile.coach_id != coach.id:
            from app.routers.clients import _ensure_client_limit
            await _ensure_client_limit(coach.id, db)
        profile.coach_id = coach.id
    elif "status" in data.model_fields_set and data.status in ("paused", "ended") and profile.coach_id == coach.id:
        profile.coach_id = None
    if item is None:
        item = ClientEngagement(coach_id=coach.id, client_id=client_id)
        db.add(item)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    if item.starts_on and item.ends_on and item.ends_on < item.starts_on:
        raise HTTPException(422, "End date must follow start date")
    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/clients/{client_id}/payments", status_code=201)
async def add_payment(client_id: str, data: PaymentIn, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    await db.execute(select(User.id).where(User.id == coach.id).with_for_update())
    await relationship(coach.id, client_id, db)
    key = coach.id + ":" + data.request_id
    existing = (await db.execute(select(ClientPayment).where(ClientPayment.request_id == key))).scalar_one_or_none()
    if existing:
        if existing.client_id != client_id or existing.amount != data.amount or existing.paid_on != data.paid_on:
            raise HTTPException(409, "Payment request identifier already used")
        return {"id": existing.id}
    item = ClientPayment(coach_id=coach.id, client_id=client_id, amount=data.amount, paid_on=data.paid_on, note=data.note, request_id=key)
    db.add(item)
    await db.commit()
    return {"id": item.id}


@router.delete("/payments/{payment_id}", status_code=204)
async def remove_payment(payment_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    item = (await db.execute(select(ClientPayment).where(ClientPayment.id == payment_id, ClientPayment.coach_id == coach.id))).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Payment not found")
    await db.delete(item)
    await db.commit()
