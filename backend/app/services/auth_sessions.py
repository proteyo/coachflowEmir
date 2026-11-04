from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import verify_token_payload
from app.models.auth_session import AuthSession


async def session_is_active(token: str, db: AsyncSession, token_type: str = "access") -> bool:
    payload = verify_token_payload(token, token_type)
    if not payload or not isinstance(payload.get("sid"), str):
        return False
    result = await db.execute(select(AuthSession.id).where(
        AuthSession.id == payload["sid"], AuthSession.user_id == payload.get("sub"),
        AuthSession.expires_at > datetime.now(timezone.utc),
    ))
    return result.scalar_one_or_none() is not None
