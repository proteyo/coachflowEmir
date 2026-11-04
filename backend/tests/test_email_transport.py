"""HTTPS email transport tests: no real messages are sent."""
import json
import io
import os
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from app.services import email_service as email


class EmailTransportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "EMAIL_PROVIDER": "resend", "RESEND_API_KEY": "test-key-not-real",
            "EMAIL_FROM": "CoachFlow <hello@example.com>", "FRONTEND_RESET_URL": "coachflow://reset-password",
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    async def test_confirmation_uses_https_without_smtp(self):
        response = Mock()
        response.read.return_value = b'{"id":"mail_test"}'
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        with patch.object(email, "urlopen", return_value=response) as request, patch.object(email.smtplib, "SMTP") as smtp:
            await email.send_email_verification_code("person@example.com", "Person", "123456")
        smtp.assert_not_called()
        sent = request.call_args.args[0]
        self.assertEqual(sent.full_url, "https://api.resend.com/emails")
        self.assertEqual(sent.method, "POST")
        body = json.loads(sent.data)
        self.assertEqual(body["to"], ["person@example.com"])
        self.assertIn("123456", body["text"])
        self.assertIn("123456", body["html"])

    async def test_password_reset_uses_https_transport(self):
        with patch.object(email, "_send_resend_email_sync") as sender:
            await email.send_password_reset_email("person@example.com", "Person", "reset-token")
        self.assertIn("coachflow://reset-password?token=reset-token", sender.call_args.kwargs["plain_body"])

    async def test_provider_error_is_safe_and_does_not_log_code_or_key(self):
        error = HTTPError("https://api.resend.com/emails", 403, "Denied", {}, None)
        with patch.object(email, "urlopen", side_effect=error), self.assertLogs(email.logger, level="ERROR") as captured:
            with self.assertRaises(email.EmailDeliveryError):
                await email.send_email_verification_code("person@example.com", "Person", "123456")
        output = " ".join(captured.output)
        self.assertIn("403", output)
        self.assertNotIn("123456", output)
        self.assertNotIn("test-key-not-real", output)

    async def test_missing_key_is_delivery_error_not_unhandled_server_error(self):
        with patch.dict(os.environ, {"RESEND_API_KEY": ""}):
            with self.assertRaises(email.EmailDeliveryError):
                await email.send_email_verification_code("person@example.com", "Person", "123456")

    async def test_test_sender_restriction_is_classified_without_exposing_provider_text(self):
        failure = io.BytesIO(json.dumps({"message": "You can only send testing emails to your own email address (private@example.com)."}).encode())
        error = HTTPError("https://api.resend.com/emails", 403, "Denied", {}, failure)
        with patch.object(email, "urlopen", side_effect=error):
            with self.assertRaises(email.EmailRecipientRestrictionError) as raised:
                await email.send_password_reset_email("person@example.com", "Person", "private-reset-token")
        self.assertNotIn("private@example.com", str(raised.exception))
        self.assertNotIn("private-reset-token", str(raised.exception))

    async def test_dotenv_settings_are_used_when_environment_variable_is_absent(self):
        from types import SimpleNamespace
        settings = SimpleNamespace(SMTP_HOST="smtp.example.com", SMTP_USE_TLS=True)
        with patch.dict(os.environ, {}, clear=True), patch("app.core.config.get_settings", return_value=settings):
            self.assertEqual(email._get_env("SMTP_HOST"), "smtp.example.com")
            self.assertTrue(email._get_bool_env("SMTP_USE_TLS"))
