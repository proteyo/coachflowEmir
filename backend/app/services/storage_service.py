"""
Storage service for CoachFlow uploads.

This service supports three modes:

1. local
   - Current behavior.
   - Files are stored in backend/uploads.
   - Useful for development.

2. s3 / r2
   - Production-ready cloud storage.
   - Supports Amazon S3 and Cloudflare R2 through S3-compatible API.

3. gcs
   - Google Cloud Storage.
   - Uses native google-cloud-storage client.

Important:
- This file does not save local files.
- Local saving remains inside uploads.py.
"""

import json
import logging
from datetime import timedelta
import re
from collections.abc import Iterator
from dataclasses import dataclass

from app.core.config import get_settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UploadedFileResult:
    """
    Result returned after uploading a file to cloud storage.
    """

    key: str
    public_url: str
    content_type: str
    size_bytes: int


@dataclass(frozen=True)
class MediaDownload:
    chunks: Iterator[bytes]
    content_type: str
    size_bytes: int
    content_range: str | None = None


def byte_range(value: str | None, size: int) -> tuple[int, int, bool]:
    if not value:
        return 0, max(0, size - 1), False
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value.strip())
    if not match or not any(match.groups()) or size <= 0:
        raise ValueError("Invalid byte range")
    first, last = match.groups()
    if first:
        start = int(first)
        end = min(int(last), size - 1) if last else size - 1
    else:
        start, end = max(0, size - int(last)), size - 1
    if start > end or start >= size:
        raise ValueError("Unsatisfiable byte range")
    return start, end, True


class StorageService:
    """
    Universal storage service.

    Supported providers:
    - s3
    - r2
    - gcs
    """

    def __init__(self) -> None:
        self.settings = get_settings()

        self._s3_client = None
        self._gcs_client = None
        self._gcs_bucket = None

        if self.settings.uses_s3_storage:
            import boto3
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=self.settings.STORAGE_ENDPOINT_URL,
                aws_access_key_id=self.settings.STORAGE_ACCESS_KEY_ID,
                aws_secret_access_key=self.settings.STORAGE_SECRET_ACCESS_KEY,
                region_name=self.settings.STORAGE_REGION,
            )

        if self.settings.uses_gcs_storage:
            self._init_gcs_client()

    @property
    def is_cloud_enabled(self) -> bool:
        return self.settings.uses_cloud_storage

    def _init_gcs_client(self) -> None:
        """
        Initializes Google Cloud Storage client from service account JSON.
        """
        from google.cloud import storage
        from google.oauth2 import service_account

        if not self.settings.GCS_SERVICE_ACCOUNT_JSON:
            raise RuntimeError("GCS_SERVICE_ACCOUNT_JSON is not configured.")

        if not self.settings.GCS_BUCKET_NAME:
            raise RuntimeError("GCS_BUCKET_NAME is not configured.")

        try:
            service_account_info = json.loads(self.settings.GCS_SERVICE_ACCOUNT_JSON)

            credentials = service_account.Credentials.from_service_account_info(
                service_account_info,
            )

            self._gcs_client = storage.Client(
                credentials=credentials,
                project=service_account_info.get("project_id"),
            )

            self._gcs_bucket = self._gcs_client.bucket(
                self.settings.GCS_BUCKET_NAME,
            )

        except Exception as exc:
            logger.exception("Google Cloud Storage initialization failed")
            raise RuntimeError("Could not initialize Google Cloud Storage.") from exc

    def build_public_url(self, key: str) -> str:
        """
        Builds a public URL for an uploaded object.
        """

        clean_key = key.lstrip("/")

        if self.settings.uses_gcs_storage:
            if not self.settings.GCS_PUBLIC_BASE_URL:
                raise RuntimeError("GCS_PUBLIC_BASE_URL is not configured.")

            return f"{self.settings.GCS_PUBLIC_BASE_URL.rstrip('/')}/{clean_key}"

        if not self.settings.STORAGE_PUBLIC_BASE_URL:
            raise RuntimeError("STORAGE_PUBLIC_BASE_URL is not configured.")

        return f"{self.settings.STORAGE_PUBLIC_BASE_URL.rstrip('/')}/{clean_key}"

    def signed_read_url(self, key: str) -> str:
        """Short-lived object access; the bucket must disallow public reads."""
        if self.settings.uses_gcs_storage:
            return self._gcs_bucket.blob(key).generate_signed_url(
                version="v4", expiration=timedelta(seconds=60), method="GET",
            )
        if self.settings.uses_s3_storage:
            return self._s3_client.generate_presigned_url(
                "get_object", Params={"Bucket": self.settings.STORAGE_BUCKET_NAME, "Key": key},
                ExpiresIn=60,
            )
        raise RuntimeError("Cloud storage is not enabled")

    def open_media(self, key: str, requested_range: str | None = None) -> MediaDownload:
        """Stream private objects through the API, keeping Range requests authorized."""
        if self.settings.uses_s3_storage:
            bucket = self.settings.STORAGE_BUCKET_NAME
            metadata = self._s3_client.head_object(Bucket=bucket, Key=key)
            total = int(metadata["ContentLength"])
            start, end, partial = byte_range(requested_range, total)
            params = {"Range": f"bytes={start}-{end}"} if partial else {}
            result = self._s3_client.get_object(Bucket=bucket, Key=key, **params)
            body = result["Body"]
            def chunks():
                try:
                    yield from body.iter_chunks(chunk_size=1024 * 1024)
                finally:
                    body.close()
            content_type = metadata.get("ContentType") or "application/octet-stream"
        elif self.settings.uses_gcs_storage:
            blob = self._gcs_bucket.blob(key)
            blob.reload()
            total = int(blob.size)
            start, end, partial = byte_range(requested_range, total)
            reader = blob.open("rb")
            def chunks():
                try:
                    reader.seek(start)
                    remaining = end - start + 1 if total else 0
                    while remaining:
                        chunk = reader.read(min(remaining, 1024 * 1024))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
                finally:
                    reader.close()
            content_type = blob.content_type or "application/octet-stream"
        else:
            raise RuntimeError("Cloud storage is not enabled")
        return MediaDownload(
            chunks(), content_type, end - start + 1 if total else 0,
            f"bytes {start}-{end}/{total}" if partial else None,
        )

    def upload_bytes(
        self,
        *,
        content: bytes,
        key: str,
        content_type: str,
        cache_control: str | None = None,
    ) -> UploadedFileResult:
        """
        Uploads bytes to configured cloud storage.

        Raises RuntimeError if storage is not configured or upload fails.
        """

        if not self.is_cloud_enabled:
            raise RuntimeError("Cloud storage is not enabled.")

        if self.settings.uses_gcs_storage:
            return self._upload_bytes_to_gcs(
                content=content,
                key=key,
                content_type=content_type,
                cache_control=cache_control,
            )

        if self.settings.uses_s3_storage:
            return self._upload_bytes_to_s3(
                content=content,
                key=key,
                content_type=content_type,
                cache_control=cache_control,
            )

        raise RuntimeError("Unsupported storage provider.")

    def _upload_bytes_to_s3(
        self,
        *,
        content: bytes,
        key: str,
        content_type: str,
        cache_control: str | None,
    ) -> UploadedFileResult:
        """
        Uploads bytes to S3-compatible storage.
        """
        from botocore.exceptions import BotoCoreError, ClientError

        if self._s3_client is None:
            raise RuntimeError("S3 storage client is not initialized.")

        bucket_name = self.settings.STORAGE_BUCKET_NAME

        if not bucket_name:
            raise RuntimeError("STORAGE_BUCKET_NAME is not configured.")

        clean_key = key.lstrip("/")

        extra_args: dict[str, str] = {
            "ContentType": content_type,
        }

        if cache_control:
            extra_args["CacheControl"] = cache_control

        try:
            self._s3_client.put_object(
                Bucket=bucket_name,
                Key=clean_key,
                Body=content,
                **extra_args,
            )

        except (BotoCoreError, ClientError) as exc:
            logger.exception("S3-compatible storage upload failed")
            raise RuntimeError("Could not upload file to S3-compatible storage.") from exc

        return UploadedFileResult(
            key=clean_key,
            public_url=self.build_public_url(clean_key),
            content_type=content_type,
            size_bytes=len(content),
        )

    def _upload_bytes_to_gcs(
        self,
        *,
        content: bytes,
        key: str,
        content_type: str,
        cache_control: str | None,
    ) -> UploadedFileResult:
        """
        Uploads bytes to Google Cloud Storage.
        """

        if self._gcs_bucket is None:
            raise RuntimeError("Google Cloud Storage bucket is not initialized.")

        clean_key = key.lstrip("/")

        try:
            blob = self._gcs_bucket.blob(clean_key)
            blob.cache_control = cache_control

            blob.upload_from_string(
                content,
                content_type=content_type,
            )

        except Exception as exc:
            logger.exception("Google Cloud Storage upload failed")
            raise RuntimeError("Could not upload file to Google Cloud Storage.") from exc

        return UploadedFileResult(
            key=clean_key,
            public_url=self.build_public_url(clean_key),
            content_type=content_type,
            size_bytes=len(content),
        )


def get_storage_service() -> StorageService:
    return StorageService()


def delete_user_uploads(user_id: str) -> bool:
    """Only generated files under an authenticated owner's exact prefix.

    One pass is bounded; incomplete/cloud failures are retried by the persisted
    tombstone queue. This never removes directories or accepts caller paths.
    """
    from pathlib import Path
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", user_id):
        raise ValueError("Invalid owner")
    service = get_storage_service()
    prefixes = [("avatars", "STORAGE_AVATAR_PREFIX"), ("voice", "STORAGE_VOICE_PREFIX"),
                ("images", "STORAGE_IMAGE_PREFIX"), ("videos", "STORAGE_VIDEO_PREFIX"),
                ("video-thumbnails", "STORAGE_VIDEO_THUMBNAIL_PREFIX")]
    complete = True
    for folder, setting in prefixes:
        expected = user_id + ("_thumb_" if folder == "video-thumbnails" else "_")
        owned_name = re.compile(re.escape(expected) + r"[a-f0-9]{16}\.[A-Za-z0-9]{1,8}$")
        prefix = getattr(service.settings, setting, folder).strip("/")
        if not re.fullmatch(r"[A-Za-z0-9_/-]+", prefix):
            raise ValueError("Invalid storage prefix")
        owner_prefix = f"{prefix}/{user_id}_"
        if service._s3_client is not None:
            cursor, budget = None, 1000
            while True:
                response = service._s3_client.list_objects_v2(Bucket=service.settings.STORAGE_BUCKET_NAME, Prefix=owner_prefix, MaxKeys=1000, **({"ContinuationToken": cursor} if cursor else {}))
                keys = [item["Key"] for item in response.get("Contents", []) if item["Key"].startswith(prefix + "/") and owned_name.fullmatch(item["Key"][len(prefix)+1:])]
                selected = keys[:budget]
                if selected:
                    result = service._s3_client.delete_objects(Bucket=service.settings.STORAGE_BUCKET_NAME, Delete={"Objects": [{"Key": key} for key in selected], "Quiet": True})
                    if result.get("Errors"):
                        raise RuntimeError("Storage cleanup incomplete")
                    budget -= len(selected)
                more = len(keys) > len(selected) or response.get("IsTruncated", False)
                if not more:
                    break
                if budget == 0:
                    complete = False
                    break
                cursor = response.get("NextContinuationToken")
                if not cursor:
                    raise RuntimeError("Storage pagination unavailable")
        elif service._gcs_bucket is not None:
            budget = 1000
            for blob in service._gcs_client.list_blobs(service._gcs_bucket, prefix=owner_prefix):
                if blob.name.startswith(prefix + "/") and owned_name.fullmatch(blob.name[len(prefix)+1:]):
                    if budget == 0:
                        complete = False
                        break
                    blob.delete()
                    budget -= 1
        else:
            root = (Path(__file__).resolve().parents[2] / "uploads").resolve()
            directory = (root / folder).resolve()
            directory.relative_to(root)
            if not directory.exists():
                continue
            removed = 0
            for item in directory.iterdir():
                if not owned_name.fullmatch(item.name) or not item.is_file() or item.is_symlink():
                    continue
                item.resolve().relative_to(directory)
                if removed >= 1000:
                    complete = False
                    break
                item.unlink()
                removed += 1
    return complete
