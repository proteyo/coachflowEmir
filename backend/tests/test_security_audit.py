"""Adversarial checks use an isolated database and never contact production."""
import json
import logging
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch

from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect
import test_regressions as base
from app.main import app
from app.models.subscription import Subscription
from app.routers import messages
from app.services.media_access import owned_avatar_url


class SecurityAuditTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = base.RegressionTests.asyncSetUp
    asyncTearDown = base.RegressionTests.asyncTearDown
    request = base.RegressionTests.request
    token = base.RegressionTests.token
    setUpClass = classmethod(base.RegressionTests.setUpClass.__func__)

    async def raw_request(self, path, chunks, headers=()):
        scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
                 "http_version": "1.1", "method": "POST", "scheme": "http", "path": path,
                 "raw_path": path.encode(), "query_string": b"", "root_path": "", "headers": list(headers),
                 "client": ("127.0.0.1", 1234), "server": ("test", 80)}
        pending = iter(chunks)
        sent = []
        reads = 0
        async def receive():
            nonlocal reads
            reads += 1
            return next(pending, {"type": "http.disconnect"})
        async def send(message): sent.append(message)
        await app(scope, receive, send)
        status = next(m["status"] for m in sent if m["type"] == "http.response.start")
        return status, sent, reads

    async def test_oversized_declared_body_is_rejected_before_reading(self):
        status, _, reads = await self.raw_request("/api/v1/auth/login", [], [(b"content-length", b"999999999")])
        self.assertEqual(status, 413)
        self.assertEqual(reads, 0)

    async def test_chunked_body_limit_cannot_be_bypassed_by_missing_or_false_length(self):
        for headers in [[], [(b"content-length", b"2")]]:
            status, _, reads = await self.raw_request("/api/v1/auth/login", [
                {"type": "http.request", "body": b" " * 600_000, "more_body": True},
                {"type": "http.request", "body": b" " * 600_000, "more_body": False},
            ], [(b"content-type", b"application/json"), *headers])
            self.assertEqual(status, 413)
            self.assertEqual(reads, 2)

    async def test_anonymous_multipart_rejected_before_spooling(self):
        for authorization in [b"", b"Bearer invalid", b"Bearer " + self.token().encode()[:-3] + b"bad"]:
            status, _, reads = await self.raw_request("/api/v1/uploads/video", [], [
                (b"authorization", authorization), (b"content-type", b"multipart/form-data; boundary=demo")])
            self.assertEqual(status, 401)
            self.assertEqual(reads, 0)

    async def test_malformed_json_is_a_client_error(self):
        status, _, _ = await self.raw_request("/api/v1/auth/login", [
            {"type": "http.request", "body": b"{not-json", "more_body": False}],
            [(b"content-type", b"application/json")])
        self.assertIn(status, (400, 422))

    async def test_private_api_responses_are_not_cacheable(self):
        status, _ = await self.request("GET", "/api/v1/users/me", token=self.token())
        self.assertEqual(status, 200)
        from app.core.http_security import HttpSecurityMiddleware
        sent = []
        async def endpoint(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"{}"})
        async def receive(): return {"type": "http.disconnect"}
        async def send(message): sent.append(message)
        await HttpSecurityMiddleware(endpoint)({"type": "http", "method": "GET", "path": "/api/v1/users/me", "headers": []}, receive, send)
        headers = dict(sent[0]["headers"])
        self.assertEqual(headers[b"cache-control"], b"no-store")
        self.assertEqual(headers[b"referrer-policy"], b"no-referrer")

    async def test_profile_cannot_publish_external_tracking_or_other_owners_images(self):
        token = self.token()
        for url in ["https://attacker.example/pixel.jpg", "file:///private/secret", "javascript:alert(1)",
                    "/api/v1/uploads/avatars/u_coach_0123456789abcdef.jpg"]:
            status, _ = await self.request("PATCH", "/api/v1/users/me", {"avatar_url": url}, token)
            self.assertEqual(status, 400)
        owned = "/api/v1/uploads/avatars/u_client_0123456789abcdef.jpg"
        status, data = await self.request("PATCH", "/api/v1/users/me", {"avatar_url": owned}, token)
        self.assertEqual(status, 200, data)
        self.assertEqual(data["avatarUrl"], owned)
        self.assertIsNone(owned_avatar_url("", self.client.id))

    async def test_profile_bounds_and_mass_assignment(self):
        token = self.token()
        for body in [{"name": "x" * 121}, {"phone": "1" * 41}, {"role": "coach"},
                     {"email_verified": True}, {"password_hash": "forged"}]:
            status, _ = await self.request("PATCH", "/api/v1/users/me", body, token)
            self.assertEqual(status, 422)
        self.assertEqual(self.client.role, "client")

    async def test_client_discovery_is_rate_limited_before_lookup(self):
        self.session.add(Subscription(coach_id=self.coach.id, plan_name="pro", status="active",
            start_date=datetime.now(timezone.utc), end_date=datetime.now(timezone.utc) + timedelta(days=30)))
        self.session.commit()
        token = self.token(self.coach)
        import time
        with patch("app.core.rate_limit.time.time", return_value=time.time() + 120):
            for index in range(10):
                status, _ = await self.request("POST", "/api/v1/clients/link", {"client_code": "NOTFOUND"}, token)
                self.assertEqual(status, 404)
            status, _ = await self.request("POST", "/api/v1/clients/invite", {"email": "unknown@example.com"}, token)
        self.assertEqual(status, 429)

    async def socket_with(self, payload, deny_after_connect=False):
        socket = AsyncMock()
        socket.receive_text = AsyncMock(side_effect=[payload, WebSocketDisconnect()])
        guard = AsyncMock(side_effect=[None, HTTPException(403, "Access revoked")] if deny_after_connect else None)
        with patch.object(messages, "_get_user_by_token", AsyncMock(return_value=self.client)), \
             patch.object(messages, "_ensure_user_exists", AsyncMock(return_value=self.coach)), \
             patch.object(messages, "_ensure_chat_relationship", guard), \
             patch.object(messages, "update_user_last_seen", AsyncMock()), \
             patch.object(messages, "_mark_conversation_as_read", AsyncMock(return_value=0)) as mark, \
             patch.object(messages, "_get_conversation_messages", AsyncMock(return_value=[])):
            await messages.messages_ws(socket, self.coach.id, "test", self.db)
        self.assertNotIn(socket, messages.ws_manager.connection_tokens)
        return socket, mark

    async def test_open_socket_rechecks_permissions_before_reading(self):
        socket, mark = await self.socket_with(json.dumps({"type": "read"}), True)
        socket.close.assert_awaited_with(code=1008)
        self.assertEqual(mark.await_count, 1)  # Initial authorized snapshot only.

    async def test_socket_rejects_large_frames_and_non_object_json(self):
        socket, _ = await self.socket_with("x" * 16_385)
        socket.close.assert_awaited_with(code=1009)
        socket, _ = await self.socket_with("[]")
        self.assertTrue(any(call.args[0].get("message") == "Expected a JSON object" for call in socket.send_json.call_args_list))

    async def test_access_and_websocket_logs_do_not_contain_query_tokens(self):
        from app.core.log_safety import RedactQueryCredentials
        for template, args in [
            ('%s - "%s %s HTTP/%s" %d', ("127.0.0.1", "GET", "/uploads/image.jpg?media_token=private-value", "1.1", 200)),
            ('%s - "WebSocket %s" [accepted]', (("127.0.0.1", 123), "/messages/ws?token=private-value&partner_id=someone")),
            ("Connection failed %s", ("URL /messages/ws?token=private-value",)),
        ]:
            record = logging.LogRecord("uvicorn.error", logging.INFO, "", 1, template, args, None)
            RedactQueryCredentials().filter(record)
            self.assertNotIn("private-value", record.getMessage())

    async def test_google_purchase_errors_never_log_the_purchase_token(self):
        from app.routers import subscriptions
        from googleapiclient.errors import HttpError
        error = HttpError(Mock(status=400, reason="Bad Request"), b'{"error":{"message":"Invalid receipt"}}',
                          uri="https://androidpublisher.googleapis.com/purchases/subscriptionsv2/tokens/private-receipt")
        with patch.object(subscriptions, "parse_google_service_account_json", return_value={}), \
             patch.object(subscriptions.logger, "disabled", False), \
             patch("google.oauth2.service_account.Credentials.from_service_account_info"), \
             patch("googleapiclient.discovery.build") as build, \
             self.assertLogs(subscriptions.logger, level="WARNING") as logged:
            build.return_value.purchases.return_value.subscriptionsv2.return_value.get.return_value.execute.side_effect = error
            with self.assertRaises(HTTPException) as raised:
                subscriptions.verify_google_play_subscription_sync(package_name="com.emirkamilov.coachflow",
                    product_id="pro_monthly", purchase_token="private-receipt")
            self.assertEqual(raised.exception.detail, "Google Play purchase verification failed.")
        self.assertEqual(raised.exception.status_code, 400)
        self.assertTrue(raised.exception.__suppress_context__)
        self.assertTrue(all(record.exc_info is None for record in logged.records))
        self.assertNotIn("private-receipt", " ".join(logged.output))
