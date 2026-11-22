from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.runtime import PharmaPilotAgent
from app.core.config import get_settings
from app.core.exceptions.base import (
    ConflictException,
    NotFoundException,
)
from app.modules.conversations.repositories import (
    ConversationRepository,
)
from app.modules.conversations.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetailResponse,
    ConversationResponse,
    MessageResponse,
)


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ConversationRepository(db)
        self.settings = get_settings()

    async def _owned_conversation(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        conversation_id: UUID,
    ):
        conversation = await self.repo.get(
            pharmacy_id=pharmacy_id,
            user_id=user_id,
            conversation_id=conversation_id,
        )

        if conversation is None:
            raise NotFoundException("Conversation not found.")

        return conversation

    async def list(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        limit: int,
        offset: int,
    ):
        conversations = await self.repo.list_conversations(
            pharmacy_id,
            user_id,
            limit,
            offset,
        )

        return [
            ConversationResponse.model_validate(item) 
            for item in conversations
            ]

    async def detail(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        conversation_id: UUID,
    ):
        conversation = await self._owned_conversation(
            pharmacy_id,
            user_id,
            conversation_id,
        )

        messages = await self.repo.messages(
            pharmacy_id=pharmacy_id,
            conversation_id=conversation.id,
            limit=200,
        )

        return ConversationDetailResponse(
            conversation=ConversationResponse.model_validate(conversation),
            messages=[MessageResponse.model_validate(message) for message in messages],
        )

    async def chat(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        data: ChatRequest,
    ):
        text = data.message.strip()

        if not text:
            raise ConflictException("Chat message cannot be empty.")

        if data.conversation_id is None:
            conversation = await self.repo.create(
                pharmacy_id=pharmacy_id,
                user_id=user_id,
                title=text[:150],
            )
        else:
            conversation = await self._owned_conversation(
                pharmacy_id=pharmacy_id,
                user_id=user_id,
                conversation_id=data.conversation_id,
            )

        expected_version = conversation.version

        messages = await self.repo.messages(
            pharmacy_id=pharmacy_id,
            conversation_id=conversation.id,
            limit=self.settings.AI_MAX_HISTORY_MESSAGES,
        )

        history = [
            {
                "role": message.role,
                "content": message.content,
            }
            for message in messages
        ]

        agent = PharmaPilotAgent(
            db=self.db,
            pharmacy_id=pharmacy_id,
        )

        result = await agent.run(
            history=history,
            message=text,
        )

        saved = await self.repo.append_turn(
            conversation=conversation,
            expected_version=expected_version,
            user_text=text,
            assistant_text=result.answer,
        )

        if not saved:
            raise ConflictException(
                "This conversation was updated by another request. "
                "Please retry with the latest conversation history."
            )

        return ChatResponse(
            conversation_id=conversation.id,
            message=result.answer,
            model=self.settings.GEMINI_MODEL,
            tools_used=result.tools_used,
        )
