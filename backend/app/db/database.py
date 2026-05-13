"""
Database configuration for CoachFlow backend.
"""

import logging
import os
import ssl
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


def get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)

    if value is None:
        return default

    try:
        return int(value.strip())
    except ValueError:
        logger.warning(
            "Invalid integer value for %s=%r. Using default=%s.",
            name,
            value,
            default,
        )
        return default


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def build_connect_args() -> dict:
    """
    Builds database connection arguments.

    For most local PostgreSQL setups SSL is not needed.
    For production providers that require SSL, set:

    DATABASE_SSL=true
    """

    database_ssl = get_bool_env("DATABASE_SSL", False)

    if not database_ssl:
        return {}

    ssl_context = ssl.create_default_context()

    return {
        "ssl": ssl_context,
    }


engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=get_bool_env("DATABASE_ECHO", False),
    pool_pre_ping=True,
    pool_size=get_int_env("DATABASE_POOL_SIZE", 5),
    max_overflow=get_int_env("DATABASE_MAX_OVERFLOW", 10),
    pool_timeout=get_int_env("DATABASE_POOL_TIMEOUT", 30),
    pool_recycle=get_int_env("DATABASE_POOL_RECYCLE", 1800),
    connect_args=build_connect_args(),
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.

    The session is created per request.
    Individual routers/services should explicitly commit when they modify data.
    If an exception happens, the transaction is rolled back.
    """

    async with AsyncSessionLocal() as session:
        try:
            yield session

        except Exception:
            await session.rollback()
            logger.exception("Database session rollback after request error.")
            raise

        finally:
            await session.close()