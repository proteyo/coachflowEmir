import asyncio
import html
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl


logger = logging.getLogger(__name__)


class EmailConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)

    if value is None:
        return None

    value = value.strip()

    return value or None


def _get_required_env(name: str) -> str:
    value = _get_env(name)

    if not value:
        raise EmailConfigurationError(f"Missing required environment variable: {name}")

    return value


def _get_int_env(name: str, default: int) -> int:
    value = _get_env(name)

    if value is None:
        return default

    try:
        return int(value)
    except ValueError as exc:
        raise EmailConfigurationError(
            f"Environment variable {name} must be an integer"
        ) from exc


def _get_bool_env(name: str, default: bool = False) -> bool:
    value = _get_env(name)

    if value is None:
        return default

    return value.lower() in {"1", "true", "yes", "on"}


def _is_valid_email_address(email: str) -> bool:
    parsed_name, parsed_email = parseaddr(email)

    return bool(parsed_email and "@" in parsed_email and "." in parsed_email.split("@")[-1])


def _build_reset_link(token: str) -> str:
    """
    Builds password reset link.

    FRONTEND_RESET_URL examples:
    - coachflow://reset-password
    - https://coachflow.app/reset-password
    - https://your-domain.com/reset-password?source=email
    """
    base_url = _get_required_env("FRONTEND_RESET_URL")

    parsed = urlsplit(base_url)
    current_query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    current_query["token"] = token

    new_query = urlencode(current_query)

    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            new_query,
            parsed.fragment,
        )
    )


def _build_plain_text_email(name: str, reset_link: str) -> str:
    safe_name = name.strip() or "there"

    return f"""
Hi {safe_name},

We received a request to reset your CoachFlow password.

Open this link to set a new password:

{reset_link}

This link expires in 30 minutes.

If you did not request this, you can safely ignore this email.

CoachFlow Team
""".strip()


def _build_html_email(name: str, reset_link: str) -> str:
    safe_name = html.escape(name.strip() or "there")
    safe_reset_link = html.escape(reset_link, quote=True)

    return f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Reset your CoachFlow password</title>
  </head>

  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#111827;">
          Reset your CoachFlow password
        </h2>

        <p style="font-size:15px;line-height:1.6;color:#374151;">
          Hi {safe_name},
        </p>

        <p style="font-size:15px;line-height:1.6;color:#374151;">
          We received a request to reset your CoachFlow password.
          Tap the button below to create a new password.
        </p>

        <div style="margin:24px 0;">
          <a href="{safe_reset_link}"
             style="display:inline-block;background:#16c784;color:#ffffff;text-decoration:none;
                    padding:13px 20px;border-radius:12px;font-weight:700;font-size:15px;">
            Reset password
          </a>
        </div>

        <p style="font-size:13px;line-height:1.6;color:#6b7280;">
          This link expires in 30 minutes.
        </p>

        <p style="font-size:13px;line-height:1.6;color:#6b7280;">
          If the button does not work, copy and paste this link:
        </p>

        <p style="font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;">
          {safe_reset_link}
        </p>

        <p style="font-size:13px;line-height:1.6;color:#6b7280;margin-top:22px;">
          If you did not request this, you can safely ignore this email.
        </p>

        <p style="font-size:14px;line-height:1.6;color:#111827;margin-top:24px;">
          CoachFlow Team
        </p>
      </div>
    </div>
  </body>
</html>
""".strip()


def _send_email_sync(
    *,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_from: str,
    smtp_use_tls: bool,
    smtp_use_ssl: bool,
    smtp_timeout: int,
    to_email: str,
    subject: str,
    plain_body: str,
    html_body: str,
) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = to_email
    message.set_content(plain_body)
    message.add_alternative(html_body, subtype="html")

    context = ssl.create_default_context()

    if smtp_use_ssl:
        with smtplib.SMTP_SSL(
            smtp_host,
            smtp_port,
            timeout=smtp_timeout,
            context=context,
        ) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(message)
        return

    with smtplib.SMTP(smtp_host, smtp_port, timeout=smtp_timeout) as server:
        server.ehlo()

        if smtp_use_tls:
            server.starttls(context=context)
            server.ehlo()

        server.login(smtp_user, smtp_password)
        server.send_message(message)


async def send_password_reset_email(
    email: str,
    name: str,
    token: str,
) -> None:
    """
    Sends password reset email without blocking FastAPI event loop.

    Required production env:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your_email@gmail.com
    SMTP_PASSWORD=your_google_app_password
    SMTP_FROM=CoachFlow <your_email@gmail.com>
    SMTP_USE_TLS=true
    SMTP_USE_SSL=false
    SMTP_TIMEOUT_SECONDS=20
    FRONTEND_RESET_URL=coachflow://reset-password

    For local development only:
    ALLOW_EMAIL_CONSOLE_FALLBACK=true
    """

    to_email = email.strip().lower()

    if not _is_valid_email_address(to_email):
        raise ValueError("Invalid recipient email address")

    if not token or not token.strip():
        raise ValueError("Password reset token is required")

    reset_link = _build_reset_link(token.strip())

    smtp_host = _get_env("SMTP_HOST")
    smtp_port = _get_int_env("SMTP_PORT", 587)
    smtp_user = _get_env("SMTP_USER")
    smtp_password = _get_env("SMTP_PASSWORD")
    smtp_from = _get_env("SMTP_FROM", smtp_user or "")
    smtp_use_tls = _get_bool_env("SMTP_USE_TLS", True)
    smtp_use_ssl = _get_bool_env("SMTP_USE_SSL", False)
    smtp_timeout = _get_int_env("SMTP_TIMEOUT_SECONDS", 20)
    allow_console_fallback = _get_bool_env("ALLOW_EMAIL_CONSOLE_FALLBACK", False)

    if not smtp_host or not smtp_user or not smtp_password or not smtp_from:
        if allow_console_fallback:
            logger.warning(
                "SMTP is not configured. Password reset link for %s: %s",
                to_email,
                reset_link,
            )
            return

        raise EmailConfigurationError(
            "SMTP is not fully configured. Check SMTP_HOST, SMTP_USER, "
            "SMTP_PASSWORD and SMTP_FROM."
        )

    if smtp_use_ssl and smtp_use_tls:
        raise EmailConfigurationError(
            "SMTP_USE_SSL and SMTP_USE_TLS cannot both be true. "
            "Use SMTP_USE_TLS=true for port 587 or SMTP_USE_SSL=true for port 465."
        )

    subject = "Reset your CoachFlow password"
    plain_body = _build_plain_text_email(name, reset_link)
    html_body = _build_html_email(name, reset_link)

    try:
        await asyncio.to_thread(
            _send_email_sync,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_user=smtp_user,
            smtp_password=smtp_password,
            smtp_from=smtp_from,
            smtp_use_tls=smtp_use_tls,
            smtp_use_ssl=smtp_use_ssl,
            smtp_timeout=smtp_timeout,
            to_email=to_email,
            subject=subject,
            plain_body=plain_body,
            html_body=html_body,
        )

        logger.info("Password reset email sent to %s", to_email)

    except EmailConfigurationError:
        raise

    except Exception as exc:
        logger.exception("Failed to send password reset email to %s", to_email)

        raise EmailDeliveryError("Could not send password reset email") from exc