from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user
from app.core.rate_limit import consume_limit
from app.core.security import verify_password
from app.db.database import get_db
from app.models.user import User
from app.models.profile import ClientProfile
from app.services.legal_terms import LegalAcceptance, LEGAL_VERSION
from app.services.mappers import user_out
from datetime import datetime, timezone
from app.services.account_erasure import cleanup_erased_accounts, erase_account

router = APIRouter(prefix="/account", tags=["Account"])


@router.post("/accept-terms")
async def accept_terms(data: LegalAcceptance, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    profile = (await db.execute(select(ClientProfile).where(ClientProfile.user_id == user.id))).scalar_one_or_none()
    if user.role == "client" and (not data.health_data_consent or profile and profile.age is not None and profile.age < 18):
        raise HTTPException(422, "ADULT_HEALTH_CONSENT_REQUIRED")
    now = datetime.now(timezone.utc)
    if user.terms_version != LEGAL_VERSION:
        user.terms_version = LEGAL_VERSION
        user.terms_accepted_at = now
    user.adult_confirmed_at = user.adult_confirmed_at or now
    if user.role == "client":
        user.health_consent_at = user.health_consent_at or now
    await db.commit()
    return user_out(user)


class ErasureIn(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    confirmation: str = Field(pattern="^DELETE$")


@router.post("/delete", status_code=204)
async def delete_my_account(data: ErasureIn, background: BackgroundTasks,
                            user: User = Depends(get_current_user),
                            db: AsyncSession = Depends(get_db)):
    await consume_limit(db, "delete-account", user.id, 5, 900)
    user = (await db.execute(select(User).where(User.id == user.id).with_for_update())).scalar_one()
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(403, "ACCOUNT_PASSWORD_INCORRECT")
    # Re-authentication and all SQL deletes belong to the authenticated user.
    # No target ID, role, email, path or URL is accepted from the client.
    await erase_account(user, db)
    background.add_task(cleanup_erased_accounts)
