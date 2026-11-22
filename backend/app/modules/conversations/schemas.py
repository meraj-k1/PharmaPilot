from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        min_length=1,
        max_length=4000,
    )

    conversation_id: UUID | None = None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pharmacy_id: UUID
    title: str
    version: int
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sequence: int
    role: str
    content: str
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    conversation: ConversationResponse
    messages: list[MessageResponse]


class ToolUsageResponse(BaseModel):
    name: str
    arguments: dict
    result_count: int | None = None


class ChatResponse(BaseModel):
    conversation_id: UUID
    message: str
    model: str
    tools_used: list[ToolUsageResponse]
