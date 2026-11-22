from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pharmacy_id: UUID
    filename: str
    file_type: str
    checksum: str
    chunk_count: int
    status: str
    created_at: datetime
    updated_at: datetime


class KnowledgeSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=2, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class KnowledgeSource(BaseModel):
    document_id: UUID
    filename: str
    chunk_id: UUID
    chunk_position: int
    content: str
    similarity: float


class KnowledgeSearchResponse(BaseModel):
    query: str
    results: list[KnowledgeSource]


class KnowledgeAskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=10)


class KnowledgeAskResponse(BaseModel):
    question: str
    answer: str
    model: str
    sources: list[KnowledgeSource]
