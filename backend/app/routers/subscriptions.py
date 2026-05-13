"""
Subscriptions API.

Routes:
GET   /subscriptions/plans
GET   /subscriptions/me
PATCH /subscriptions/me
POST  /subscriptions/me/activate
POST  /subscriptions/me/verify-google-play

Production rules:
- Free Trial can be activated without payment verification.
- Paid plans cannot be activated by a simple frontend request in production.
- Real paid activation happens only after Google Play purchase verification.
- Frontend sends product_id and purchase_token.
- Backend verifies purchase through Google Play Developer API.
- Raw Google Play purchase token is never stored in the database.
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import require_coach
from app.db.database import get_db
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.other import SubscriptionOut, UpdateSubscriptionRequest
from app.services.mappers import subscription_out


logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


FREE_TRIAL_DAYS = 30
PAID_SUBSCRIPTION_DAYS_FALLBACK = 30

SUBSCRIPTION_PLANS: dict[str, dict[str, Any]] = {
    "free": {
        "plan_code": "free",
        "plan_name": "Free Trial",
        "price": 0,
        "currency": "KZT",
        "client_limit": 3,
        "google_product_id": None,
    },
    "starter": {
        "plan_code": "starter",
        "plan_name": "Starter",
        "price": 2990,
        "currency": "KZT",
        "client_limit": 10,
        "google_product_id": "starter_monthly",
    },
    "pro": {
        "plan_code": "pro",
        "plan_name": "Pro",
        "price": 4990,
        "currency": "KZT",
        "client_limit": 30,
        "google_product_id": "pro_monthly",
    },
    "unlimited": {
        "plan_code": "unlimited",
        "plan_name": "Unlimited",
        "price": 9990,
        "currency": "KZT",
        "client_limit": 999999,
        "google_product_id": "unlimited_monthly",
    },
}

GOOGLE_PRODUCT_TO_PLAN: dict[str, str] = {
    "starter_monthly": "starter",
    "pro_monthly": "pro",
    "unlimited_monthly": "unlimited",
}

VALID_STATUSES = {"inactive", "active", "expired", "cancelled"}

ACTIVE_GOOGLE_SUBSCRIPTION_STATES = {
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
}

GOOGLE_ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"


class VerifyGooglePlayPurchaseRequest(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=120)
    purchase_token: str = Field(..., min_length=10)


class GooglePlaySubscriptionResult(BaseModel):
    product_id: str
    subscription_state: str
    expiry_time: datetime | None = None
    acknowledged: bool = False
    raw: dict[str, Any]


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def is_dev_activation_enabled() -> bool:
    """
    Controls whether paid subscription can be activated without real payment.

    Must stay false in production.
    """
    return get_bool_env("ALLOW_DEV_SUBSCRIPTION_ACTIVATION", False)


def hash_purchase_token(purchase_token: str) -> str:
    """
    Stores only SHA-256 hash of Google Play purchase token.

    Raw purchase token must never be saved in DB.
    """
    return hashlib.sha256(purchase_token.encode("utf-8")).hexdigest()


def safe_json_dumps(value: dict[str, Any]) -> str:
    """
    Serializes Google Play raw response for audit/debugging.
    """
    return json.dumps(
        value,
        ensure_ascii=False,
        default=str,
        separators=(",", ":"),
    )


def get_plan(plan_code: str) -> dict[str, Any]:
    normalized = plan_code.strip().lower()

    if normalized not in SUBSCRIPTION_PLANS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="plan_code must be one of: free, starter, pro, unlimited",
        )

    return SUBSCRIPTION_PLANS[normalized]


def get_plan_code_by_google_product(product_id: str) -> str:
    normalized = product_id.strip()

    plan_code = GOOGLE_PRODUCT_TO_PLAN.get(normalized)

    if not plan_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Unknown Google Play product_id. "
                "Expected one of: starter_monthly, pro_monthly, unlimited_monthly"
            ),
        )

    return plan_code


def apply_plan(subscription: Subscription, plan_code: str) -> None:
    """
    Applies only predefined backend plan values.

    The frontend must never be able to send custom price/client_limit/currency.
    """
    plan = get_plan(plan_code)

    subscription.plan_code = plan["plan_code"]
    subscription.plan_name = plan["plan_name"]
    subscription.price = plan["price"]
    subscription.currency = plan["currency"]
    subscription.client_limit = plan["client_limit"]


def clear_google_play_fields(subscription: Subscription) -> None:
    """
    Clears Google Play fields for non-paid/free/local states.
    """
    subscription.google_product_id = None
    subscription.google_purchase_token_hash = None
    subscription.google_subscription_state = None
    subscription.google_acknowledged = 0
    subscription.google_raw_response = None
    subscription.last_verified_at = None


def save_google_play_fields(
    *,
    subscription: Subscription,
    verification: GooglePlaySubscriptionResult,
    purchase_token: str,
) -> None:
    """
    Saves Google Play verification data after successful purchase verification.
    """
    subscription.google_product_id = verification.product_id
    subscription.google_purchase_token_hash = hash_purchase_token(purchase_token)
    subscription.google_subscription_state = verification.subscription_state
    subscription.google_acknowledged = 1 if verification.acknowledged else 0
    subscription.google_raw_response = safe_json_dumps(verification.raw)
    subscription.last_verified_at = now_utc()


def normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def parse_google_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(
            timezone.utc
        )
    except ValueError:
        logger.warning("Could not parse Google Play expiryTime=%r", value)
        return None


def sync_expired_status(subscription: Subscription) -> None:
    """
    If subscription is active but end_date is in the past, mark it as expired.
    """
    if subscription.status != "active" or not subscription.end_date:
        return

    end_date = normalize_datetime(subscription.end_date)

    if end_date and end_date < now_utc():
        subscription.status = "expired"


def is_active_paid_subscription(subscription: Subscription) -> bool:
    sync_expired_status(subscription)

    return subscription.status == "active" and subscription.plan_code in {
        "starter",
        "pro",
        "unlimited",
    }


def is_active_free_trial(subscription: Subscription) -> bool:
    sync_expired_status(subscription)

    return subscription.status == "active" and subscription.plan_code == "free"


async def get_or_create_subscription(
    coach: User,
    db: AsyncSession,
) -> Subscription:
    result = await db.execute(
        select(Subscription).where(Subscription.coach_id == coach.id)
    )

    subscription = result.scalars().first()

    if subscription:
        previous_status = subscription.status

        sync_expired_status(subscription)

        if subscription.status != previous_status:
            db.add(subscription)
            await db.commit()
            await db.refresh(subscription)

        return subscription

    plan = SUBSCRIPTION_PLANS["free"]
    current_time = now_utc()

    subscription = Subscription(
        id=f"sub_{uuid.uuid4().hex[:12]}",
        coach_id=coach.id,
        plan_code=plan["plan_code"],
        plan_name=plan["plan_name"],
        price=plan["price"],
        currency=plan["currency"],
        client_limit=plan["client_limit"],
        status="inactive",
        start_date=None,
        end_date=None,
        created_at=current_time,
    )

    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return subscription


def parse_google_service_account_json() -> dict[str, Any]:
    """
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON can be either:
    1. Raw JSON string.
    2. Base64 encoded JSON string.
    """
    raw_value = settings.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON

    if not raw_value:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Play service account is not configured.",
        )

    raw_value = raw_value.strip()

    try:
        if raw_value.startswith("{"):
            return json.loads(raw_value)

        decoded = base64.b64decode(raw_value).decode("utf-8")
        return json.loads(decoded)

    except Exception as exc:
        logger.exception("Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid Google Play service account configuration.",
        ) from exc


def verify_google_play_subscription_sync(
    *,
    package_name: str,
    product_id: str,
    purchase_token: str,
) -> GooglePlaySubscriptionResult:
    """
    Verifies subscription through Google Play Developer API.

    This function is synchronous because google-api-python-client is sync.
    It is called through asyncio.to_thread() from the async route.
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError as exc:
        raise RuntimeError(
            "Google Play verification dependencies are missing. "
            "Install google-api-python-client and google-auth."
        ) from exc

    service_account_info = parse_google_service_account_json()

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=[GOOGLE_ANDROID_PUBLISHER_SCOPE],
    )

    service = build(
        "androidpublisher",
        "v3",
        credentials=credentials,
        cache_discovery=False,
    )

    try:
        purchase = (
            service.purchases()
            .subscriptionsv2()
            .get(
                packageName=package_name,
                token=purchase_token,
            )
            .execute()
        )

    except HttpError as exc:
        logger.exception("Google Play subscription verification failed")

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Play purchase verification failed.",
        ) from exc

    subscription_state = purchase.get("subscriptionState", "")
    line_items = purchase.get("lineItems") or []

    matched_line_item: dict[str, Any] | None = None

    for item in line_items:
        if item.get("productId") == product_id:
            matched_line_item = item
            break

    if matched_line_item is None and line_items:
        matched_line_item = line_items[0]

    actual_product_id = (
        matched_line_item.get("productId")
        if matched_line_item
        else product_id
    )

    if actual_product_id != product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Play product_id does not match the requested plan.",
        )

    expiry_time = parse_google_datetime(
        matched_line_item.get("expiryTime") if matched_line_item else None
    )

    acknowledgement_state = purchase.get("acknowledgementState")
    acknowledged = acknowledgement_state == "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"

    if not acknowledged:
        try:
            (
                service.purchases()
                .subscriptions()
                .acknowledge(
                    packageName=package_name,
                    subscriptionId=product_id,
                    token=purchase_token,
                    body={},
                )
                .execute()
            )

            acknowledged = True

        except Exception as exc:
            logger.exception("Could not acknowledge Google Play subscription")

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Purchase was verified but could not be acknowledged.",
            ) from exc

    return GooglePlaySubscriptionResult(
        product_id=product_id,
        subscription_state=subscription_state,
        expiry_time=expiry_time,
        acknowledged=acknowledged,
        raw=purchase,
    )


async def verify_google_play_subscription(
    *,
    product_id: str,
    purchase_token: str,
) -> GooglePlaySubscriptionResult:
    package_name = settings.GOOGLE_PLAY_PACKAGE_NAME

    if not package_name:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_PLAY_PACKAGE_NAME is not configured.",
        )

    return await asyncio.to_thread(
        verify_google_play_subscription_sync,
        package_name=package_name,
        product_id=product_id,
        purchase_token=purchase_token,
    )


def ensure_google_subscription_is_active(
    verification: GooglePlaySubscriptionResult,
) -> None:
    if verification.subscription_state not in ACTIVE_GOOGLE_SUBSCRIPTION_STATES:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                "Google Play subscription is not active: "
                f"{verification.subscription_state}"
            ),
        )

    if verification.expiry_time and verification.expiry_time < now_utc():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Google Play subscription is expired.",
        )


@router.get("/plans")
async def list_subscription_plans():
    """
    Returns predefined subscription plans.

    The frontend can display these values, but real paid prices should be shown
    from Google Play Billing when available.
    """
    return {
        "plans": list(SUBSCRIPTION_PLANS.values())
    }


@router.get("/me", response_model=SubscriptionOut)
async def get_my_subscription(
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    """
    Returns current coach subscription.

    If an active subscription is expired by date, it is automatically marked
    as expired before returning.
    """
    subscription = await get_or_create_subscription(coach, db)

    return subscription_out(subscription)


@router.patch("/me", response_model=SubscriptionOut)
async def update_my_subscription(
    data: UpdateSubscriptionRequest,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    """
    Safely selects a subscription plan before payment.

    This endpoint:
    - can change only plan_code;
    - cannot activate subscription;
    - cannot accept custom price, currency, status, dates or client_limit;
    - blocks direct plan change while subscription is active.
    """
    subscription = await get_or_create_subscription(coach, db)

    forbidden_fields = {
        "plan_name": data.plan_name,
        "price": data.price,
        "currency": data.currency,
        "client_limit": data.client_limit,
        "status": data.status,
        "start_date": data.start_date,
        "end_date": data.end_date,
    }

    sent_forbidden_fields = [
        field_name
        for field_name, field_value in forbidden_fields.items()
        if field_value is not None
    ]

    if sent_forbidden_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "These fields cannot be changed directly: "
                + ", ".join(sent_forbidden_fields)
            ),
        )

    if data.plan_code is None:
        return subscription_out(subscription)

    plan_code = data.plan_code.strip().lower()
    get_plan(plan_code)

    sync_expired_status(subscription)

    if subscription.status == "active" and plan_code != subscription.plan_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Active subscription plan cannot be changed directly. "
                "Use the payment flow."
            ),
        )

    apply_plan(subscription, plan_code)

    if subscription.status not in VALID_STATUSES:
        subscription.status = "inactive"

    if plan_code == "free":
        clear_google_play_fields(subscription)

    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return subscription_out(subscription)


@router.post("/me/activate", response_model=SubscriptionOut)
async def activate_my_subscription(
    data: UpdateSubscriptionRequest,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    """
    Activates Free Trial or paid plan in local dev mode.

    Free Trial:
    - allowed without payment;
    - gives 30 days;
    - gives 3 clients.

    Paid plans:
    - cannot be activated from frontend in production;
    - require Google Play verification through /subscriptions/me/verify-google-play;
    - local paid activation works only outside production with
      ALLOW_DEV_SUBSCRIPTION_ACTIVATION=true.
    """
    subscription = await get_or_create_subscription(coach, db)

    plan_code = (data.plan_code or subscription.plan_code or "free").strip().lower()
    get_plan(plan_code)

    if plan_code == "free":
        if is_active_paid_subscription(subscription):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "You already have an active paid subscription. "
                    "Free Trial cannot replace it."
                ),
            )

        if is_active_free_trial(subscription):
            return subscription_out(subscription)

        apply_plan(subscription, "free")
        clear_google_play_fields(subscription)

        start_date = now_utc()
        end_date = start_date + timedelta(days=FREE_TRIAL_DAYS)

        subscription.status = "active"
        subscription.start_date = start_date
        subscription.end_date = end_date

        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)

        return subscription_out(subscription)

    if settings.is_production or not is_dev_activation_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Paid subscription activation requires real payment verification. "
                "Use /subscriptions/me/verify-google-play."
            ),
        )

    apply_plan(subscription, plan_code)
    clear_google_play_fields(subscription)

    start_date = now_utc()
    end_date = start_date + timedelta(days=PAID_SUBSCRIPTION_DAYS_FALLBACK)

    subscription.status = "active"
    subscription.start_date = start_date
    subscription.end_date = end_date

    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return subscription_out(subscription)


@router.post("/me/verify-google-play", response_model=SubscriptionOut)
async def verify_google_play_purchase(
    data: VerifyGooglePlayPurchaseRequest,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    """
    Verifies Google Play subscription purchase and activates the coach plan.

    Frontend must send:
    {
      "product_id": "pro_monthly",
      "purchase_token": "token_from_google_play"
    }

    The backend:
    - verifies purchase with Google Play Developer API;
    - checks subscription state;
    - checks product_id;
    - acknowledges purchase if required;
    - activates the correct CoachFlow plan;
    - stores only hashed purchase token.
    """
    product_id = data.product_id.strip()
    purchase_token = data.purchase_token.strip()

    plan_code = get_plan_code_by_google_product(product_id)

    verification = await verify_google_play_subscription(
        product_id=product_id,
        purchase_token=purchase_token,
    )

    ensure_google_subscription_is_active(verification)

    subscription = await get_or_create_subscription(coach, db)

    apply_plan(subscription, plan_code)

    start_date = now_utc()
    end_date = verification.expiry_time or (
        start_date + timedelta(days=PAID_SUBSCRIPTION_DAYS_FALLBACK)
    )

    subscription.status = "active"
    subscription.start_date = start_date
    subscription.end_date = end_date

    save_google_play_fields(
        subscription=subscription,
        verification=verification,
        purchase_token=purchase_token,
    )

    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return subscription_out(subscription)