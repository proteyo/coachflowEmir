"""Canonical chat media references and participant access checks."""
import re
from urllib.parse import unquote, urlsplit

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.message import Message
from app.models.user import User

MEDIA_PREFIXES = {
    "voice": ("STORAGE_VOICE_PREFIX", "voice"),
    "images": ("STORAGE_IMAGE_PREFIX", "images"),
    "videos": ("STORAGE_VIDEO_PREFIX", "videos"),
    "video-thumbnails": ("STORAGE_VIDEO_THUMBNAIL_PREFIX", "video-thumbnails"),
}
SAFE_MEDIA_NAME = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$")


def canonical_avatar_url(url: str | None) -> str | None:
    if not url:
        return url
    settings = get_settings()
    prefix = settings.STORAGE_AVATAR_PREFIX.strip("/") + "/"
    for base in (settings.STORAGE_PUBLIC_BASE_URL, settings.GCS_PUBLIC_BASE_URL):
        if base and url.startswith(base.rstrip("/") + "/" + prefix):
            filename = urlsplit(url).path.rsplit("/", 1)[-1]
            if SAFE_MEDIA_NAME.fullmatch(filename):
                return f"/api/v1/uploads/avatars/{filename}"
    return url


def media_reference(url: str) -> tuple[str, str]:
    settings = get_settings()
    parsed = urlsplit(url)
    path = unquote(parsed.path)
    api_prefix = "/api/v1/uploads/"
    if path.startswith(api_prefix):
        relative = path[len(api_prefix):]
        parts = relative.split("/")
        if len(parts) == 2 and parts[0] in MEDIA_PREFIXES and SAFE_MEDIA_NAME.fullmatch(parts[1]):
            return parts[0], parts[1]
    # Legacy cloud links are mapped to the protected API; never fetch arbitrary URLs.
    for base in (settings.STORAGE_PUBLIC_BASE_URL, settings.GCS_PUBLIC_BASE_URL):
        if not base or not url.startswith(base.rstrip("/") + "/"):
            continue
        key = unquote(urlsplit(url[len(base.rstrip('/')) + 1:]).path)
        for kind, (setting, default) in MEDIA_PREFIXES.items():
            prefix = getattr(settings, setting, default).strip("/") + "/"
            filename = key[len(prefix):] if key.startswith(prefix) else ""
            if SAFE_MEDIA_NAME.fullmatch(filename):
                return kind, filename
    raise HTTPException(status_code=400, detail="Invalid chat media URL")


def canonical_media_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        kind, filename = media_reference(url)
    except HTTPException:
        return None  # External URLs cannot bypass protected chat media delivery.
    return f"/api/v1/uploads/{kind}/{filename}"


async def require_media_access(kind: str, filename: str, user: User, db: AsyncSession) -> None:
    if kind not in MEDIA_PREFIXES or not SAFE_MEDIA_NAME.fullmatch(filename):
        raise HTTPException(status_code=400, detail="Invalid chat media reference")
    # Upload names are generated on the server and include the uploader's ID.
    if filename.startswith(f"{user.id}_"):
        return
    column = Message.voice_url if kind == "voice" else (
        Message.media_thumbnail_url if kind == "video-thumbnails" else Message.media_url
    )
    result = await db.execute(select(Message.id).where(
        column.endswith("/" + filename, autoescape=True),
        Message.deleted_at.is_(None),
        Message.deleted_for_everyone.is_(False),
        or_(
            and_(Message.sender_id == user.id, Message.deleted_for_sender.is_(False)),
            and_(Message.receiver_id == user.id, Message.deleted_for_receiver.is_(False)),
        ),
    ).limit(1))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Chat media access denied")


async def validate_message_media(url: str | None, kind: str, user: User, db: AsyncSession) -> str | None:
    if not url:
        return None
    actual_kind, filename = media_reference(url)
    if actual_kind != kind:
        raise HTTPException(status_code=400, detail="Media type does not match URL")
    await require_media_access(kind, filename, user, db)
    return f"/api/v1/uploads/{kind}/{filename}"
