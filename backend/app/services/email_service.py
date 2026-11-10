import asyncio
from app.services.email_templates import render_email, email_language
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    pass


class EmailConfigurationError(EmailDeliveryError):
    pass


class EmailDisabledError(EmailDeliveryError):
    pass


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        # Pydantic reads backend/.env without copying values into os.environ.
        from app.core.config import get_settings
        value = getattr(get_settings(), name, default)

    if value is None:
        return None

    value = str(value).strip()

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


def ensure_email_delivery_enabled() -> None:
    if not _get_bool_env("EMAIL_ENABLED", False):
        raise EmailDisabledError("Email delivery is disabled while testing.")


def _is_valid_email_address(email: str) -> bool:
    _parsed_name, parsed_email = parseaddr(email)

    return bool(
        parsed_email
        and "@" in parsed_email
        and "." in parsed_email.split("@")[-1]
    )


def _build_reset_link(token: str) -> str:
    """
    Builds password reset link.

    Recommended production env:
    FRONTEND_RESET_URL=coachflow://reset-password

    Supported examples:
    - coachflow://reset-password
    - coachflow://reset-password?source=email
    - https://coachflow.app/reset-password
    - https://your-domain.com/reset-password?source=email

    Result:
    - coachflow://reset-password?token=...
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


def _build_reset_plain_text_email(name: str, reset_link: str, token: str, language="en") -> str:
    return render_email("reset", name, token, language, reset_link).plain


def _build_reset_html_email(name: str, reset_link: str, token: str, language="en") -> str:
    return render_email("reset", name, token, language, reset_link).html


def _build_verification_plain_text_email(name: str, code: str, language="en") -> str:
    return render_email("verification", name, code, language).plain


def _build_verification_html_email(name: str, code: str, language="en") -> str:
    return render_email("verification", name, code, language).html


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
    language: str = "en",
) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = to_email
    message["Content-Language"] = email_language(language)
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
    language: str = "en",
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

    clean_token = token.strip()

    if not clean_token:
        raise ValueError("Password reset token is required")

    reset_link = _build_reset_link(clean_token)

    ensure_email_delivery_enabled()

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
            logger.warning(
                "SMTP is not configured. Password reset token for %s: %s",
                to_email,
                clean_token,
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

    content = render_email("reset", name, clean_token, language, reset_link)
    subject, plain_body, html_body = content

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
            language=language,
        )

        logger.info("Password reset email sent")

    except EmailConfigurationError:
        raise

    except Exception as exc:
        logger.warning("Password reset email delivery failed")

        raise EmailDeliveryError("Could not send password reset email") from exc


async def send_email_verification_code(
    email: str,
    name: str,
    code: str,
    language: str = "en",
) -> None:
    """
    Sends email verification code without blocking FastAPI event loop.
    Uses the same SMTP settings as password reset emails.
    """

    to_email = email.strip().lower()

    if not _is_valid_email_address(to_email):
        raise ValueError("Invalid recipient email address")

    clean_code = "".join(ch for ch in code.strip() if ch.isdigit())

    if len(clean_code) != 6:
        raise ValueError("Email verification code must contain 6 digits")

    ensure_email_delivery_enabled()

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
                "SMTP is not configured. Email verification code for %s: %s",
                to_email,
                clean_code,
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

    content = render_email("verification", name, clean_code, language)
    subject, plain_body, html_body = content

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
            language=language,
        )

        logger.info("Verification email sent")

    except EmailConfigurationError:
        raise

    except Exception as exc:
        logger.warning("Verification email delivery failed")

        raise EmailDeliveryError("Could not send email verification code") from exc
