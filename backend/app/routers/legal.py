"""Public store links and a password-authenticated deletion form. No analytics,
remote scripts, cookies, reflected credentials or secret configuration values.
"""
import html
import json
import secrets
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, Form, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.rate_limit import consume_limit
from app.core.security import hash_password, verify_password
from app.db.database import get_db
from app.models.user import User
from app.services.account_erasure import erase_account, cleanup_erased_accounts

router = APIRouter(tags=["Legal"])
CONTENT = json.loads((Path(__file__).resolve().parents[1] / "legal_content.json").read_text(encoding="utf-8"))
Language = Literal["ru", "en", "kk"]
DUMMY_HASH = hash_password(secrets.token_urlsafe(32))
HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}


def page(kind, lang, message="", status=200):
    L = CONTENT[lang]
    title = L[{"privacy": "privacyTitle", "terms": "termsTitle", "deletion": "deletionTitle"}[kind]]
    blocks = "".join(f"<section><h2>{html.escape(heading)}</h2><p>{html.escape(body)}</p></section>" for heading, body in L[kind])
    form = ""
    if kind == "deletion" and not message:
        form = f'''<form method="post" action="/api/v1/account/delete-from-web">
        <input type="hidden" name="lang" value="{lang}">
        <label>{L['email']}<input name="email" type="email" autocomplete="username" maxlength="320" required></label>
        <label>{L['password']}<input name="password" type="password" autocomplete="current-password" maxlength="256" required></label>
        <label>{L['confirmation']}<input name="confirmation" autocomplete="off" pattern="DELETE" maxlength="6" required></label>
        <button>{L['delete']}</button></form>'''
    document = f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} · CoachFlow</title>
    <style>body{{font:16px/1.7 system-ui,sans-serif;max-width:760px;margin:auto;padding:28px;color:#12263a;background:#f5f7fa}}h1{{line-height:1.2}}h2{{font-size:20px;margin-top:30px}}a{{color:#08795b}}nav{{display:flex;gap:18px;flex-wrap:wrap}}form{{padding:24px;border-radius:20px;background:white}}label{{display:block;margin-bottom:18px}}input{{display:block;box-sizing:border-box;width:100%;padding:14px;border:1px solid #b9c8c3;border-radius:10px;font-size:16px}}button{{padding:14px;border:0;border-radius:12px;color:white;background:#9d2945;font-size:16px}}.notice{{padding:20px;border-radius:16px;background:#dff6ed}}@media(prefers-color-scheme:dark){{body{{background:#081322;color:#e8f0fa}}form{{background:#132338}}input{{background:#0e1a2e;color:white}}a{{color:#37dc9d}}.notice{{background:#103e33}}}}</style></head><body>
    <nav><strong>CoachFlow</strong><a href="?lang=ru">RU</a><a href="?lang=kk">ҚАЗ</a><a href="?lang=en">EN</a></nav><h1>{html.escape(title)}</h1><p>{L['updated']}: {CONTENT['version']}</p>
    {f'<p class="notice">{html.escape(message)}</p>' if message else ''}{blocks}{form}
    <footer><a href="/privacy?lang={lang}">{L['privacyTitle']}</a> · <a href="/terms?lang={lang}">{L['termsTitle']}</a> · <a href="/delete-account?lang={lang}">{L['deletionTitle']}</a></footer></body></html>'''
    return HTMLResponse(document, status_code=status, headers=HEADERS)


@router.get("/privacy", response_class=HTMLResponse)
async def privacy(lang: Language = "ru"):
    return page("privacy", lang)


@router.get("/terms", response_class=HTMLResponse)
async def terms(lang: Language = "ru"):
    return page("terms", lang)


@router.get("/delete-account", response_class=HTMLResponse)
async def deletion(lang: Language = "ru"):
    return page("deletion", lang)


@router.post("/api/v1/account/delete-from-web", response_class=HTMLResponse)
async def delete_from_web(request: Request, background: BackgroundTasks,
                          email: str = Form(max_length=320), password: str = Form(max_length=256),
                          confirmation: str = Form(max_length=6), lang: Language = Form(default="ru"),
                          db: AsyncSession = Depends(get_db)):
    # Password-only re-authentication uses no ambient cookies, so a third-party
    # form cannot act on a signed-in browser session. Target IDs are never accepted.
    from fastapi import HTTPException
    try:
        await consume_limit(db, "web-delete:ip", request.client.host if request.client else "unknown", 20, 900)
        await consume_limit(db, "web-delete:account", email.strip().lower(), 5, 900)
    except HTTPException:
        return page("deletion", lang, CONTENT[lang]["limited"], 429)
    user = (await db.execute(select(User).where(User.email == email.strip().lower()).with_for_update())).scalar_one_or_none()
    valid = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid or user.role not in ("coach", "client") or confirmation != "DELETE":
        return page("deletion", lang, CONTENT[lang]["invalid"], 400)
    await erase_account(user, db)
    background.add_task(cleanup_erased_accounts)
    return page("deletion", lang, CONTENT[lang]["deleted"])
