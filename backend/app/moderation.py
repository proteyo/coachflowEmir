"""Operator-only CLI, never an HTTP endpoint or client credential.

python -m app.moderation list
python -m app.moderation resolve REPORT_ID --action hide|dismiss|suspend
Review private evidence only in a trusted operator environment.
"""
import argparse
import asyncio
import json
from datetime import datetime, timezone
from sqlalchemy import delete, select
from app.db.database import AsyncSessionLocal, engine
from app.models.content_report import ContentReport
from app.models.user import User
from app.models.message import Message
from app.models.social import Story, GroupMessage, SocialProfile
from app.models.auth_session import AuthSession
from app.models.profile import CoachProfile


async def main(args):
    try:
        async with AsyncSessionLocal() as db:
            if args.command == "list":
                rows = (await db.execute(select(ContentReport).where(ContentReport.status == "pending").order_by(ContentReport.created_at).limit(100))).scalars().all()
                for row in rows:
                    # JSON escaping prevents a hostile note from controlling a terminal.
                    print(json.dumps({"id": row.id, "type": row.target_type, "target": row.target_id, "reason": row.reason, "created": row.created_at.isoformat(), **({"note": row.note} if args.include_notes else {})}))
                return
            report = (await db.execute(select(ContentReport).where(ContentReport.id == args.id).with_for_update())).scalar_one_or_none()
            if not report or report.status != "pending":
                raise RuntimeError("Pending report not found")
            target = await db.get({"profile": User, "story": Story, "message": Message, "group_message": GroupMessage}[report.target_type], report.target_id)
            if args.action == "hide" and target:
                if report.target_type == "story":
                    target.expires_at = datetime.now(timezone.utc)
                elif report.target_type == "message":
                    target.deleted_for_everyone = True
                    target.content = ""
                    target.media_url = target.media_thumbnail_url = target.voice_url = None
                elif report.target_type == "group_message":
                    target.content = ""
                    target.media_url = target.media_type = None
                else:
                    profile = await db.get(SocialProfile, target.id)
                    if profile:
                        profile.bio = profile.goal = ""
                        profile.cover_image_url = None
                    professional = await db.get(CoachProfile, target.id)
                    if professional:
                        professional.bio = professional.specialty = ""
                        professional.achievements = professional.certificates = "[]"
                        professional.cover_image_url = professional.profile_image_url = None
                    target.avatar_url = None
            if args.action == "suspend" and target:
                owner = target.id if report.target_type == "profile" else target.user_id if report.target_type == "story" else target.sender_id
                account = await db.get(User, owner)
                if account and account.role in ("coach", "client"):
                    account.role = "suspended"
                    await db.execute(delete(AuthSession).where(AuthSession.user_id == owner))
            report.status = args.action
            await db.commit()
            print("Report resolved")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list").add_argument("--include-notes", action="store_true")
    resolve = commands.add_parser("resolve")
    resolve.add_argument("id")
    resolve.add_argument("--action", choices=["hide", "dismiss", "suspend"], required=True)
    asyncio.run(main(parser.parse_args()))
