import unittest
from unittest.mock import AsyncMock,patch
import test_regressions as base
from app.core.security import hash_password
from app.services.email_templates import render_email,email_language


class EmailTemplateTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=base.RegressionTests.asyncSetUp
    asyncTearDown=base.RegressionTests.asyncTearDown
    request=base.RegressionTests.request
    @classmethod
    def setUpClass(cls):cls.password_hash=hash_password("Original123!")

    async def test_localized_plain_and_html_escape_user_content_and_explain_expiry(self):
        for language,word in [("ru","Код подтверждения"),("kk","Растау коды"),("en","Verification code")]:
            content=render_email("verification","<img src=x onerror=bad>","123456",language)
            self.assertIn(word,content.plain);self.assertIn(word,content.html)
            self.assertIn("15",content.plain);self.assertNotIn("<img",content.html)
            self.assertIn(f'lang="{language}"',content.html);self.assertNotIn("<script",content.html)
            reset=render_email("reset","Test","preview-code",language,"coachflow://reset-password?token=preview-code")
            self.assertIn("30",reset.plain);self.assertIn("preview-code",reset.plain);self.assertIn("preview-code",reset.html)
            self.assertNotIn("Токен сброса",reset.html)
        self.assertEqual(email_language("kk-KZ,ru;q=0.5"),"kk")
        self.assertEqual(email_language("unknown"),"en")
        with self.assertRaises(ValueError):render_email("reset","Test","code","en","javascript:bad")

    async def test_application_language_reaches_verification_and_reset_delivery(self):
        with patch("app.routers.auth.send_password_reset_email",new=AsyncMock()) as send:
            status,_=await self.request("POST","/api/v1/auth/forgot-password",{"email":self.client.email},extra_headers={"Accept-Language":"kk-KZ"})
            self.assertEqual(status,200);self.assertEqual(send.await_args.kwargs["language"],"kk-KZ")
        self.client.email_verified=False;self.client.email_verification_sent_at=None;self.session.commit()
        with patch("app.routers.auth.send_email_verification_code",new=AsyncMock()) as send:
            status,_=await self.request("POST","/api/v1/auth/resend-verification-code",{"email":self.client.email},extra_headers={"Accept-Language":"ru"})
            self.assertEqual(status,200);self.assertEqual(send.await_args.kwargs["language"],"ru")
