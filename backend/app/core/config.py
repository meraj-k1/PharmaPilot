from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    APP_NAME: str = "PharmaPilot"

    APP_ENV: Literal[
        "development",
        "test",
        "production",
    ] = "development"

    APP_DEBUG: bool = False

    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = Field(min_length=1)

    JWT_SECRET_KEY: str = Field(min_length=32)

    JWT_ALGORITHM: Literal["HS256"] = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60,
        gt=0,
        le=1440,
    )

    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    AI_MAX_TOOL_ROUNDS: int = Field(default=2, ge=1, le=5)
    AI_MAX_HISTORY_MESSAGES: int = Field(default=20, ge=2, le=40)

    EMBEDDING_SERVICE_URL: str = "http://embedder:80"

    EMBEDDING_MODEL: str = "intfloat/multilingual-e5-small"
    EMBEDDING_DIMENSIONS: int = Field(default=384, ge=1)

    RAG_MIN_SIMILARITY: float = Field(default=0.65, ge=0.0, le=1.0)

    # RAG configuration
    RAG_TOP_K: int = Field(default=5, ge=1, le=20)
    RAG_CHUNK_SIZE: int = Field(default=650, ge=100, le=1000)
    RAG_CHUNK_OVERLAP: int = Field(default=90, ge=0, le=200)

    # Document upload restrictions
    RAG_MAX_FILE_SIZE_MB: int = Field(default=10, ge=1, le=25)
    RAG_MAX_DOCUMENT_CHUNKS: int = Field(default=2000, ge=1, le=5000)

    CORS_ORIGINS: str = "http://localhost:5173"

    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @model_validator(mode="after")
    def validate_security(self):

        if self.JWT_SECRET_KEY.startswith("REPLACE_WITH_"):
            raise ValueError("Replace the JWT secret with a secure secret.")

        return self

    @property
    def cors_origins_list(self) -> list[str]:

        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
