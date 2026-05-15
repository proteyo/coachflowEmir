import asyncio
import html
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


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


def _build_plain_text_email(name: str, reset_link: str, token: str) -> str:
    safe_name = name.strip() or "there"

    return f"""
Hi {safe_name},

We received a request to reset your CoachFlow password.

Tap or open this link to set a new password:
{reset_link}

If the button or link does not open the app, copy this token and paste it into the reset password screen:
{token}

This link and token expire in 30 minutes.

If you did not request this, you can safely ignore this email.

---

Здравствуйте, {safe_name}!

Мы получили запрос на сброс пароля в CoachFlow.

Откройте эту ссылку, чтобы установить новый пароль:
{reset_link}

Если кнопка или ссылка не открывает приложение, скопируйте этот токен и вставьте его на экране сброса пароля:
{token}

Ссылка и токен действуют 30 минут.

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

---

Сәлеметсіз бе, {safe_name}!

CoachFlow құпиясөзін қалпына келтіру сұранысы алынды.

Жаңа құпиясөз орнату үшін мына сілтемені ашыңыз:
{reset_link}

Егер батырма немесе сілтеме қолданбаны ашпаса, осы токенді көшіріп, құпиясөзді қалпына келтіру экранына қойыңыз:
{token}

Сілтеме мен токен 30 минут ішінде жарамды.

Егер бұл сұранысты сіз жібермесеңіз, бұл хатты елемеуге болады.

CoachFlow Team
""".strip()


def _html_section_title(text: str) -> str:
    return (
        '<h3 style="margin:22px 0 8px;font-size:18px;line-height:1.35;'
        'color:#111827;">'
        f"{text}"
        "</h3>"
    )


def _html_paragraph(text: str, color: str = "#374151") -> str:
    return (
        f'<p style="font-size:15px;line-height:1.65;color:{color};'
        'margin:8px 0;">'
        f"{text}"
        "</p>"
    )


def _build_html_email(name: str, reset_link: str, token: str) -> str:
    safe_name = html.escape(name.strip() or "there")
    safe_reset_link = html.escape(reset_link, quote=True)
    safe_token = html.escape(token, quote=True)

    return f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>CoachFlow password reset</title>
  </head>

  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:620px;margin:0 auto;padding:30px 14px;">
      <div style="background:#07111f;border-radius:24px;padding:24px 22px 26px;border:1px solid #102033;">
        <div style="display:inline-block;background:#16c784;color:#02140d;
                    border-radius:999px;padding:7px 12px;font-weight:800;
                    font-size:13px;letter-spacing:0.3px;">
          CoachFlow
        </div>

        <h1 style="margin:18px 0 8px;font-size:26px;line-height:1.25;color:#ffffff;">
          Password reset / Сброс пароля / Құпиясөзді қалпына келтіру
        </h1>

        <p style="font-size:15px;line-height:1.65;color:#cbd5e1;margin:0;">
          Use the button below to set a new password. If it does not open the app,
          copy the token from this email manually.
        </p>
      </div>

      <div style="background:#ffffff;border-radius:22px;padding:26px 22px;margin-top:14px;border:1px solid #e5e7eb;">
        {_html_section_title("English")}
        {_html_paragraph(f"Hi {safe_name},")}
        {_html_paragraph("We received a request to reset your CoachFlow password. Tap the button below to create a new password.")}
        {_html_paragraph("If the button does not open the app, copy the token below and paste it into the reset password screen.")}

        {_html_section_title("Русский")}
        {_html_paragraph(f"Здравствуйте, {safe_name}!")}
        {_html_paragraph("Мы получили запрос на сброс пароля в CoachFlow. Нажмите кнопку ниже, чтобы установить новый пароль.")}
        {_html_paragraph("Если кнопка не открывает приложение, скопируйте токен ниже и вставьте его на экране сброса пароля.")}

        {_html_section_title("Қазақша")}
        {_html_paragraph(f"Сәлеметсіз бе, {safe_name}!")}
        {_html_paragraph("CoachFlow құпиясөзін қалпына келтіру сұранысы алынды. Жаңа құпиясөз орнату үшін төмендегі батырманы басыңыз.")}
        {_html_paragraph("Егер батырма қолданбаны ашпаса, төмендегі токенді көшіріп, құпиясөзді қалпына келтіру экранына қойыңыз.")}

        <div style="margin:26px 0 18px;text-align:center;">
          <a href="{safe_reset_link}"
             style="display:inline-block;background:#16c784;color:#06140f;text-decoration:none;
                    padding:15px 24px;border-radius:14px;font-weight:800;font-size:16px;">
            Reset password
          </a>
        </div>

        <div style="margin:18px 0;padding:16px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p style="font-size:13px;line-height:1.5;color:#64748b;margin:0 0 8px;font-weight:700;">
            Reset token / Токен сброса / Қалпына келтіру токені
          </p>

          <p style="font-size:15px;line-height:1.6;color:#111827;word-break:break-all;margin:0;font-family:Consolas,Monaco,monospace;">
            {safe_token}
          </p>
        </div>

        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:16px 0 6px;">
          The link and token expire in 30 minutes.
        </p>

        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:6px 0;">
          Ссылка и токен действуют 30 минут.
        </p>

        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:6px 0;">
          Сілтеме мен токен 30 минут ішінде жарамды.
        </p>

        <div style="margin-top:18px;padding-top:18px;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 8px;">
            If the button does not work, copy and paste this link:
          </p>

          <p style="font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;margin:0;">
            {safe_reset_link}
          </p>
        </div>

        <p style="font-size:13px;line-height:1.6;color:#6b7280;margin-top:22px;">
          If you did not request this, you can safely ignore this email.
          <br>
          Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
          <br>
          Егер бұл сұранысты сіз жібермесеңіз, бұл хатты елемеуге болады.
        </p>

        <p style="font-size:14px;line-height:1.6;color:#111827;margin-top:24px;font-weight:800;">
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

    clean_token = token.strip()

    if not clean_token:
        raise ValueError("Password reset token is required")

    reset_link = _build_reset_link(clean_token)

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

    subject = "CoachFlow password reset / Сброс пароля / Құпиясөзді қалпына келтіру"
    plain_body = _build_plain_text_email(name, reset_link, clean_token)
    html_body = _build_html_email(name, reset_link, clean_token)

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