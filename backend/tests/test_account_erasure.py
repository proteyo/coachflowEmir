import unittest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
import test_regressions as base
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.profile import ClientProfile
from app.models.auth_session import AuthSession
from app.models.purchase_claim import PurchaseClaim
from app.models.progress import ProgressEntry
from app.models.social import ChatGroup, ChatMember, GroupMessage, Story
from app.models.message import Message


class AccountErasureTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = base.RegressionTests.asyncSetUp
    asyncTearDown = base.RegressionTests.asyncTearDown
    request = base.RegressionTests.request
    token = base.RegressionTests.token

    @classmethod
    def setUpClass(cls):
        cls.password_hash = hash_password("Original123!")

    async def test_requires_reauthentication_and_cannot_target_another_account(self):
        token = self.token()
        status, _ = await self.request("POST", "/api/v1/account/delete", {"password": "wrong", "confirmation": "DELETE"}, token)
        self.assertEqual(status, 403)
        self.assertEqual(self.session.get(User, self.client.id).email, "client@example.com")
        status, _ = await self.request("POST", "/api/v1/account/delete", {"password": "Original123!", "confirmation": "NO"}, token)
        self.assertEqual(status, 422)
        self.assertIsNotNone(self.session.get(ClientProfile, self.client.id))
        status, _ = await self.request("POST", "/api/v1/account/delete", {"password": "Original123!", "confirmation": "DELETE"})
        self.assertEqual(status, 401)

    async def test_personal_data_erased_sessions_revoked_and_other_users_preserved(self):
        owner = self.client.id
        token = self.token()
        self.session.add_all([
            PurchaseClaim(token_hash="receipt-hash", user_id=owner),
            Story(user_id=owner, media_url="/api/v1/uploads/images/u_client_123.jpg", media_type="image"),
            ProgressEntry(client_id=owner, weight=75, date="2026-11-01", added_by=owner),
            ClientProfile(user_id=self.stranger.id, current_weight=80, start_weight=80),
        ])
        self.session.flush()
        other_progress = ProgressEntry(client_id=self.stranger.id, weight=80, date="2026-11-01", added_by=owner)
        group = ChatGroup(owner_id=owner, name="Keep other members")
        self.session.add_all([other_progress, group]); self.session.flush()
        self.session.add_all([ChatMember(group_id=group.id, user_id=owner), ChatMember(group_id=group.id, user_id=self.stranger.id)])
        own_message = Message(sender_id=owner, receiver_id=self.stranger.id, content="Remove my content")
        other_message = Message(sender_id=self.stranger.id, receiver_id=owner, content="Keep sender content", reactions={"like": [owner, self.coach.id]})
        self.session.add_all([own_message, other_message, GroupMessage(group_id=group.id, sender_id=owner, client_id="own", content="Remove"), GroupMessage(group_id=group.id, sender_id=self.stranger.id, client_id="other", content="Keep")])
        self.session.commit()
        own_message_id,other_message_id=own_message.id,other_message.id
        with patch("app.routers.account.cleanup_erased_accounts", AsyncMock()):
            status, body = await self.request("POST", "/api/v1/account/delete", {"password": "Original123!", "confirmation": "DELETE", "user_id": self.stranger.id}, token)
        self.assertEqual(status, 204, body)
        self.session.expire_all()
        tombstone = self.session.get(User, owner)
        self.assertEqual(tombstone.role, "deleting")
        self.assertTrue(tombstone.email.endswith("@account.invalid"))
        self.assertIsNone(tombstone.avatar_url)
        self.assertFalse(verify_password("Original123!", tombstone.password_hash))
        self.assertIsNone(self.session.get(ClientProfile, owner))
        self.assertEqual(self.session.scalars(select(Story).where(Story.user_id == owner)).all(), [])
        self.assertEqual(self.session.scalars(select(AuthSession).where(AuthSession.user_id == owner)).all(), [])
        self.assertIsNotNone(self.session.get(PurchaseClaim, "receipt-hash"))
        self.assertIsNone(self.session.get(Message, own_message_id))
        kept = self.session.get(Message, other_message_id)
        self.assertEqual(kept.content, "Keep sender content")
        self.assertIsNone(kept.receiver_id)
        self.assertEqual(kept.reactions, {"like": [self.coach.id]})
        self.assertEqual(self.session.get(ChatGroup, group.id).owner_id, self.stranger.id)
        self.assertEqual([m.content for m in self.session.scalars(select(GroupMessage)).all()], ["Keep"])
        self.assertEqual(self.session.get(ProgressEntry, other_progress.id).weight, 80)
        self.assertEqual(self.session.get(ProgressEntry, other_progress.id).added_by, "deleted")
        self.assertEqual(self.session.get(User, self.stranger.id).email, "stranger@example.com")
        status, _ = await self.request("GET", "/api/v1/users/me", token=token)
        self.assertEqual(status, 401)

    async def test_expired_coach_cannot_read_or_write_crm_but_can_open_profile_and_plans(self):
        token = self.token(self.coach)
        for method, path, body in [
            ("GET", "/api/v1/crm", None),
            ("POST", f"/api/v1/crm/clients/{self.client.id}/payments", {"amount": "1000", "paid_on": "2026-11-01", "request_id": "blocked"}),
            ("POST", "/api/v1/crm/expenses", {"amount": "1000", "paid_on": "2026-11-01", "request_id": "blocked"}),
            ("DELETE", "/api/v1/crm/payments/missing", None),
            ("PATCH", f"/api/v1/crm/clients/{self.client.id}", {"monthly_fee": "1000"}),
            ("GET", "/api/v1/workouts", None),
            ("GET", "/api/v1/clients", None),
            ("GET", "/api/v1/supplements/plans", None),
        ]:
            status, _ = await self.request(method, path, body, token)
            self.assertEqual(status, 403, path)
        for path in ["/api/v1/users/me", "/api/v1/users/me/coach-profile", "/api/v1/subscriptions/plans"]:
            status, data = await self.request("GET", path, token=token)
            self.assertEqual(status, 200, (path, data))
