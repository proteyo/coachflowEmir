from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App environment ───────────────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # ── Database ──────────────────────────────────────────────────────────────
    # Production example:
    # postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB_NAME
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/coachflow"

    # Use only for very first deployment without migrations.
    # Real production should use Alembic migrations.
    AUTO_CREATE_TABLES: bool = False

    # Allows seed.py to insert demo data.
    # Must be false in production.
    ALLOW_DATABASE_SEED: bool = False

    # ── JWT / Auth ────────────────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE_ME"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── CORS ──────────────────────────────────────────────────────────────────
    # For production mobile-only backend, "*" is acceptable during first release.
    # If a web frontend is added later, replace "*" with exact frontend domains.
    CORS_ORIGINS: str = "*"

    # ── Subscription / payments ───────────────────────────────────────────────
    # Dev activation must be false in production.
    ALLOW_DEV_SUBSCRIPTION_ACTIVATION: bool = False

    # Google Play Billing
    GOOGLE_PLAY_PACKAGE_NAME: str = "com.emirkamilov.coachflow"
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: str | None = None

    # ── Email / SMTP ──────────────────────────────────────────────────────────
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 20

    # Local fallback for password reset.
    # Must be false in production.
    ALLOW_EMAIL_CONSOLE_FALLBACK: bool = False

    # Deep link for Expo reset password screen.
    FRONTEND_RESET_URL: str = "coachflow://reset-password"

    # ── External APIs ─────────────────────────────────────────────────────────
    GOOGLE_MAPS_API_KEY: str | None = None

    # Public backend URL, for example:
    # https://coachflow-api.onrender.com
    APP_PUBLIC_URL: str | None = None

    # ── File storage ──────────────────────────────────────────────────────────
    # local = current backend/uploads folder
    # s3    = Amazon S3 or any S3-compatible storage
    # r2    = Cloudflare R2, also S3-compatible
    #
    # Keep STORAGE_PROVIDER=local until cloud storage is fully configured.
    STORAGE_PROVIDER: Literal["local", "s3", "r2"] = "local"

    # S3 / Cloudflare R2 settings.
    # For Cloudflare R2:
    # STORAGE_PROVIDER=r2
    # STORAGE_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    # STORAGE_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
    # STORAGE_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
    # STORAGE_BUCKET_NAME=<BUCKET_NAME>
    # STORAGE_PUBLIC_BASE_URL=https://<PUBLIC_DOMAIN_OR_R2_DEV_URL>
    # STORAGE_REGION=auto
    STORAGE_ENDPOINT_URL: str | None = None
    STORAGE_ACCESS_KEY_ID: str | None = None
    STORAGE_SECRET_ACCESS_KEY: str | None = None
    STORAGE_BUCKET_NAME: str | None = None
    STORAGE_PUBLIC_BASE_URL: str | None = None
    STORAGE_REGION: str = "auto"

    # Folder names inside the storage bucket.
    STORAGE_AVATAR_PREFIX: str = "avatars"
    STORAGE_VOICE_PREFIX: str = "voice"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def uses_cloud_storage(self) -> bool:
        return self.STORAGE_PROVIDER in {"s3", "r2"}

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

        if not origins:
            return []

        if "*" in origins:
            return ["*"]

        return origins

    def validate_security(self) -> None:
        self._validate_secret_key()
        self._validate_database_url()
        self._validate_production_flags()
        self._validate_smtp_settings()
        self._validate_google_play_settings()
        self._validate_storage_settings()

    def _validate_secret_key(self) -> None:
        secret = self.SECRET_KEY.strip() if self.SECRET_KEY else ""

        weak_values = {
            "",
            "CHANGE_ME",
            "NEW_LONG_RANDOM_SECRET_KEY",
            "secret",
            "password",
            "test",
        }

        if secret in weak_values:
            raise RuntimeError(
                "SECRET_KEY is not configured. "
                "Set SECRET_KEY to a long random value in backend/.env."
            )

        if self.is_production and len(secret) < 48:
            raise RuntimeError(
                "SECRET_KEY is too short for production. "
                "Use a long random value, at least 48 characters."
            )

    def _validate_database_url(self) -> None:
        database_url = self.DATABASE_URL.strip() if self.DATABASE_URL else ""

        if not database_url:
            raise RuntimeError("DATABASE_URL is not configured.")

        placeholder_parts = [
            "DB_USER",
            "DB_PASSWORD",
            "DB_HOST",
            "DB_NAME",
            "YOUR_PASSWORD",
        ]

        if any(part in database_url for part in placeholder_parts):
            raise RuntimeError(
                "DATABASE_URL still contains placeholder values. "
                "Set a real PostgreSQL connection string."
            )

        if not database_url.startswith("postgresql+asyncpg://"):
            raise RuntimeError(
                "DATABASE_URL must start with postgresql+asyncpg://"
            )

    def _validate_production_flags(self) -> None:
        if not self.is_production:
            return

        if self.ALLOW_DEV_SUBSCRIPTION_ACTIVATION:
            raise RuntimeError(
                "ALLOW_DEV_SUBSCRIPTION_ACTIVATION must be false in production."
            )

        if self.ALLOW_DATABASE_SEED:
            raise RuntimeError(
                "ALLOW_DATABASE_SEED must be false in production."
            )

        if self.ALLOW_EMAIL_CONSOLE_FALLBACK:
            raise RuntimeError(
                "ALLOW_EMAIL_CONSOLE_FALLBACK must be false in production."
            )

        if self.AUTO_CREATE_TABLES:
            raise RuntimeError(
                "AUTO_CREATE_TABLES must be false in real production. "
                "Use migrations instead."
            )

    def _validate_smtp_settings(self) -> None:
        if self.SMTP_USE_TLS and self.SMTP_USE_SSL:
            raise RuntimeError(
                "SMTP_USE_TLS and SMTP_USE_SSL cannot both be true. "
                "Use TLS for port 587 or SSL for port 465."
            )

        if self.is_production:
            missing = []

            if not self.SMTP_HOST:
                missing.append("SMTP_HOST")
            if not self.SMTP_USER:
                missing.append("SMTP_USER")
            if not self.SMTP_PASSWORD:
                missing.append("SMTP_PASSWORD")
            if not self.SMTP_FROM:
                missing.append("SMTP_FROM")

            if missing:
                raise RuntimeError(
                    "SMTP is not fully configured for production. "
                    f"Missing: {', '.join(missing)}"
                )

    def _validate_google_play_settings(self) -> None:
        if not self.is_production:
            return

        if not self.GOOGLE_PLAY_PACKAGE_NAME:
            raise RuntimeError(
                "GOOGLE_PLAY_PACKAGE_NAME is required in production."
            )

        if self.GOOGLE_PLAY_PACKAGE_NAME != "com.emirkamilov.coachflow":
            raise RuntimeError(
                "GOOGLE_PLAY_PACKAGE_NAME does not match Android package name."
            )

    def _validate_storage_settings(self) -> None:
        if not self.uses_cloud_storage:
            return

        missing = []

        if not self.STORAGE_ENDPOINT_URL:
            missing.append("STORAGE_ENDPOINT_URL")
        if not self.STORAGE_ACCESS_KEY_ID:
            missing.append("STORAGE_ACCESS_KEY_ID")
        if not self.STORAGE_SECRET_ACCESS_KEY:
            missing.append("STORAGE_SECRET_ACCESS_KEY")
        if not self.STORAGE_BUCKET_NAME:
            missing.append("STORAGE_BUCKET_NAME")
        if not self.STORAGE_PUBLIC_BASE_URL:
            missing.append("STORAGE_PUBLIC_BASE_URL")

        if missing:
            raise RuntimeError(
                "Cloud storage is enabled, but required storage settings are missing. "
                f"Missing: {', '.join(missing)}"
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_security()
    return settings