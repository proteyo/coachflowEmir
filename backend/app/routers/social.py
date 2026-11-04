"""Inbox, groups and explicitly published profile content. Never returns health data."""
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.profile import ClientProfile
from app.models.message import Message
from app.models.review import ClientAssessment, CoachReview
from app.models.social import ChatGroup, ChatMember, ConversationSetting, GroupMessage, SocialProfile, Story, StoryView, UserBlock
from app.services.media_access import canonical_avatar_url, validate_message_media

router = APIRouter(prefix="/social", tags=["Social"])
THEMES = {"premium", "midnight", "energy", "light"}


def now():
    return datetime.now(timezone.utc)


def person(user):
    return {"id": user.id, "name": user.name, "role": user.role, "avatarUrl": canonical_avatar_url(user.avatar_url)}


async def contacts(user, db):
    profiles = (await db.execute(select(ClientProfile).where(or_(ClientProfile.coach_id == user.id, ClientProfile.user_id == user.id)))).scalars().all()
    ids = {p.user_id for p in profiles if p.coach_id == user.id}
    ids.update(p.coach_id for p in profiles if p.user_id == user.id and p.coach_id)
    # Unlinking coaching does not erase an existing conversation.
    messages = (await db.execute(select(Message.sender_id, Message.receiver_id).where(or_(Message.sender_id == user.id, Message.receiver_id == user.id)).distinct())).all()
    ids.update(b if a == user.id else a for a, b in messages if b)
    ids.discard(user.id)
    return ids


async def blocked(a, b, db):
    return (await db.execute(select(UserBlock.user_id).where(or_(and_(UserBlock.user_id == a, UserBlock.target_id == b), and_(UserBlock.user_id == b, UserBlock.target_id == a))).limit(1))).first() is not None


async def may_chat(user, partner, db):
    if user.id == partner or partner not in await contacts(user, db):
        raise HTTPException(403, "Conversation access denied")


async def coach_access(user, db):
    if user.role == "coach":
        await require_active_coach_subscription(user, db)


async def member(group_id, user, db):
    item = await db.get(ChatMember, (group_id, user.id))
    if not item:
        raise HTTPException(403, "Group access denied")
    return item


async def group_event(group_id, db, event="group.updated"):
    from app.routers.messages import ws_manager
    ids = list((await db.execute(select(ChatMember.user_id).where(ChatMember.group_id == group_id))).scalars())
    await ws_manager.send_to_users(ids, {"type": event, "groupId": group_id})


@router.websocket("/groups/{group_id}/ws")
async def group_socket(group_id: str, websocket: WebSocket, token: str = ""):
    from app.routers.messages import ws_manager, _get_user_by_token
    user_id = None
    try:
        async with AsyncSessionLocal() as db:
            user = await _get_user_by_token(token, db)
            if not user:
                await websocket.close(code=1008)
                return
            await coach_access(user, db)
            await member(group_id, user, db)
            user_id = user.id
        await ws_manager.connect(user_id, websocket, token)
        while True:
            await websocket.receive_text()
            async with AsyncSessionLocal() as db:
                user = await _get_user_by_token(token, db)
                if not user:
                    await websocket.close(code=1008)
                    return
                await coach_access(user, db)
                await member(group_id, user, db)
            await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, HTTPException):
        try:
            await websocket.close(code=1008)
        except RuntimeError:
            pass
    finally:
        if user_id:
            ws_manager.disconnect(user_id, websocket)


@router.get("/contacts")
async def list_contacts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ids = await contacts(user, db)
    users = (await db.execute(select(User).where(User.id.in_(ids)).order_by(User.name))).scalars().all()
    return [person(p) for p in users]


class PreferenceIn(BaseModel):
    pinned: bool | None = None
    muted: bool | None = None
    hidden: bool | None = None
    theme: Literal["premium", "midnight", "energy", "light"] | None = None


@router.get("/conversations/{partner_id}/settings")
async def get_setting(partner_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await may_chat(user, partner_id, db)
    setting = await db.get(ConversationSetting, (user.id, partner_id))
    mine = await db.get(UserBlock, (user.id, partner_id))
    return {"pinned": bool(setting and setting.pinned), "muted": bool(setting and setting.muted), "theme": setting.theme if setting else "premium", "blocked": bool(mine)}


@router.patch("/conversations/{partner_id}/settings")
async def update_setting(partner_id: str, data: PreferenceIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await may_chat(user, partner_id, db)
    await db.execute(select(User.id).where(User.id.in_([user.id, partner_id])).order_by(User.id).with_for_update())
    item = await db.get(ConversationSetting, (user.id, partner_id))
    if not item:
        item = ConversationSetting(user_id=user.id, partner_id=partner_id)
        db.add(item)
    for key in ("pinned", "muted", "hidden", "theme"):
        value = getattr(data, key)
        if value is not None:
            setattr(item, key, value)
    if data.theme:
        other = await db.get(ConversationSetting, (partner_id, user.id))
        if not other:
            other = ConversationSetting(user_id=partner_id, partner_id=user.id)
            db.add(other)
        other.theme = data.theme
    await db.commit()
    return {"ok": True}


class DeleteIn(BaseModel):
    mode: Literal["me", "everyone"] = "me"


@router.post("/conversations/{partner_id}/delete")
async def clear_conversation(partner_id: str, data: DeleteIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await may_chat(user, partner_id, db)
    pair = or_(and_(Message.sender_id == user.id, Message.receiver_id == partner_id), and_(Message.sender_id == partner_id, Message.receiver_id == user.id))
    if data.mode == "everyone":
        await db.execute(update(Message).where(pair).values(deleted_for_everyone=True))
        other = await db.get(ConversationSetting, (partner_id, user.id))
        if not other:
            other = ConversationSetting(user_id=partner_id, partner_id=user.id)
            db.add(other)
        other.hidden = True
    else:
        await db.execute(update(Message).where(pair, Message.sender_id == user.id).values(deleted_for_sender=True))
        await db.execute(update(Message).where(pair, Message.receiver_id == user.id).values(deleted_for_receiver=True))
    setting = await db.get(ConversationSetting, (user.id, partner_id))
    if not setting:
        setting = ConversationSetting(user_id=user.id, partner_id=partner_id)
        db.add(setting)
    setting.hidden = True
    await db.commit()
    from app.routers.messages import _broadcast_conversation_snapshot
    await _broadcast_conversation_snapshot(current_user_id=user.id, partner_id=partner_id, db=db)
    return {"ok": True}


class BlockIn(BaseModel):
    blocked: bool


@router.patch("/blocks/{target_id}")
async def set_block(target_id: str, data: BlockIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if target_id == user.id or not await db.get(User, target_id):
        raise HTTPException(400, "Invalid user")
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    item = await db.get(UserBlock, (user.id, target_id))
    if data.blocked and not item:
        db.add(UserBlock(user_id=user.id, target_id=target_id))
    elif not data.blocked and item:
        await db.delete(item)
    await db.commit()
    return {"blocked": data.blocked}


@router.get("/inbox")
async def inbox(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await coach_access(user, db)
    people = await list_contacts(user, db)
    settings = {s.partner_id: s for s in (await db.execute(select(ConversationSetting).where(ConversationSetting.user_id == user.id))).scalars()}
    visible = or_(and_(Message.sender_id == user.id, Message.deleted_for_sender.is_(False)), and_(Message.receiver_id == user.id, Message.deleted_for_receiver.is_(False)))
    partner = case((Message.sender_id == user.id, Message.receiver_id), else_=Message.sender_id)
    ranked = select(Message.id, func.row_number().over(partition_by=partner, order_by=(Message.created_at.desc(), Message.id.desc())).label("position")).where(visible, Message.deleted_for_everyone.is_(False), Message.deleted_at.is_(None)).subquery()
    latest = (await db.execute(select(Message).join(ranked, Message.id == ranked.c.id).where(ranked.c.position == 1))).scalars().all()
    by_partner = {(m.receiver_id if m.sender_id == user.id else m.sender_id): m for m in latest}
    unread = dict((await db.execute(select(Message.sender_id, func.count()).where(Message.receiver_id == user.id, Message.read.is_(False), Message.deleted_for_everyone.is_(False), Message.deleted_for_receiver.is_(False), Message.deleted_at.is_(None)).group_by(Message.sender_id))).all())
    rows = []
    for p in people:
        setting = settings.get(p["id"])
        message = by_partner.get(p["id"])
        if setting and setting.hidden and not message:
            continue
        rows.append({**p, "kind": "direct", "pinned": bool(setting and setting.pinned), "muted": bool(setting and setting.muted), "unread": unread.get(p["id"], 0), "preview": message.content if message and message.message_type == "text" else "", "messageType": message.message_type if message else None, "updatedAt": message.created_at.isoformat() if message else "", "canDeleteEveryone": True})
    memberships = (await db.execute(select(ChatMember, ChatGroup).join(ChatGroup, ChatGroup.id == ChatMember.group_id).where(ChatMember.user_id == user.id))).all()
    for membership, group in memberships:
        last = (await db.execute(select(GroupMessage).where(GroupMessage.group_id == group.id).order_by(GroupMessage.created_at.desc()).limit(1))).scalar_one_or_none()
        if membership.hidden and (not last or user.id in last.hidden_for):
            continue
        count = (await db.execute(select(func.count()).select_from(GroupMessage).where(GroupMessage.group_id == group.id, GroupMessage.sender_id != user.id, GroupMessage.created_at > membership.read_at if membership.read_at else True))).scalar_one()
        rows.append({"id": group.id, "name": group.name, "kind": "group", "pinned": membership.pinned, "muted": membership.muted, "unread": count, "preview": last.content if last and user.id not in last.hidden_for else "", "messageType": last.media_type if last else None, "updatedAt": last.created_at.isoformat() if last else group.created_at.isoformat(), "canDeleteEveryone": group.owner_id == user.id})
    return sorted(rows, key=lambda row: (row["pinned"], row["updatedAt"]), reverse=True)


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    members: list[str] = Field(min_length=1, max_length=100)


@router.post("/groups", status_code=201)
async def create_group(data: GroupIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await coach_access(user, db)
    ids = set(data.members) - {user.id}
    allowed = await contacts(user, db)
    if not data.name.strip() or not ids or not ids.issubset(allowed):
        raise HTTPException(403, "Only your contacts can be added")
    for uid in ids:
        if await blocked(user.id, uid, db):
            raise HTTPException(403, "User is blocked")
    group = ChatGroup(owner_id=user.id, name=data.name.strip())
    db.add(group)
    await db.flush()
    for uid in ids | {user.id}:
        db.add(ChatMember(group_id=group.id, user_id=uid))
    await db.commit()
    return {"id": group.id}


@router.get("/groups/{group_id}")
async def get_group(group_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await coach_access(user, db)
    m = await member(group_id, user, db)
    group = await db.get(ChatGroup, group_id)
    users = (await db.execute(select(User).join(ChatMember, ChatMember.user_id == User.id).where(ChatMember.group_id == group_id))).scalars().all()
    return {"id": group.id, "name": group.name, "ownerId": group.owner_id, "theme": group.theme, "members": [person(p) for p in users], "pinned": m.pinned, "muted": m.muted, "hidden": m.hidden}


@router.patch("/groups/{group_id}/settings")
async def group_setting(group_id: str, data: PreferenceIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = await member(group_id, user, db)
    for key in ("pinned", "muted", "hidden"):
        value = getattr(data, key)
        if value is not None:
            setattr(item, key, value)
    if data.theme:
        group = await db.get(ChatGroup, group_id)
        group.theme = data.theme
    await db.commit()
    await group_event(group_id, db)
    return {"ok": True}


class GroupMembersIn(BaseModel):
    members: list[str] = Field(min_length=1, max_length=100)


@router.post("/groups/{group_id}/members")
async def add_group_members(group_id: str, data: GroupMembersIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await member(group_id, user, db)
    group = await db.get(ChatGroup, group_id)
    if group.owner_id != user.id:
        raise HTTPException(403, "Only the owner can add members")
    allowed = await contacts(user, db)
    if not set(data.members).issubset(allowed):
        raise HTTPException(403, "Only your contacts can be added")
    existing = set((await db.execute(select(ChatMember.user_id).where(ChatMember.group_id == group_id))).scalars())
    if len(existing | set(data.members)) > 100:
        raise HTTPException(400, "Group member limit reached")
    for uid in set(data.members) - existing:
        if await blocked(user.id, uid, db):
            raise HTTPException(403, "User is blocked")
        db.add(ChatMember(group_id=group_id, user_id=uid))
    await db.commit()
    return {"ok": True}


class GroupMessageIn(BaseModel):
    content: str = Field(default="", max_length=6000)
    client_id: str = Field(min_length=1, max_length=60)
    media_url: str | None = None
    media_type: Literal["image", "video", "voice"] | None = None


def group_message_out(message, sender):
    return {"id": message.id, "senderId": message.sender_id, "senderName": sender.name, "content": message.content, "mediaUrl": message.media_url, "mediaType": message.media_type, "createdAt": message.created_at.isoformat()}


@router.get("/groups/{group_id}/messages")
async def group_messages(group_id: str, before: str | None = None, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await coach_access(user, db)
    await member(group_id, user, db)
    query = select(GroupMessage, User).join(User, User.id == GroupMessage.sender_id).where(GroupMessage.group_id == group_id)
    if before:
        try:
            query = query.where(GroupMessage.created_at < datetime.fromisoformat(before))
        except ValueError:
            raise HTTPException(400, "Invalid cursor")
    rows = (await db.execute(query.order_by(GroupMessage.created_at.desc()).limit(100))).all()
    if rows and not before:
        membership = await member(group_id, user, db)
        membership.read_at = rows[0][0].created_at
        await db.commit()
    return [group_message_out(m, p) for m, p in reversed(rows) if user.id not in m.hidden_for]


@router.post("/groups/{group_id}/messages", status_code=201)
async def send_group_message(group_id: str, data: GroupMessageIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await coach_access(user, db)
    await member(group_id, user, db)
    members = (await db.execute(select(ChatMember.user_id).where(ChatMember.group_id == group_id))).scalars().all()
    for uid in members:
        if await blocked(user.id, uid, db):
            raise HTTPException(403, "User is blocked")
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    key = f"{user.id}:{data.client_id}"
    existing = (await db.execute(select(GroupMessage).where(GroupMessage.client_id == key))).scalar_one_or_none()
    if existing:
        if existing.group_id != group_id:
            raise HTTPException(409, "Duplicate message identifier")
        return group_message_out(existing, user)
    if not data.content.strip() and not data.media_url:
        raise HTTPException(400, "Empty message")
    media = None
    if data.media_url:
        if not data.media_type:
            raise HTTPException(400, "Missing media type")
        media = await validate_message_media(data.media_url, {"image": "images", "video": "videos", "voice": "voice"}[data.media_type], user, db)
    item = GroupMessage(group_id=group_id, sender_id=user.id, client_id=key, content=data.content.strip(), media_url=media, media_type=data.media_type)
    db.add(item)
    await db.execute(update(ChatMember).where(ChatMember.group_id == group_id).values(hidden=False))
    await db.commit()
    await group_event(group_id, db)
    return group_message_out(item, user)


@router.post("/groups/{group_id}/delete")
async def delete_group_chat(group_id: str, data: DeleteIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await member(group_id, user, db)
    group = await db.get(ChatGroup, group_id)
    notify_ids = []
    if data.mode == "everyone":
        if group.owner_id != user.id:
            raise HTTPException(403, "Only the owner can delete a group for everyone")
        notify_ids = list((await db.execute(select(ChatMember.user_id).where(ChatMember.group_id == group_id))).scalars())
        await db.delete(group)
    else:
        messages = (await db.execute(select(GroupMessage).where(GroupMessage.group_id == group_id).with_for_update())).scalars().all()
        for message in messages:
            message.hidden_for = list(set(message.hidden_for) | {user.id})
        m.hidden = True
        m.read_at = now()
    await db.commit()
    if notify_ids:
        from app.routers.messages import ws_manager
        await ws_manager.send_to_users(notify_ids, {"type": "group.deleted", "groupId": group_id})
    else:
        from app.routers.messages import ws_manager
        await ws_manager.send_to_user(user.id, {"type": "group.cleared", "groupId": group_id})
    return {"ok": True}


class ProfileIn(BaseModel):
    bio: str = Field(default="", max_length=400)
    goal: str = Field(default="", max_length=160)
    birth_year: str = Field(default="", pattern=r"^(|19\d{2}|20\d{2})$")
    show_rating: bool = False


@router.patch("/profile")
async def save_profile(data: ProfileIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.birth_year and int(data.birth_year) > now().year:
        raise HTTPException(400, "Invalid birth year")
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    item = await db.get(SocialProfile, user.id)
    if not item:
        item = SocialProfile(user_id=user.id)
        db.add(item)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    await db.commit()
    return {"ok": True}


@router.get("/profile/{user_id}")
async def public_profile(user_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    profile = await db.get(SocialProfile, user_id)
    private = await db.get(ClientProfile, user_id)
    own_coach = bool(private and private.coach_id == user.id)
    is_blocked = await blocked(user.id, user_id, db)
    assessments = []
    if not is_blocked and (user.id == user_id or own_coach or (profile and profile.show_rating)):
        rows = (await db.execute(select(ClientAssessment, User).join(User, User.id == ClientAssessment.coach_id).where(ClientAssessment.client_id == user_id).order_by(ClientAssessment.updated_at.desc()))).all()
        assessments = [{"id": a.id, "author": person(coach), "rating": round((a.discipline_rating + a.progress_rating + a.communication_rating) / 3, 1), "comment": a.comment, "createdAt": a.updated_at.isoformat()} for a, coach in rows]
    if target.role == "coach" and not is_blocked:
        reviews = (await db.execute(select(CoachReview, User).join(User, User.id == CoachReview.client_id).where(CoachReview.coach_id == user_id).order_by(CoachReview.updated_at.desc()))).all()
        assessments = [{"id": review.id, "author": person(author), "rating": review.rating, "comment": review.comment, "createdAt": review.updated_at.isoformat()} for review, author in reviews]
    return {**person(target), "bio": profile.bio if profile and not is_blocked else "", "goal": profile.goal if profile and not is_blocked else "", "birthYear": profile.birth_year if profile and not is_blocked else "", "showRating": bool(profile and profile.show_rating), "assessments": assessments, "canSeeTraining": (own_coach or (user.id == user_id and private is not None)) and not is_blocked, "blocked": bool(await db.get(UserBlock, (user.id, user_id)))}


async def can_view_story(story, user, db):
    if story.expires_at:
        expiry = story.expires_at.replace(tzinfo=timezone.utc) if story.expires_at.tzinfo is None else story.expires_at
        if expiry <= now():
            return False
    if story.user_id == user.id:
        return True
    if await blocked(user.id, story.user_id, db):
        return False
    return story.visibility == "public" or story.user_id in await contacts(user, db)


class StoryIn(BaseModel):
    media_url: str
    media_type: Literal["image", "video"]
    caption: str = Field(default="", max_length=500)
    visibility: Literal["contacts", "public"] = "contacts"
    post: bool = False


class StoryEdit(BaseModel):
    caption: str = Field(max_length=500)
    visibility: Literal["contacts", "public"] = "contacts"


def story_out(story, owner):
    return {"id": story.id, "owner": person(owner), "mediaUrl": story.media_url, "mediaType": story.media_type, "caption": story.caption, "visibility": story.visibility, "createdAt": story.created_at.isoformat(), "expiresAt": story.expires_at.isoformat() if story.expires_at else None}


@router.get("/stories")
async def stories(owner_id: str | None = None, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ids = (await contacts(user, db)) | {user.id}
    query = select(Story, User).join(User, Story.user_id == User.id).where(or_(Story.expires_at.is_(None), Story.expires_at > now()))
    query = query.where(Story.user_id == owner_id) if owner_id else query.where(Story.user_id.in_(ids))
    rows = (await db.execute(query.order_by(Story.created_at.desc()).limit(200))).all()
    result = []
    for story, owner in rows:
        if await can_view_story(story, user, db):
            view = await db.get(StoryView, (story.id, user.id))
            result.append({**story_out(story, owner), "seen": bool(view), "liked": bool(view and view.liked)})
    return result


@router.post("/stories", status_code=201)
async def publish_story(data: StoryIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    recent = (await db.execute(select(Story.id).where(Story.user_id == user.id, Story.created_at > now() - timedelta(days=1)).limit(51))).all()
    if len(recent) >= 50:
        raise HTTPException(429, "Daily publication limit reached")
    media = await validate_message_media(data.media_url, "images" if data.media_type == "image" else "videos", user, db)
    # Only your own upload may be published. Received private chat files are never reusable as a story.
    from app.services.media_access import media_reference
    if not media_reference(media)[1].startswith(user.id + "_"):
        raise HTTPException(403, "Only your own upload can be published")
    item = Story(user_id=user.id, media_url=media, media_type=data.media_type, caption=data.caption, visibility=data.visibility, expires_at=None if data.post else now() + timedelta(hours=24))
    db.add(item)
    await db.commit()
    return story_out(item, user)


@router.patch("/stories/{story_id}")
async def edit_story(story_id: str, data: StoryEdit, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = await db.get(Story, story_id)
    if not item or item.user_id != user.id:
        raise HTTPException(404, "Story not found")
    item.caption, item.visibility = data.caption, data.visibility
    await db.commit()
    return {"ok": True}


@router.delete("/stories/{story_id}", status_code=204)
async def remove_story(story_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = await db.get(Story, story_id)
    if not item or item.user_id != user.id:
        raise HTTPException(404, "Story not found")
    await db.delete(item)
    await db.commit()


class StoryViewIn(BaseModel):
    liked: bool | None = None


@router.patch("/stories/{story_id}/view")
async def story_view(story_id: str, data: StoryViewIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    story = await db.get(Story, story_id)
    if not story or not await can_view_story(story, user, db):
        raise HTTPException(404, "Story not found")
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    item = await db.get(StoryView, (story_id, user.id))
    if not item:
        item = StoryView(story_id=story_id, user_id=user.id)
        db.add(item)
    if data.liked is not None:
        item.liked = data.liked
    await db.commit()
    return {"ok": True}


@router.get("/stories/{story_id}/viewers")
async def story_viewers(story_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    story = await db.get(Story, story_id)
    if not story or story.user_id != user.id:
        raise HTTPException(404, "Story not found")
    rows = (await db.execute(select(StoryView, User).join(User, User.id == StoryView.user_id).where(StoryView.story_id == story_id).order_by(StoryView.viewed_at.desc()))).all()
    return [{**person(p), "liked": view.liked, "viewedAt": view.viewed_at.isoformat()} for view, p in rows]
