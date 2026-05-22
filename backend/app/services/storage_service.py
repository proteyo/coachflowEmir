"""
Storage service for CoachFlow uploads.

This service supports two modes:

1. local
   - Current behavior.
   - Files are stored in backend/uploads.
   - Useful for development.

2. s3 / r2
   - Production-ready cloud storage.
   - Supports Amazon S3 and Cloudflare R2 through S3-compatible API.
   - Backend stores only public URLs and does not depend on local disk.

Important:
- This file does not change existing upload behavior by itself.
- uploads.py will be connected to this service in the next step.
"""

import logging
from dataclasses import dataclass

import boto3
from botocore.exceptions import BotoCoreError, ClientError

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


class StorageService:
    """
    S3-compatible storage service.

    Works with:
    - Amazon S3
    - Cloudflare R2
    - other S3-compatible providers
    """

    def __init__(self) -> None:
        self.settings = get_settings()

        self._client = None

        if self.settings.uses_cloud_storage:
            self._client = boto3.client(
                "s3",
                endpoint_url=self.settings.STORAGE_ENDPOINT_URL,
                aws_access_key_id=self.settings.STORAGE_ACCESS_KEY_ID,
                aws_secret_access_key=self.settings.STORAGE_SECRET_ACCESS_KEY,
                region_name=self.settings.STORAGE_REGION,
            )

    @property
    def is_cloud_enabled(self) -> bool:
        return self.settings.uses_cloud_storage

    def build_public_url(self, key: str) -> str:
        """
        Builds a public URL for an uploaded object.
        """

        if not self.settings.STORAGE_PUBLIC_BASE_URL:
            raise RuntimeError("STORAGE_PUBLIC_BASE_URL is not configured.")

        base_url = self.settings.STORAGE_PUBLIC_BASE_URL.rstrip("/")
        clean_key = key.lstrip("/")

        return f"{base_url}/{clean_key}"

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

        if self._client is None:
            raise RuntimeError("Cloud storage client is not initialized.")

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
            self._client.put_object(
                Bucket=bucket_name,
                Key=clean_key,
                Body=content,
                **extra_args,
            )

        except (BotoCoreError, ClientError) as exc:
            logger.exception("Cloud storage upload failed")

            raise RuntimeError("Could not upload file to cloud storage.") from exc

        return UploadedFileResult(
            key=clean_key,
            public_url=self.build_public_url(clean_key),
            content_type=content_type,
            size_bytes=len(content),
        )


def get_storage_service() -> StorageService:
    return StorageService()