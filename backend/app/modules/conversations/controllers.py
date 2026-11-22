from uuid import UUID

from fastapi import APIRouter, Query

from app.modules.conversations.dependencies import (
    CurrentUser,
    DBSession,
    StaffOrAdminPharmacy,
)
from app.modules.conversations.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetailResponse,
    ConversationResponse,
)
from app.modules.conversations.services import ConversationService

router = APIRouter(
    prefix="/conversations",
    tags=["AI Conversations"],
)


@router.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(
    payload: ChatRequest,
    pharmacy: StaffOrAdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)

    return await service.chat(
        pharmacy_id=pharmacy,
        user_id=current_user.id,
        data=payload,
    )


@router.get(
    "",
    response_model=list[ConversationResponse],
)
async def list_conversations(
    pharmacy: StaffOrAdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    service = ConversationService(db)

    return await service.list(
        pharmacy_id=pharmacy,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailResponse,
)
async def get_conversation(
    conversation_id: UUID,
    pharmacy: StaffOrAdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)

    return await service.detail(
        pharmacy_id=pharmacy,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )
