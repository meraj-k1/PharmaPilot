from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.conversations.models import (
    Conversation,
    ConversationMessage,
)


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        title: str,
    ) -> Conversation:
        conversation = Conversation(
            pharmacy_id=pharmacy_id,
            owner_user_id=user_id,
            title=title[:150],
        )

        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)

        return conversation

    async def get(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        conversation_id: UUID,
    ) -> Conversation | None:
        statement = select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.pharmacy_id == pharmacy_id,
            Conversation.owner_user_id == user_id,
        )

        return (await self.db.execute(statement)).scalar_one_or_none()

    async def list_conversations(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        limit: int,
        offset: int,
    ) -> list[Conversation]:
        statement = (
            select(Conversation)
            .where(
                Conversation.pharmacy_id == pharmacy_id,
                Conversation.owner_user_id == user_id,
            )
            .order_by(
                Conversation.updated_at.desc(),
                Conversation.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        return list((await self.db.scalars(statement)).all())

    async def messages(
        self,
        pharmacy_id: UUID,
        conversation_id: UUID,
        limit: int | None = None,
    ) -> list[ConversationMessage]:
        statement = select(ConversationMessage).where(
            ConversationMessage.pharmacy_id == pharmacy_id,
            ConversationMessage.conversation_id == conversation_id,
        )

        if limit is None:
            statement = statement.order_by(ConversationMessage.sequence)
        else:
            statement = statement.order_by(ConversationMessage.sequence.desc()).limit(
                limit
            )

        records = list((await self.db.scalars(statement)).all())

        return records if limit is None else list(reversed(records))

    async def append_turn(
        self,
        conversation: Conversation,
        expected_version: int,
        user_text: str,
        assistant_text: str,
    ) -> bool:
        statement = (
            update(Conversation)
            .where(
                Conversation.id == conversation.id,
                Conversation.pharmacy_id == conversation.pharmacy_id,
                Conversation.owner_user_id == conversation.owner_user_id,
                Conversation.version == expected_version,
            )
            .values(
                version=expected_version + 1,
                updated_at=func.now(),
            )
            .returning(Conversation.id)
        )

        updated = await self.db.scalar(statement)

        if updated is None:
            await self.db.rollback()
            return False

        first_sequence = expected_version * 2 + 1

        self.db.add_all(
            [
                ConversationMessage(
                    pharmacy_id=conversation.pharmacy_id,
                    conversation_id=conversation.id,
                    sequence=first_sequence,
                    role="user",
                    content=user_text,
                ),
                ConversationMessage(
                    pharmacy_id=conversation.pharmacy_id,
                    conversation_id=conversation.id,
                    sequence=first_sequence + 1,
                    role="model",
                    content=assistant_text,
                ),
            ]
        )

        await self.db.commit()
        return True
