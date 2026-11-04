import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException
from app.routers.auth import verify_email
from app.schemas.auth import VerifyEmailRequest


class EmailVerificationSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_confirmed_email_does_not_issue_tokens_for_an_arbitrary_code(self):
        user = SimpleNamespace(email_verified=True)
        result = SimpleNamespace(scalar_one_or_none=lambda: user)
        db = SimpleNamespace(execute=AsyncMock(return_value=result))
        with self.assertRaises(HTTPException) as raised:
            await verify_email(VerifyEmailRequest(email="owner@example.com", code="000000"), db)
        self.assertEqual(raised.exception.status_code, 400)
