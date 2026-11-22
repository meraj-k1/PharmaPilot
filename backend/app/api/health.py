from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.base import AppException
from app.db.session import get_db

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        service="PharmaPilot API",
        version="1.1.0",
    )


@router.get("/ready")
async def readiness_check(db: Annotated[AsyncSession, Depends(get_db)]):
    try:
        await db.execute(text("SELECT 1"))

    except SQLAlchemyError as exc:
        raise AppException(
            message="Database is unavailable",
            status_code=503,
            error_code="DATABASE_UNAVAILABLE",
        ) from exc

    return {"status": "ready", "database": "connected"}
