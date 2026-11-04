"""Shared, atomic database limits; no passwords, emails or IPs are stored."""
import hashlib
import time
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.auth_limit import AuthRateLimit

# account attempts / window seconds; separate IP caps protect random-email floods.
POLICIES = {
    "register": (5, 900, 40),
    "login": (20, 900, 120),
    "verify-email": (10, 900, 120),
    "resend-verification-code": (5, 900, 40),
    "forgot-password": (5, 900, 40),
    "reset-password": (10, 900, 60),
}


async def consume_limit(db: AsyncSession, scope: str, identity: str, limit: int, window: int) -> None:
    timestamp = int(time.time())
    slot = timestamp // window
    key = hashlib.sha256(f"{scope}:{identity}:{slot}".encode()).hexdigest()
    expires_at = datetime.fromtimestamp((slot + 1) * window, timezone.utc)
    dialect = db.get_bind().dialect.name
    insert = sqlite_insert if dialect == "sqlite" else pg_insert
    statement = insert(AuthRateLimit).values(key=key, attempts=1, expires_at=expires_at)
    statement = statement.on_conflict_do_update(
        index_elements=[AuthRateLimit.key],
        set_={"attempts": AuthRateLimit.attempts + 1},
    ).returning(AuthRateLimit.attempts)
    attempts = (await db.execute(statement)).scalar_one()
    # Bounded retention, including attempts that will be rejected below.
    await db.execute(delete(AuthRateLimit).where(AuthRateLimit.expires_at < datetime.now(timezone.utc)))
    await db.commit()
    if attempts > limit:
        raise HTTPException(429, "Too many attempts. Please try again later.",
                            headers={"Retry-After": str(max(1, (slot + 1) * window - timestamp))})


async def enforce_auth_rate_limit(request: Request, db: AsyncSession = Depends(get_db)) -> None:
    action = request.url.path.rstrip("/").rsplit("/", 1)[-1]
    if request.method != "POST" or action not in POLICIES:
        return
    account_limit, window, ip_limit = POLICIES[action]
    body = await request.json()
    if not isinstance(body, dict):
        return
    identity = str(body.get("email") or body.get("token") or "").strip().lower()
    # Do not accept caller-controlled X-Forwarded-For headers here.
    ip = request.client.host if request.client else "unknown"
    await consume_limit(db, f"{action}:ip", ip, ip_limit, window)
    if identity:
        await consume_limit(db, f"{action}:account", identity, account_limit, window)
