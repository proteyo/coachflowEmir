"""Offline consent and report authorization checks; no production services."""
import unittest
from unittest.mock import AsyncMock, patch
from pydantic import ValidationError
from sqlalchemy import select
import test_regressions as base
from app.core.security import hash_password
from app.schemas.auth import RegisterRequest
from app.models.content_report import ContentReport
from app.models.message import Message
from app.services.legal_terms import LEGAL_VERSION


class PublicationSafetyTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = base.RegressionTests.asyncSetUp
    asyncTearDown = base.RegressionTests.asyncTearDown
    request = base.RegressionTests.request
    token = base.RegressionTests.token

    @classmethod
    def setUpClass(cls):
        cls.password_hash = hash_password("Original123!")

    async def test_registration_requires_explicit_current_adult_and_health_consent(self):
        body = dict(name="Client", email="adult@example.com", password="Strong123!", role="client", gender="female", age=18, terms_version=LEGAL_VERSION, adult_confirmed=True, health_data_consent=True)
        self.assertEqual(RegisterRequest(**body).age, 18)
        for changes in [{"adult_confirmed": False}, {"adult_confirmed": "true"}, {"terms_version": "old"}, {"health_data_consent": False}, {"age": 17}]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                RegisterRequest(**(body | changes))

    async def test_existing_user_consent_is_explicit_and_idempotent(self):
        token = self.token()
        body = dict(terms_version=LEGAL_VERSION, adult_confirmed=True, health_data_consent=False)
        status, _ = await self.request("POST", "/api/v1/account/accept-terms", body, token)
        self.assertEqual(status, 422)
        self.assertIsNone(self.client.terms_version)
        body["health_data_consent"] = True
        status, user = await self.request("POST", "/api/v1/account/accept-terms", body, token)
        self.assertEqual(status, 200, user)
        self.assertEqual(user["termsVersion"], LEGAL_VERSION)
        accepted = self.client.terms_accepted_at
        status, _ = await self.request("POST", "/api/v1/account/accept-terms", body, token)
        self.assertEqual(status, 200)
        self.assertEqual(self.client.terms_accepted_at, accepted)

    async def test_report_is_private_scoped_and_duplicate_safe(self):
        token = self.token()
        message = Message(sender_id=self.coach.id, receiver_id=self.client.id, content="Reported message")
        self.session.add(message); self.session.commit()
        payload = dict(target_type="message", target_id=message.id, reason="abuse", note="<script>alert(1)</script>'; DROP TABLE users; --")
        status, report = await self.request("POST", "/api/v1/safety/reports", payload, token)
        self.assertEqual(status, 202, report)
        status, repeated = await self.request("POST", "/api/v1/safety/reports", payload, token)
        self.assertEqual(repeated, report)
        self.assertEqual(len(self.session.scalars(select(ContentReport)).all()), 1)
        self.assertEqual(self.session.get(ContentReport, report["id"]).note, payload["note"])
        status, _ = await self.request("POST", "/api/v1/safety/reports", payload, self.token(self.stranger))
        self.assertEqual(status, 404)
        status, _ = await self.request("GET", "/api/v1/safety/reports", token=token)
        self.assertEqual(status, 405)
        self.assertIsNotNone(self.session.get(type(self.client), self.client.id))

    async def test_external_deletion_wrong_password_preserves_user_and_never_echoes_credentials(self):
        from fastapi import BackgroundTasks
        from starlette.requests import Request
        from app.routers.legal import delete_from_web, HEADERS
        for language in ("ru", "kk", "en"):
            status, page = await self.request("GET", "/privacy?lang=" + language)
            self.assertEqual(status, 200)
            self.assertIn(b"CoachFlow", page)
        self.assertIn("default-src 'none'", HEADERS["Content-Security-Policy"])
        self.assertEqual(HEADERS["Cache-Control"], "no-store")
        request = Request({"type": "http", "client": ("127.0.0.1", 1234), "headers": []})
        secret = "WrongPasswordNeverEcho123"
        response = await delete_from_web(request, BackgroundTasks(), self.client.email, secret, "DELETE", "en", self.db)
        self.assertEqual(response.status_code, 400)
        self.assertNotIn(secret.encode(), response.body)
        self.assertEqual(self.client.role, "client")
        response = await delete_from_web(request, BackgroundTasks(), self.client.email, "Original123!", "DELETE", "en", self.db)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.role, "deleting")
        self.assertEqual(self.stranger.role, "client")
