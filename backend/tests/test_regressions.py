r"""Offline regressions: real ORM queries against an isolated in-memory database.

Run: .venv\Scripts\python.exe -m unittest discover -s tests -v
No production database, email, or cloud service is contacted.
"""
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from unittest.mock import patch, Mock, AsyncMock
from contextlib import asynccontextmanager

# Override deployment configuration before importing the application.
os.environ.update({
    "ENVIRONMENT": "development", "SECRET_KEY": "regression-tests-only-" + "x" * 48,
    "DATABASE_URL": "postgresql+asyncpg://test:test@127.0.0.1:1/test",
    "STORAGE_PROVIDER": "local", "AUTO_CREATE_TABLES": "false",
    "SMTP_USE_TLS": "true", "SMTP_USE_SSL": "false", "APP_PUBLIC_URL": "",
    "ALLOW_DEV_SUBSCRIPTION_ACTIVATION": "false",
})

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models.user import User
from app.models.auth_session import AuthSession
import uuid
from app.models.profile import ClientProfile, CoachProfile
from app.models.message import Message
from app.models.subscription import Subscription
from app.models.password_reset_token import PasswordResetToken
from app.models.progress import ProgressEntry
from app.core.security import (
    create_access_token, create_refresh_token, create_media_token, decode_token,
    hash_password, token_matches_password, _create_token,
)
from app.routers import auth, messages, uploads
from app.services.media_access import media_reference, validate_message_media


class AsyncSessionAdapter:
    """Use the actual SQLAlchemy statements without an extra async SQLite dependency."""
    def __init__(self, session):
        self.session = session

    def get_bind(self): return self.session.get_bind()
    def add(self, obj): self.session.add(obj)
    async def execute(self, statement): return self.session.execute(statement)
    async def commit(self): self.session.commit()
    async def rollback(self): self.session.rollback()
    async def flush(self): self.session.flush()
    async def refresh(self, obj): self.session.refresh(obj)
    async def delete(self, obj): self.session.delete(obj)


class RegressionTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = hash_password("Original123!")

    async def asyncSetUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine, expire_on_commit=False, autoflush=False)
        self.db = AsyncSessionAdapter(self.session)
        self.client = User(id="u_client", email="client@example.com", name="Client", role="client",
                           password_hash=self.password_hash, email_verified=True)
        self.coach = User(id="u_coach", email="coach@example.com", name="Coach", role="coach",
                          password_hash=self.password_hash, email_verified=True)
        self.stranger = User(id="u_stranger", email="stranger@example.com", name="Stranger", role="client",
                             password_hash=self.password_hash, email_verified=True)
        self.session.add_all([self.client, self.coach, self.stranger])
        self.session.flush()
        self.profile = ClientProfile(user_id=self.client.id, coach_id=self.coach.id, start_weight=90, current_weight=90)
        self.session.add_all([self.profile, CoachProfile(user_id=self.coach.id)])
        self.session.commit()
        async def test_db():
            yield self.db
        app.dependency_overrides[get_db] = test_db

    async def asyncTearDown(self):
        app.dependency_overrides.clear()
        self.session.close()
        self.engine.dispose()

    def token(self, user=None):
        user = user or self.client
        sid = uuid.uuid4().hex
        self.session.add(AuthSession(id=sid, user_id=user.id, refresh_hash=sid,
                                    expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
        self.session.commit()
        return create_access_token(user.id, user.password_hash, sid)

    async def request(self, method, url, body=None, token=None):
        parsed = urlsplit(url)
        headers = [(b"content-type", b"application/json")]
        if token: headers.append((b"authorization", f"Bearer {token}".encode()))
        scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"}, "http_version": "1.1",
                 "method": method, "scheme": "http", "path": parsed.path, "raw_path": parsed.path.encode(),
                 "query_string": parsed.query.encode(), "root_path": "", "headers": headers,
                 "client": ("127.0.0.1", 1234), "server": ("test", 80)}
        sent = []
        delivered = False
        async def receive():
            nonlocal delivered
            if delivered: return {"type": "http.disconnect"}
            delivered = True
            return {"type": "http.request", "body": json.dumps(body).encode() if body is not None else b"", "more_body": False}
        async def send(message): sent.append(message)
        await app(scope, receive, send)
        start = next(m for m in sent if m["type"] == "http.response.start")
        data = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
        try: data = json.loads(data)
        except (ValueError, TypeError): pass
        return start["status"], data

    async def test_verified_email_cannot_issue_tokens_for_arbitrary_code(self):
        status, data = await self.request("POST", "/api/v1/auth/verify-email", {"email": self.client.email, "password": "Original123!", "code": "000000"})
        self.assertEqual(status, 400)
        self.assertNotIn("token", data)

    async def test_registration_email_failure_leaves_account_pending_and_can_be_retried(self):
        from app.services.email_service import EmailDeliveryError
        body = {"name": "Pending", "email": "pending@example.com", "password": "Original123!", "role": "coach"}
        with patch.object(auth, "send_email_verification_code", AsyncMock(side_effect=EmailDeliveryError("delivery failed"))):
            status, data = await self.request("POST", "/api/v1/auth/register", body)
        self.assertEqual(status, 503)
        user = self.session.scalar(select(User).where(User.email == body["email"]))
        self.assertIsNotNone(user)
        self.assertFalse(user.email_verified)
        status, _ = await self.request("POST", "/api/v1/auth/login", {"email": body["email"], "password": body["password"]})
        self.assertEqual(status, 403)
        user.email_verification_sent_at = datetime.now(timezone.utc) - timedelta(minutes=2)
        self.session.commit()
        with patch.object(auth, "send_email_verification_code", AsyncMock()) as sender:
            status, data = await self.request("POST", "/api/v1/auth/resend-verification-code", {"email": body["email"]})
        self.assertEqual(status, 200)
        sender.assert_awaited_once()
        delivered_code = sender.call_args.kwargs["code"]
        status, _ = await self.request("POST", "/api/v1/auth/verify-email", {"email": body["email"], "password": "Original123!", "code": delivered_code})
        self.assertEqual(status, 200)

    async def test_correct_email_code_is_single_use(self):
        self.client.email_verified = False
        self.client.email_verification_code_hash = auth.hash_email_verification_code("123456")
        self.client.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        self.session.commit()
        body = {"email": self.client.email, "password": "Original123!", "code": "123456"}
        status, data = await self.request("POST", "/api/v1/auth/verify-email", body)
        self.assertEqual(status, 200)
        self.assertTrue(token_matches_password(data["token"], self.client.password_hash))
        status, _ = await self.request("POST", "/api/v1/auth/verify-email", body)
        self.assertEqual(status, 400)

    async def test_validator_error_returns_422_without_password(self):
        body = {"name": "Test", "email": "test@example.com", "password": "123", "role": "client"}
        status, data = await self.request("POST", "/api/v1/auth/register", body)
        self.assertEqual(status, 422)
        self.assertEqual(data["errors"][0]["loc"], ["body", "password"])
        self.assertNotIn("input", data["errors"][0])
        self.assertNotIn("ctx", data["errors"][0])

    async def test_password_reset_revokes_access_refresh_and_websocket_auth(self):
        access = self.token()
        refresh = create_refresh_token(self.client.id, self.client.password_hash)
        raw = "reset-test-token"
        self.session.add(PasswordResetToken(id="prt_test", user_id=self.client.id, token_hash=auth.hash_reset_token(raw),
                                           created_at=datetime.now(timezone.utc),
                                           expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)))
        self.session.commit()
        status, _ = await self.request("POST", "/api/v1/auth/reset-password", {"token": raw, "new_password": "Changed123!"})
        self.assertEqual(status, 200)
        self.assertFalse(token_matches_password(access, self.client.password_hash))
        self.assertIsNone(await messages._get_user_by_token(access, self.db))
        status, _ = await self.request("GET", "/api/v1/auth/me", token=access)
        self.assertEqual(status, 401)
        status, _ = await self.request("POST", "/api/v1/auth/refresh", {"refresh_token": refresh})
        self.assertEqual(status, 401)

    async def test_refresh_returns_working_session(self):
        issued = await auth.build_auth_response(self.client, self.db)
        refresh = issued.refresh_token
        status, data = await self.request("POST", "/api/v1/auth/refresh", {"refresh_token": refresh})
        self.assertEqual(status, 200)
        status, _ = await self.request("GET", "/api/v1/auth/me", token=data["token"])
        self.assertEqual(status, 200)

    async def test_legacy_token_cannot_bypass_password_session_binding(self):
        import jwt
        from app.core.security import settings
        payload = jwt.decode(self.token(), options={"verify_signature": False})
        payload.pop("session")
        legacy = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        status, _ = await self.request("GET", "/api/v1/auth/me", token=legacy)
        self.assertEqual(status, 401)

    async def test_backdated_weight_does_not_replace_latest_and_delete_recalculates(self):
        token = self.token()
        status, latest = await self.request("POST", "/api/v1/progress", {"weight": 80, "date": "2026-10-27"}, token)
        self.assertEqual(status, 201)
        status, older = await self.request("POST", "/api/v1/progress", {"weight": 85, "date": "2026-10-20"}, token)
        self.assertEqual(status, 201)
        self.assertEqual(self.profile.current_weight, 80)
        status, _ = await self.request("DELETE", f"/api/v1/progress/{latest['id']}", token=token)
        self.assertEqual(status, 204)
        self.assertEqual(self.profile.current_weight, 85)
        await self.request("DELETE", f"/api/v1/progress/{older['id']}", token=token)
        self.assertEqual(self.profile.current_weight, 90)

    async def test_multiple_weights_same_day_preserve_history_and_use_latest(self):
        for weight in (80, 79):
            status, _ = await self.request("POST", "/api/v1/progress", {"weight": weight, "date": "2026-10-27"}, self.token())
            self.assertEqual(status, 201)
        self.assertEqual(len(self.session.scalars(select(ProgressEntry)).all()), 2)
        self.assertEqual(self.profile.current_weight, 79)
        status, data = await self.request("GET", "/api/v1/progress", token=self.token())
        self.assertEqual(status, 200)
        self.assertEqual([entry["weight"] for entry in data], [79, 80])
        self.assertTrue(data[0]["createdAt"])
        await self.request("DELETE", f"/api/v1/progress/{data[0]['id']}", token=self.token())
        self.assertEqual(self.profile.current_weight, 80)

    async def test_iso_weight_date_is_normalized_and_invalid_date_is_rejected(self):
        status, data = await self.request("POST", "/api/v1/progress", {"weight": 80, "date": "2026-10-27T10:00:00Z"}, self.token())
        self.assertEqual(status, 201)
        self.assertEqual(data["date"], "2026-10-27")
        status, _ = await self.request("POST", "/api/v1/progress", {"weight": 80, "date": "garbage"}, self.token())
        self.assertEqual(status, 422)

    async def test_expired_trial_cannot_be_reactivated_or_reset_by_plan_change(self):
        token = self.token(self.coach)
        status, _ = await self.request("POST", "/api/v1/subscriptions/me/activate", {"plan_code": "free"}, token)
        self.assertEqual(status, 200)
        self.assertIsNotNone(self.coach.trial_started_at)
        # Repeating an active trial is idempotent.
        status, _ = await self.request("POST", "/api/v1/subscriptions/me/activate", {"plan_code": "free"}, token)
        self.assertEqual(status, 200)
        sub = self.session.scalar(select(Subscription))
        sub.end_date = datetime.now(timezone.utc) - timedelta(days=1)
        self.session.commit()
        for plan in ("starter", "free"):
            await self.request("PATCH", "/api/v1/subscriptions/me", {"plan_code": plan}, token)
        status, _ = await self.request("POST", "/api/v1/subscriptions/me/activate", {"plan_code": "free"}, token)
        self.assertEqual(status, 403)

    async def test_direct_media_link_requires_file_scoped_token(self):
        status, _ = await self.request("GET", "/api/v1/uploads/images/u_client_photo.jpg")
        self.assertEqual(status, 401)

    async def test_sending_voice_photo_and_video_keeps_protected_media_references(self):
        for kind, fields, expected_field in (
            ("voice", {"voice_url": "/api/v1/uploads/voice/u_client_audio.m4a", "voice_duration_ms": 1000}, "voiceUrl"),
            ("image", {"media_url": "/api/v1/uploads/images/u_client_photo.jpg", "media_type": "image"}, "mediaUrl"),
            ("video", {"media_url": "/api/v1/uploads/videos/u_client_video.mp4", "media_type": "video",
                       "media_thumbnail_url": "/api/v1/uploads/video-thumbnails/u_client_thumb.jpg"}, "mediaUrl"),
        ):
            status, data = await self.request("POST", "/api/v1/messages", {
                "receiver_id": self.coach.id, "message_type": kind, "content": kind, **fields,
            }, self.token())
            self.assertEqual(status, 201, data)
            self.assertTrue(data[expected_field].startswith("/api/v1/uploads/"))
        status, _ = await self.request("POST", "/api/v1/messages", {
            "receiver_id": self.coach.id, "message_type": "image", "content": "stolen",
            "media_url": "/api/v1/uploads/images/u_stranger_private.jpg", "media_type": "image",
        }, self.token())
        self.assertEqual(status, 403)

    async def test_media_is_available_to_owner_and_participant_but_not_stranger(self):
        url = "/api/v1/uploads/images/u_client_photo.jpg"
        self.session.add(Message(id="msg_photo", sender_id=self.client.id, receiver_id=self.coach.id,
                                 content="Photo", message_type="image", media_type="image", media_url=url))
        self.session.commit()
        for user in (self.client, self.coach):
            status, data = await self.request("GET", "/api/v1/uploads/access?" + urlencode({"url": url}), token=self.token(user))
            self.assertEqual(status, 200)
            with tempfile.TemporaryDirectory() as tmp:
                Path(tmp, "u_client_photo.jpg").write_bytes(b"test-image")
                with patch.object(uploads, "IMAGE_DIR", Path(tmp)):
                    status, body = await self.request("GET", data["url"])
                self.assertEqual(status, 200)
                self.assertEqual(body, b"test-image")
        status, _ = await self.request("GET", "/api/v1/uploads/access?" + urlencode({"url": url}), token=self.token(self.stranger))
        self.assertEqual(status, 403)
        with self.assertRaises(HTTPException):
            await validate_message_media(url, "images", self.stranger, self.db)

    async def test_media_token_cannot_read_another_file_and_expires(self):
        token = create_media_token(self.client.id, self.client.password_hash, "images/u_client_one.jpg")
        status, _ = await self.request("GET", "/api/v1/uploads/images/u_client_two.jpg?media_token=" + token)
        self.assertEqual(status, 401)
        expired = _create_token(user_id=self.client.id, token_type="media", password_hash=self.client.password_hash,
                                resource="images/u_client_one.jpg", expires_delta=timedelta(seconds=-1))
        status, _ = await self.request("GET", "/api/v1/uploads/images/u_client_one.jpg?media_token=" + expired)
        self.assertEqual(status, 401)

    async def test_media_access_revoked_after_message_deletion_and_password_reset(self):
        url = "/api/v1/uploads/voice/u_client_audio.m4a"
        message = Message(id="msg_voice", sender_id=self.client.id, receiver_id=self.coach.id,
                          content="Voice", message_type="voice", voice_url=url)
        self.session.add(message)
        self.session.commit()
        status, data = await self.request("GET", "/api/v1/uploads/access?" + urlencode({"url": url}), token=self.token(self.coach))
        self.assertEqual(status, 200)
        message.deleted_for_receiver = True
        self.session.commit()
        status, _ = await self.request("GET", data["url"])
        self.assertEqual(status, 403)
        token = create_media_token(self.client.id, self.client.password_hash, "voice/u_client_audio.m4a")
        self.client.password_hash = "changed-hash"
        self.session.commit()
        status, _ = await self.request("GET", url + "?media_token=" + token)
        self.assertEqual(status, 401)

    async def test_cloud_links_map_only_configured_storage_and_safe_names(self):
        from app.core.config import get_settings
        with patch.object(get_settings(), "GCS_PUBLIC_BASE_URL", "https://storage.example/bucket"):
            self.assertEqual(media_reference("https://storage.example/bucket/images/u_client_photo.jpg"), ("images", "u_client_photo.jpg"))
        for url in ("https://evil.example/photo.jpg", "/api/v1/uploads/images/../secret", "/api/v1/uploads/images/%2e%2e%2fsecret"):
            with self.assertRaises(HTTPException): media_reference(url)

    async def test_cloud_chat_streams_through_api_and_public_avatars_use_signed_redirects(self):
        from app.services.storage_service import MediaDownload
        storage = Mock()
        storage.signed_read_url.return_value = "https://private.example/object?signed=short-lived"
        storage.open_media.return_value = MediaDownload(iter([b"private-image"]), "image/jpeg", 13)
        status, data = await self.request("GET", "/api/v1/uploads/access?" + urlencode({
            "url": "/api/v1/uploads/images/u_client_photo.jpg"}), token=self.token())
        self.assertEqual(status, 200)
        with patch.object(uploads.settings, "STORAGE_PROVIDER", "s3"), \
             patch.object(uploads, "get_storage_service", return_value=storage), \
             patch.object(uploads, "ensure_upload_dirs"):
            status, _ = await self.request("GET", data["url"])
            self.assertEqual(status, 200)
            storage.open_media.assert_called_with("images/u_client_photo.jpg", None)
            status, _ = await self.request("GET", "/api/v1/uploads/avatars/u_client_avatar.jpg")
            self.assertEqual(status, 307)
            storage.signed_read_url.assert_called_with("avatars/u_client_avatar.jpg")

    async def test_cloud_byte_ranges_support_seeking_and_reject_invalid_ranges(self):
        from app.services.storage_service import byte_range
        self.assertEqual(byte_range(None, 100), (0, 99, False))
        self.assertEqual(byte_range("bytes=10-19", 100), (10, 19, True))
        self.assertEqual(byte_range("bytes=95-200", 100), (95, 99, True))
        self.assertEqual(byte_range("bytes=-10", 100), (90, 99, True))
        self.assertEqual(byte_range("bytes=10-", 100), (10, 99, True))
        for value in ("bytes=200-", "bytes=-0", "bytes=10-1", "bytes=0-1,4-5", "invalid"):
            with self.assertRaises(ValueError): byte_range(value, 100)

    async def test_s3_streaming_preserves_range_and_closes_object_body(self):
        from types import SimpleNamespace
        from app.services.storage_service import StorageService
        storage = object.__new__(StorageService)
        storage.settings = SimpleNamespace(uses_s3_storage=True, uses_gcs_storage=False, STORAGE_BUCKET_NAME="private")
        storage._s3_client = Mock()
        storage._s3_client.head_object.return_value = {"ContentLength": 10, "ContentType": "video/mp4"}
        body = Mock()
        body.iter_chunks.return_value = iter([b"3456"])
        storage._s3_client.get_object.return_value = {"Body": body}
        result = storage.open_media("videos/file.mp4", "bytes=3-6")
        self.assertEqual(result.content_range, "bytes 3-6/10")
        self.assertEqual(result.size_bytes, 4)
        self.assertEqual(b"".join(result.chunks), b"3456")
        body.close.assert_called_once()
        storage._s3_client.get_object.assert_called_once_with(Bucket="private", Key="videos/file.mp4", Range="bytes=3-6")

    async def test_gcs_streaming_limits_read_to_requested_range_and_closes_reader(self):
        import io
        from types import SimpleNamespace
        from app.services.storage_service import StorageService
        storage = object.__new__(StorageService)
        storage.settings = SimpleNamespace(uses_s3_storage=False, uses_gcs_storage=True)
        storage._gcs_bucket = Mock()
        blob = Mock(size=10, content_type="video/mp4")
        reader = io.BytesIO(b"0123456789")
        blob.open.return_value = reader
        storage._gcs_bucket.blob.return_value = blob
        result = storage.open_media("videos/file.mp4", "bytes=3-6")
        self.assertEqual(b"".join(result.chunks), b"3456")
        self.assertEqual(result.size_bytes, 4)
        self.assertEqual(result.content_range, "bytes 3-6/10")
        self.assertTrue(reader.closed)

    async def test_websocket_broadcast_does_not_deliver_after_password_change(self):
        manager = messages.WebSocketConnectionManager()
        websocket = Mock()
        websocket.accept = AsyncMock()
        websocket.close = AsyncMock()
        websocket.send_json = AsyncMock()
        await manager.connect(self.client.id, websocket, self.token())
        @asynccontextmanager
        async def test_session():
            yield self.db
        with patch.object(messages, "AsyncSessionLocal", test_session):
            await manager.send_to_user(self.client.id, {"type": "test"})
            websocket.send_json.assert_awaited_once()
            websocket.send_json.reset_mock()
            self.client.password_hash = "new-password-hash"
            self.session.commit()
            await manager.send_to_user(self.client.id, {"type": "secret"})
            websocket.send_json.assert_not_awaited()
            websocket.close.assert_awaited_once_with(code=1008)
            self.assertNotIn(self.client.id, manager.active_connections)

    async def test_pending_registration_cannot_replace_password_or_send_more_mail(self):
        body = {"name": "Pending", "email": "pending@example.com", "password": "Original123!", "role": "coach"}
        with patch.object(auth, "send_email_verification_code", AsyncMock()) as sender:
            self.assertEqual((await self.request("POST", "/api/v1/auth/register", body))[0], 201)
            body.update(password="Attacker456!", name="Changed")
            self.assertEqual((await self.request("POST", "/api/v1/auth/register", body))[0], 201)
        self.assertEqual(sender.await_count, 1)
        user = self.session.scalar(select(User).where(User.email == body["email"]))
        from app.core.security import verify_password
        self.assertTrue(verify_password("Original123!", user.password_hash))
        self.assertFalse(verify_password("Attacker456!", user.password_hash))
        self.assertEqual(user.name, "Pending")

    async def test_verification_attempts_are_limited_even_with_new_dependency_calls(self):
        self.client.email_verified = False
        raw = auth.attach_new_email_verification_code(self.client)
        wrong = "000000" if raw != "000000" else "999999"
        self.session.commit()
        statuses = []
        for _ in range(11):
            status, _ = await self.request("POST", "/api/v1/auth/verify-email", {"email": self.client.email, "password": "Original123!", "code": wrong})
            statuses.append(status)
        self.assertEqual(statuses[-1], 429)
        self.assertNotIn(200, statuses)

    async def test_unrelated_clients_cannot_send_messages(self):
        status, _ = await self.request("POST", "/api/v1/messages", {
            "receiver_id": self.stranger.id, "message_type": "text", "content": "unwanted",
        }, self.token())
        self.assertEqual(status, 403)
        self.assertEqual(self.session.scalar(select(Message.id)), None)

    async def test_long_passwords_do_not_share_bcrypt_prefix(self):
        from app.core.security import verify_password, pwd_context
        first, second = "A" * 72 + "a1!first", "A" * 72 + "b2@other"
        hashed = hash_password(first)
        self.assertTrue(verify_password(first, hashed))
        self.assertFalse(verify_password(second, hashed))
        legacy = pwd_context.hash("Legacy123!", scheme="bcrypt")
        self.assertTrue(verify_password("Legacy123!", legacy))
        ambiguous = pwd_context.hash(first, scheme="bcrypt")
        self.assertFalse(verify_password(second, ambiguous))

    async def test_email_owner_chooses_password_when_confirming_pending_account(self):
        self.client.email_verified = False
        code = auth.attach_new_email_verification_code(self.client)
        self.session.commit()
        status, _ = await self.request("POST", "/api/v1/auth/verify-email", {
            "email": self.client.email, "code": code, "password": "OwnerChosen456!",
        })
        self.assertEqual(status, 200)
        from app.core.security import verify_password
        self.assertTrue(verify_password("OwnerChosen456!", self.client.password_hash))
        self.assertFalse(verify_password("Original123!", self.client.password_hash))

    async def test_refresh_rotation_prevents_replay_and_logout_revokes_session(self):
        issued = await auth.build_auth_response(self.client, self.db)
        status, rotated = await self.request("POST", "/api/v1/auth/refresh", {"refresh_token": issued.refresh_token})
        self.assertEqual(status, 200)
        status, _ = await self.request("POST", "/api/v1/auth/refresh", {"refresh_token": issued.refresh_token})
        self.assertEqual(status, 401)
        # A logout captured before rotation must still revoke that same session.
        status, _ = await self.request("POST", "/api/v1/auth/logout", {"refresh_token": issued.refresh_token})
        self.assertEqual(status, 204)
        self.assertEqual((await self.request("GET", "/api/v1/auth/me", token=rotated["token"]))[0], 401)
        self.assertIsNone(await messages._get_user_by_token(rotated["token"], self.db))
        self.assertEqual((await self.request("POST", "/api/v1/auth/refresh", {"refresh_token": rotated["refresh_token"]}))[0], 401)

    async def test_purchase_claim_cannot_move_to_another_account(self):
        from app.services.purchase_claims import claim_purchase
        await claim_purchase(self.db, "test-receipt-hash", self.coach.id)
        await self.db.commit()
        await claim_purchase(self.db, "test-receipt-hash", self.coach.id)
        with self.assertRaises(HTTPException) as failure:
            await claim_purchase(self.db, "test-receipt-hash", self.stranger.id)
        self.assertEqual(failure.exception.status_code, 409)

    async def test_logout_revokes_existing_private_file_link(self):
        issued = await auth.build_auth_response(self.client, self.db)
        url = "/api/v1/uploads/images/u_client_logout.jpg"
        status, data = await self.request("GET", "/api/v1/uploads/access?" + urlencode({"url": url}), token=issued.token)
        self.assertEqual(status, 200)
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "u_client_logout.jpg").write_bytes(b"private")
            with patch.object(uploads, "IMAGE_DIR", Path(tmp)):
                self.assertEqual((await self.request("GET", data["url"]))[0], 200)
                self.assertEqual((await self.request("POST", "/api/v1/auth/logout", {"refresh_token": issued.refresh_token}))[0], 204)
                self.assertEqual((await self.request("GET", data["url"]))[0], 401)

    async def test_image_processing_reencodes_and_limits_dimensions(self):
        from io import BytesIO
        from PIL import Image
        buffer = BytesIO()
        Image.new("RGB", (100, 50), "red").save(buffer, format="PNG")
        name, content = uploads.prepare_jpeg_image(content=buffer.getvalue(), filename_prefix="u_client",
                                                  max_size=(20, 20), quality=80)
        self.assertTrue(name.startswith("u_client_"))
        with Image.open(BytesIO(content)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (20, 10))
        oversized = Mock(width=10000, height=10000)
        with patch.object(uploads.Image, "open", return_value=oversized):
            with self.assertRaises(HTTPException) as failure:
                uploads.prepare_jpeg_image(content=b"mock", filename_prefix="u_client", max_size=(20, 20), quality=80)
        self.assertEqual(failure.exception.status_code, 400)
        oversized.verify.assert_not_called()

    async def test_reset_recipient_restriction_is_reported_safely(self):
        from app.services.email_service import EmailRecipientRestrictionError
        with patch.object(auth, "send_password_reset_email", AsyncMock(side_effect=EmailRecipientRestrictionError("test sender"))):
            status, body = await self.request("POST", "/api/v1/auth/forgot-password", {"email": self.client.email})
        self.assertEqual(status, 503)
        self.assertEqual(body["detail"], "Email test sender is restricted to the account owner")

    async def test_new_database_bootstrap_refuses_existing_tables(self):
        from app.db.bootstrap import initialize
        from sqlalchemy import inspect
        empty = create_engine("sqlite://")
        try:
            with empty.begin() as connection:
                initialize(connection)
                self.assertIn("auth_sessions", inspect(connection).get_table_names())
                self.assertEqual(connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one(), "c62026110401")
                with self.assertRaises(RuntimeError):
                    initialize(connection)
        finally:
            empty.dispose()

    async def test_upgrade_generates_postgres_sql_without_database_connection(self):
        import io
        from alembic import command
        from alembic.config import Config
        output = io.StringIO()
        config = Config("alembic.ini", output_buffer=output)
        command.upgrade(config, "b88ee1c91032:head", sql=True)
        sql = output.getvalue()
        self.assertIn("ADD COLUMN trial_started_at", sql)
        self.assertIn("ADD COLUMN created_at", sql)
        self.assertIn("c62026102701", sql)


if __name__ == "__main__":
    unittest.main()
