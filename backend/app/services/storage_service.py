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
from dataclasses import dataclass

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from google.cloud import storage
from google.oauth2 import service_account

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