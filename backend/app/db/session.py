
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


# ============================================
# DATABASE CONFIGURATION
# ============================================

settings = get_settings()


# ============================================
# ASYNC DATABASE ENGINE
# ============================================

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,

    # Temporarily disabled to isolate the
    # asyncpg connection checkout/ping issue.
    pool_pre_ping=False,

    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)


# ============================================
# ASYNC SESSION FACTORY
# ============================================

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# ============================================
# FASTAPI DATABASE DEPENDENCY
# ============================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
