"""Real ORM and HTTP authorization checks, no external services."""
import unittest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
import test_regressions as regression
import json as json_module
from types import SimpleNamespace
from test_regressions import AsyncSessionAdapter
from app.main import app
from app.db.base import Base
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.profile import ClientProfile
from app.models.message import Message
from app.models.social import ChatMember, ConversationSetting, GroupMessage, SocialProfile, Story


class LocalClient:
    async def request(self, method, url, json=None):
        status, body = await regression.RegressionTests.request(None, method, url, json)
        return SimpleNamespace(status_code=status, text=json_module.dumps(body), json=lambda: body)
    async def get(self, url): return await self.request("GET", url)
    async def post(self, url, json=None): return await self.request("POST", url, json)
    async def patch(self, url, json=None): return await self.request("PATCH", url, json)
    async def delete(self, url): return await self.request("DELETE", url)
    async def aclose(self): pass


class Adapter(AsyncSessionAdapter):
    async def get(self, model, key):
        return self.session.get(model, key)


class SocialTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine, expire_on_commit=False)
        self.db = Adapter(self.session)
        self.client = User(id="u_client", name="Client", role="client", email="c@example.com", password_hash="test", email_verified=True)
        self.coach = User(id="u_coach", name="Coach", role="coach", email="t@example.com", password_hash="test", email_verified=True)
        self.stranger = User(id="u_stranger", name="Other", role="client", email="s@example.com", password_hash="test", email_verified=True)
        self.session.add_all([self.client, self.coach, self.stranger])
        self.session.flush()
        self.session.add(ClientProfile(user_id=self.client.id, coach_id=self.coach.id, current_weight=75, start_weight=75))
        self.session.commit()
        self.current = self.client
        async def database():
            yield self.db
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = lambda: self.current
        self.http = LocalClient()

    async def asyncTearDown(self):
        await self.http.aclose()
        app.dependency_overrides.clear()
        self.session.close()
        self.engine.dispose()

    async def group(self):
        response = await self.http.post("/api/v1/social/groups", json={"name": "Team", "members": [self.coach.id]})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    async def test_group_membership_and_contact_validation(self):
        response = await self.http.post("/api/v1/social/groups", json={"name": "Forged", "members": [self.stranger.id]})
        self.assertEqual(response.status_code, 403)
        group = await self.group()
        self.current = self.stranger
        self.assertEqual((await self.http.get(f"/api/v1/social/groups/{group}/messages")).status_code, 403)
        self.assertEqual((await self.http.post(f"/api/v1/social/groups/{group}/messages", json={"content": "intrusion", "client_id": "1"})).status_code, 403)

    async def test_group_send_retries_do_not_duplicate_messages(self):
        group = await self.group()
        body = {"content": "Hello", "client_id": "retry-id"}
        first = await self.http.post(f"/api/v1/social/groups/{group}/messages", json=body)
        second = await self.http.post(f"/api/v1/social/groups/{group}/messages", json=body)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(len((await self.http.get(f"/api/v1/social/groups/{group}/messages")).json()), 1)

    async def test_block_stops_direct_and_group_sending(self):
        group = await self.group()
        await self.http.patch(f"/api/v1/social/blocks/{self.coach.id}", json={"blocked": True})
        self.assertEqual((await self.http.post("/api/v1/messages", json={"receiver_id": self.coach.id, "content": "No"})).status_code, 403)
        self.assertEqual((await self.http.post(f"/api/v1/social/groups/{group}/messages", json={"content": "No", "client_id": "block"})).status_code, 403)

    async def test_theme_is_shared_but_mute_and_pin_are_personal(self):
        response = await self.http.patch(f"/api/v1/social/conversations/{self.coach.id}/settings", json={"theme": "light", "muted": True, "pinned": True})
        self.assertEqual(response.status_code, 200, response.text)
        mine = self.session.get(ConversationSetting, (self.client.id, self.coach.id))
        theirs = self.session.get(ConversationSetting, (self.coach.id, self.client.id))
        self.assertTrue(mine.muted)
        self.assertFalse(theirs.muted)
        self.assertEqual(theirs.theme, "light")

    async def test_delete_for_me_preserves_other_participant_history(self):
        message = Message(sender_id=self.client.id, receiver_id=self.coach.id, content="Keep")
        self.session.add(message); self.session.commit()
        response = await self.http.post(f"/api/v1/social/conversations/{self.coach.id}/delete", json={"mode": "me"})
        self.assertEqual(response.status_code, 200, response.text)
        self.session.refresh(message)
        self.assertTrue(message.deleted_for_sender)
        self.assertFalse(message.deleted_for_receiver)
        self.assertFalse(message.deleted_for_everyone)

    async def test_delete_for_everyone_marks_both_sides_without_deleting_users(self):
        message = Message(sender_id=self.client.id, receiver_id=self.coach.id, content="Remove")
        self.session.add(message); self.session.commit()
        response = await self.http.post(f"/api/v1/social/conversations/{self.coach.id}/delete", json={"mode": "everyone"})
        self.assertEqual(response.status_code, 200)
        self.session.refresh(message)
        self.assertTrue(message.deleted_for_everyone)
        self.assertIsNotNone(self.session.get(User, self.coach.id))

    async def test_public_profile_never_returns_health_email_or_private_coaching_data(self):
        self.current = self.stranger
        response = await self.http.get(f"/api/v1/social/profile/{self.client.id}")
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertFalse(result["canSeeTraining"])
        self.assertEqual(result["assessments"], [])
        for forbidden in ("email", "phone", "weight", "currentWeight", "startWeight", "workouts", "height", "age", "clientCode"):
            self.assertNotIn(forbidden, result)

    async def test_stories_are_contact_only_by_default_and_viewers_are_owner_only(self):
        body = {"media_url": "/api/v1/uploads/images/u_client_photo.jpg", "media_type": "image"}
        response = await self.http.post("/api/v1/social/stories", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        story_id = response.json()["id"]
        self.current = self.stranger
        self.assertEqual((await self.http.get(f"/api/v1/social/stories?owner_id={self.client.id}")).json(), [])
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{story_id}/view", json={"liked": True})).status_code, 404)
        self.current = self.coach
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{story_id}/view", json={"liked": True})).status_code, 200)
        self.assertEqual((await self.http.get(f"/api/v1/social/stories/{story_id}/viewers")).status_code, 404)
        self.current = self.client
        result = (await self.http.get(f"/api/v1/social/stories/{story_id}/viewers")).json()
        self.assertEqual(result[0]["id"], self.coach.id)
        self.assertTrue(result[0]["liked"])

    async def test_story_requires_owned_media_and_cannot_be_edited_by_another_user(self):
        forged = await self.http.post("/api/v1/social/stories", json={"media_url": "/api/v1/uploads/images/u_coach_private.jpg", "media_type": "image"})
        self.assertEqual(forged.status_code, 403)
        response = await self.http.post("/api/v1/social/stories", json={"media_url": "/api/v1/uploads/images/u_client_photo.jpg", "media_type": "image", "visibility": "public"})
        sid = response.json()["id"]
        self.current = self.coach
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{sid}", json={"caption": "Forged"})).status_code, 404)
        self.assertEqual((await self.http.delete(f"/api/v1/social/stories/{sid}")).status_code, 404)

    async def test_expired_stories_cannot_be_read_or_liked(self):
        story = Story(user_id=self.client.id, media_url="/api/v1/uploads/images/u_client_old.jpg", media_type="image", visibility="public", expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
        self.session.add(story); self.session.commit()
        self.current = self.coach
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{story.id}/view", json={})).status_code, 404)

    async def test_unlinking_does_not_erase_old_chat_access(self):
        self.session.add(Message(sender_id=self.client.id, receiver_id=self.coach.id, content="History"))
        profile = self.session.get(ClientProfile, self.client.id); profile.coach_id = None
        self.session.commit()
        response = await self.http.get(f"/api/v1/social/conversations/{self.coach.id}/settings")
        self.assertEqual(response.status_code, 200, response.text)
