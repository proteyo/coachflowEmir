"""Bound request parsing before it can allocate unbounded bodies or temp files."""
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.core.security import verify_token_payload

JSON_LIMIT = 1024 * 1024
UPLOAD_LIMITS = {"avatar": 10, "image": 10, "voice": 25, "video": 120, "video-thumbnail": 8}


class HttpSecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        headers = dict(scope.get("headers", []))
        upload = path.removeprefix("/api/v1/uploads/") if path.startswith("/api/v1/uploads/") else None
        is_upload = scope["method"] == "POST" and upload in UPLOAD_LIMITS
        limit = (UPLOAD_LIMITS[upload] * 1024 * 1024 + 64 * 1024) if is_upload else JSON_LIMIT

        async def reject(code, detail):
            await JSONResponse({"detail": detail}, status_code=code,
                               headers={"Cache-Control": "no-store"})(scope, receive, send)

        # FastAPI normally parses multipart files before resolving authentication.
        # Signature verification here prevents anonymous disk-spooling attacks;
        # the normal dependency still checks the user, session and permissions.
        if is_upload:
            auth = headers.get(b"authorization", b"").decode("latin-1").split()
            if len(auth) != 2 or auth[0].lower() != "bearer" or not verify_token_payload(auth[1]):
                return await reject(401, "Authentication required")
        length = headers.get(b"content-length")
        if length is not None:
            try:
                size = int(length)
            except ValueError:
                return await reject(400, "Invalid Content-Length")
            if size < 0:
                return await reject(400, "Invalid Content-Length")
            if size > limit:
                return await reject(413, "Request body is too large")

        total = 0
        async def bounded_receive():
            nonlocal total
            message = await receive()
            if message["type"] == "http.request":
                total += len(message.get("body", b""))
                if total > limit:
                    raise HTTPException(413, "Request body is too large")
            return message

        async def secure_send(message):
            if message["type"] == "http.response.start":
                response_headers = list(message.get("headers", []))
                names = {key.lower() for key, _ in response_headers}
                defaults = [(b"x-content-type-options", b"nosniff"), (b"referrer-policy", b"no-referrer")]
                if path.startswith("/api/"):
                    defaults.append((b"cache-control", b"no-store"))
                response_headers.extend((key, value) for key, value in defaults if key not in names)
                message = {**message, "headers": response_headers}
            await send(message)
        await self.app(scope, bounded_receive, secure_send)
