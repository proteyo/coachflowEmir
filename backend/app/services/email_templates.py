"""Single-language transactional email, with plain-text and script-free HTML."""
import html
from typing import NamedTuple


def email_language(value):
    if not isinstance(value, str):
        return "en"
    for part in value[:200].lower().split(","):
        code = part.split(";")[0].strip().replace("_", "-").split("-")[0]
        if code in ("ru", "kk", "en"):
            return code
    return "en"


COPY = {
    "ru": {
        "verification_subject": "CoachFlow — подтвердите почту",
        "reset_subject": "CoachFlow — восстановление пароля",
        "hello": "Здравствуйте", "fallback_name": "", "team": "Команда CoachFlow",
        "verification_title": "Подтвердите вашу почту",
        "verification_intro": "Откройте CoachFlow и введите этот шестизначный код на экране «Подтвердите почту» для адреса, на который пришло письмо.",
        "verification_secret": "Код подтверждения", "verification_time": "Код действует 15 минут и используется один раз. Если срок истёк, запросите новый код в приложении.",
        "verification_ignore": "Если вы не создавали аккаунт CoachFlow, ничего делать не нужно. Не передавайте этот код другим людям.",
        "reset_title": "Новый пароль — в пару шагов",
        "reset_intro": "Вы запросили восстановление доступа к CoachFlow. Нажмите кнопку, чтобы открыть приложение и задать новый пароль.",
        "reset_button": "Изменить пароль", "reset_secret": "Код восстановления",
        "reset_fallback": "Кнопка не открыла приложение? Откройте CoachFlow → «Забыли пароль?» → «Есть код восстановления?». Скопируйте код ниже целиком и вставьте в поле «Код восстановления». Можно вставить и полную ссылку из этого письма.",
        "reset_time": "Ссылка и код действуют 30 минут и используются один раз. После изменения пароля выполните вход заново.",
        "reset_ignore": "Если вы не запрашивали смену пароля, просто проигнорируйте письмо. Ваш пароль не изменится. Никому не передавайте ссылку и код.",
        "link": "Ссылка для открытия приложения", "help": "Нужна помощь?", "security": "Это служебное письмо безопасности. Мы не просим сообщать код или пароль в переписке.",
    },
    "kk": {
        "verification_subject": "CoachFlow — поштаңызды растаңыз",
        "reset_subject": "CoachFlow — құпиясөзді қалпына келтіру",
        "hello": "Сәлеметсіз бе", "fallback_name": "", "team": "CoachFlow командасы",
        "verification_title": "Поштаңызды растаңыз",
        "verification_intro": "CoachFlow қолданбасын ашып, хат келген мекенжай үшін «Поштаны растаңыз» экранына осы алты таңбалы кодты енгізіңіз.",
        "verification_secret": "Растау коды", "verification_time": "Код 15 минут жарамды және бір рет қолданылады. Мерзімі өтсе, қолданбада жаңа код сұраңыз.",
        "verification_ignore": "CoachFlow аккаунтын жасамаған болсаңыз, ештеңе істеу қажет емес. Кодты басқа адамға бермеңіз.",
        "reset_title": "Жаңа құпиясөзге бірнеше қадам",
        "reset_intro": "Сіз CoachFlow қолжетімділігін қалпына келтіруді сұрадыңыз. Қолданбаны ашып, жаңа құпиясөз қою үшін батырманы басыңыз.",
        "reset_button": "Құпиясөзді өзгерту", "reset_secret": "Қалпына келтіру коды",
        "reset_fallback": "Батырма қолданбаны ашпады ма? CoachFlow → «Құпиясөзді ұмыттыңыз ба?» → «Қалпына келтіру коды бар ма?» тармағын ашыңыз. Төмендегі кодты толық көшіріп, «Қалпына келтіру коды» өрісіне қойыңыз. Хаттағы толық сілтемені де қоюға болады.",
        "reset_time": "Сілтеме мен код 30 минут жарамды және бір рет қолданылады. Құпиясөзді өзгерткеннен кейін қайта кіріңіз.",
        "reset_ignore": "Құпиясөзді өзгертуді сұрамаған болсаңыз, хатты елемеңіз. Құпиясөзіңіз өзгермейді. Сілтеме мен кодты ешкімге бермеңіз.",
        "link": "Қолданбаны ашу сілтемесі", "help": "Көмек керек пе?", "security": "Бұл — қауіпсіздік туралы қызметтік хат. Біз хат алмасуда код не құпиясөз сұрамаймыз.",
    },
    "en": {
        "verification_subject": "CoachFlow — verify your email",
        "reset_subject": "CoachFlow — reset your password",
        "hello": "Hello", "fallback_name": "", "team": "The CoachFlow team",
        "verification_title": "Confirm your email",
        "verification_intro": "Open CoachFlow and enter this six-digit code on the Confirm email screen for the address that received this message.",
        "verification_secret": "Verification code", "verification_time": "This code expires in 15 minutes and works once. If it expires, request a new code in the app.",
        "verification_ignore": "If you did not create a CoachFlow account, no action is needed. Do not share this code with anyone.",
        "reset_title": "A fresh password in a few steps",
        "reset_intro": "You requested access recovery for CoachFlow. Use the button to open the app and choose a new password.",
        "reset_button": "Change password", "reset_secret": "Recovery code",
        "reset_fallback": "The button did not open the app? Open CoachFlow → Forgot password? → Already have a recovery code? Copy the entire code below into the Recovery code field. You can also paste the complete link from this email.",
        "reset_time": "The link and code expire in 30 minutes and work once. Sign in again after changing your password.",
        "reset_ignore": "If you did not request a password change, ignore this message. Your password will not change. Never share the link or code.",
        "link": "App recovery link", "help": "Need help?", "security": "This is a security service email. We never ask you to send your password or code in a conversation.",
    },
}


class EmailContent(NamedTuple):
    subject: str
    plain: str
    html: str


def render_email(kind: str, name: str, secret: str, language="en", reset_link=""):
    if kind not in ("verification", "reset"):
        raise ValueError("Unknown transactional email")
    language = email_language(language)
    L = COPY[language]
    name = name.strip()[:120]
    greeting = L["hello"] + (", " + name if name else "") + "!"
    title, intro = L[kind + "_title"], L[kind + "_intro"]
    label, expiry, ignore = L[kind + "_secret"], L[kind + "_time"], L[kind + "_ignore"]
    blocks = [greeting, title, intro]
    if kind == "reset":
        blocks.extend([L["reset_button"] + ": " + reset_link, L["reset_fallback"]])
    blocks.extend([label + ":", secret, expiry, ignore, L["help"] + " klaevers001@gmail.com", L["security"], L["team"]])
    plain = "\n\n".join(blocks)
    escape = html.escape
    button = fallback = link = ""
    if kind == "reset":
        if not reset_link.startswith(("https://", "http://", "coachflow://", "exp://", "exps://")):
            raise ValueError("Unsupported recovery URL")
        button = f'<p style="margin:24px 0"><a href="{escape(reset_link, quote=True)}" style="display:inline-block;background:#0bb985;color:#052e24;padding:15px 22px;border-radius:14px;font-size:16px;font-weight:700;text-decoration:none">{escape(L["reset_button"])}</a></p>'
        fallback = f'<p style="line-height:1.7;color:#42586a">{escape(L["reset_fallback"])}</p>'
        link = f'<p style="font-size:13px;color:#597080">{escape(L["link"])}</p><p style="font-size:12px;overflow-wrap:anywhere;word-break:break-all"><a href="{escape(reset_link, quote=True)}" style="color:#08765b">{escape(reset_link)}</a></p>'
    secret_style = 'font-size:30px;letter-spacing:5px;text-align:center;' if kind == "verification" else 'font-size:14px;word-break:break-all;overflow-wrap:anywhere;'
    document = f'''<!doctype html><html lang="{language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:#edf5f2;font-family:Arial,Helvetica,sans-serif;color:#12263a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf5f2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td style="padding:28px 24px;background:#105b4d;color:#ffffff"><strong style="font-size:25px;letter-spacing:0.5px">CoachFlow</strong></td></tr>
<tr><td style="padding:26px 24px"><p style="margin:0 0 14px;line-height:1.6">{escape(greeting)}</p><h1 style="font-size:25px;line-height:1.3;margin:0 0 18px">{escape(title)}</h1><p style="line-height:1.7;color:#42586a">{escape(intro)}</p>{button}{fallback}
<div style="padding:18px 16px;background:#e8f8f1;border:1px solid #b7e6d4;border-radius:16px;margin:22px 0"><p style="font-size:12px;margin:0 0 12px;color:#30634f">{escape(label)}</p><p dir="ltr" style="font-family:Consolas,Monaco,monospace;font-weight:700;line-height:1.7;margin:0;{secret_style}">{escape(secret)}</p></div>
<p style="font-size:14px;line-height:1.7;color:#42586a">{escape(expiry)}</p>{link}<p style="font-size:14px;line-height:1.7;color:#42586a">{escape(ignore)}</p>
<div style="border-top:1px solid #e2ece8;margin-top:25px;padding-top:20px"><p style="font-size:13px;line-height:1.7;color:#597080">{escape(L["help"])} <a href="mailto:klaevers001@gmail.com" style="color:#08765b">klaevers001@gmail.com</a></p><p style="font-size:12px;line-height:1.7;color:#597080">{escape(L["security"])}</p><strong style="font-size:14px">{escape(L["team"])}</strong></div></td></tr></table></td></tr></table></body></html>'''
    return EmailContent(L[kind + "_subject"], plain, document)
