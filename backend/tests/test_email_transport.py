"""SMTP checks: no real network connections or emails."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from app.services import email_service as email


class EmailTransportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "EMAIL_ENABLED": "true", "SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587",
            "SMTP_USER": "sender@example.com", "SMTP_PASSWORD": "smtp-test-only",
            "SMTP_FROM": "CoachFlow <sender@example.com>", "SMTP_USE_TLS": "true", "SMTP_USE_SSL": "false",
            "FRONTEND_RESET_URL": "coachflow://reset-password", "ALLOW_EMAIL_CONSOLE_FALLBACK": "false",
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    async def test_confirmation_uses_smtp(self):
        with patch.object(email, "_send_email_sync") as sender:
            await email.send_email_verification_code("person@example.com", "Person", "123456")
        self.assertEqual(sender.call_args.kwargs["smtp_host"], "smtp.example.com")
        self.assertIn("123456", sender.call_args.kwargs["plain_body"])

    async def test_recovery_uses_smtp_and_includes_link(self):
        with patch.object(email, "_send_email_sync") as sender:
            await email.send_password_reset_email("person@example.com", "Person", "test-reset-token")
        self.assertIn("coachflow://reset-password?token=test-reset-token", sender.call_args.kwargs["plain_body"])

    async def test_disabled_email_does_not_connect(self):
        with patch.dict(os.environ, {"EMAIL_ENABLED": "false"}), patch.object(email, "_send_email_sync") as sender:
            with self.assertRaises(email.EmailDisabledError):
                await email.send_email_verification_code("person@example.com", "Person", "123456")
            with self.assertRaises(email.EmailDisabledError):
                await email.send_password_reset_email("person@example.com", "Person", "test-token")
        sender.assert_not_called()

    async def test_tls_authenticates_and_sends(self):
        server = Mock()
        connection = Mock()
        connection.__enter__ = Mock(return_value=server)
        connection.__exit__ = Mock(return_value=False)
        with patch.object(email.smtplib, "SMTP", return_value=connection):
            await email.send_email_verification_code("person@example.com", "Person", "123456")
        server.starttls.assert_called_once()
        server.login.assert_called_once_with("sender@example.com", "smtp-test-only")
        server.send_message.assert_called_once()

    async def test_ssl_uses_ssl_instead_of_starttls(self):
        server = Mock()
        connection = Mock()
        connection.__enter__ = Mock(return_value=server)
        connection.__exit__ = Mock(return_value=False)
        with patch.dict(os.environ, {"SMTP_PORT": "465", "SMTP_USE_TLS": "false", "SMTP_USE_SSL": "true"}), patch.object(email.smtplib, "SMTP_SSL", return_value=connection), patch.object(email.smtplib, "SMTP") as plain:
            await email.send_email_verification_code("person@example.com", "Person", "123456")
        plain.assert_not_called()
        server.starttls.assert_not_called()
        server.send_message.assert_called_once()

    async def test_missing_password_is_delivery_error(self):
        with patch.dict(os.environ, {"SMTP_PASSWORD": ""}):
            with self.assertRaises(email.EmailDeliveryError):
                await email.send_email_verification_code("person@example.com", "Person", "123456")

    async def test_dotenv_settings_are_used(self):
        settings = SimpleNamespace(SMTP_HOST="smtp.example.com", SMTP_USE_TLS=True)
        with patch.dict(os.environ, {}, clear=True), patch("app.core.config.get_settings", return_value=settings):
            self.assertEqual(email._get_env("SMTP_HOST"), "smtp.example.com")
            self.assertTrue(email._get_bool_env("SMTP_USE_TLS"))

    async def test_obsolete_settings_are_ignored(self):
        from app.core.config import Settings
        settings = Settings(_env_file=None, EMAIL_ENABLED=False, EMAIL_PROVIDER="resend", RESEND_API_KEY="obsolete-test-key")
        settings._validate_smtp_settings()
        self.assertNotIn("RESEND_API_KEY", settings.model_dump())
