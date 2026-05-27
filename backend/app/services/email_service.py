def _build_verification_plain_text_email(name: str, code: str) -> str:
    safe_name = name.strip() or "there"

    return f"""
Hi {safe_name},

Your CoachFlow email verification code is:

{code}

Enter this code in the app to activate your account.

This code expires in 15 minutes.

If you did not create a CoachFlow account, you can ignore this email.

---

Здравствуйте, {safe_name}!

Ваш код подтверждения почты в CoachFlow:

{code}

Введите этот код в приложении, чтобы активировать аккаунт.

Код действует 15 минут.

Если вы не создавали аккаунт CoachFlow, просто проигнорируйте это письмо.

---

Сәлеметсіз бе, {safe_name}!

CoachFlow почтасын растау коды:

{code}

Аккаунтты белсендіру үшін осы кодты қолданбаға енгізіңіз.

Код 15 минут ішінде жарамды.

Егер CoachFlow аккаунтын сіз жасамаған болсаңыз, бұл хатты елемеуге болады.

CoachFlow Team
""".strip()


def _build_verification_html_email(name: str, code: str) -> str:
    safe_name = html.escape(name.strip() or "there")
    safe_code = html.escape(code, quote=True)

    return f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>CoachFlow email verification</title>
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
          Email verification / Подтверждение почты / Поштаны растау
        </h1>

        <p style="font-size:15px;line-height:1.65;color:#cbd5e1;margin:0;">
          Enter this code in the app to activate your account.
        </p>
      </div>

      <div style="background:#ffffff;border-radius:22px;padding:26px 22px;margin-top:14px;border:1px solid #e5e7eb;">
        {_html_section_title("English")}
        {_html_paragraph(f"Hi {safe_name},")}
        {_html_paragraph("Your CoachFlow verification code is shown below. Enter it in the app to activate your account.")}

        {_html_section_title("Русский")}
        {_html_paragraph(f"Здравствуйте, {safe_name}!")}
        {_html_paragraph("Ваш код подтверждения CoachFlow указан ниже. Введите его в приложении, чтобы активировать аккаунт.")}

        {_html_section_title("Қазақша")}
        {_html_paragraph(f"Сәлеметсіз бе, {safe_name}!")}
        {_html_paragraph("CoachFlow растау коды төменде көрсетілген. Аккаунтты белсендіру үшін оны қолданбаға енгізіңіз.")}

        <div style="margin:26px 0;padding:20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:13px;line-height:1.5;color:#64748b;margin:0 0 10px;font-weight:700;">
            Verification code / Код подтверждения / Растау коды
          </p>

          <p style="font-size:34px;line-height:1.2;color:#111827;letter-spacing:8px;margin:0;font-family:Consolas,Monaco,monospace;font-weight:900;">
            {safe_code}
          </p>
        </div>

        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:16px 0 6px;">
          This code expires in 15 minutes.
        </p>

        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:6px 0;">
          Код действует 15 минут.
        </p>

        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:6px 0;">
          Код 15 минут ішінде жарамды.
        </p>

        <p style="font-size:13px;line-height:1.6;color:#6b7280;margin-top:22px;">
          If you did not create a CoachFlow account, you can ignore this email.
          <br>
          Если вы не создавали аккаунт CoachFlow, просто проигнорируйте это письмо.
          <br>
          Егер CoachFlow аккаунтын сіз жасамаған болсаңыз, бұл хатты елемеуге болады.
        </p>

        <p style="font-size:14px;line-height:1.6;color:#111827;margin-top:24px;font-weight:800;">
          CoachFlow Team
        </p>
      </div>
    </div>
  </body>
</html>
""".strip()


async def send_email_verification_code(
    email: str,
    name: str,
    code: str,
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

    subject = "CoachFlow email verification code / Код подтверждения / Растау коды"
    plain_body = _build_verification_plain_text_email(name, clean_code)
    html_body = _build_verification_html_email(name, clean_code)

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

        logger.info("Email verification code sent to %s", to_email)

    except EmailConfigurationError:
        raise

    except Exception as exc:
        logger.exception("Failed to send email verification code to %s", to_email)

        raise EmailDeliveryError("Could not send email verification code") from exc