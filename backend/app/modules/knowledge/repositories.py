from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge.models import (
    KnowledgeChunk,
    KnowledgeDocument,
)


class KnowledgeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_document(
        self,
        pharmacy_id,
        uploaded_by,
        filename,
        file_type,
        checksum,
        extracted_text,
    ):

        document = KnowledgeDocument(
            pharmacy_id=pharmacy_id,
            uploaded_by=uploaded_by,
            filename=filename,
            file_type=file_type,
            checksum=checksum,
            extracted_text=extracted_text,
            chunk_count=0,
            status="processing",
        )

        self.db.add(document)
        await self.db.flush()

        return document

    async def get_document(
        self,
        pharmacy_id,
        document_id,
    ):

        statement = select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.pharmacy_id == pharmacy_id,
        )

        return await self.db.scalar(statement)

    async def get_by_checksum(
        self,
        pharmacy_id,
        checksum,
    ):

        statement = select(KnowledgeDocument).where(
            KnowledgeDocument.pharmacy_id == pharmacy_id,
            KnowledgeDocument.checksum == checksum,
        )

        return await self.db.scalar(statement)

    async def list_documents(
        self,
        pharmacy_id,
        limit=20,
        offset=0,
    ):

        statement = (
            select(KnowledgeDocument)
            .where(KnowledgeDocument.pharmacy_id == pharmacy_id)
            .order_by(KnowledgeDocument.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return list((await self.db.scalars(statement)).all())

    async def add_chunks(
        self,
        pharmacy_id,
        document_id,
        chunks,
    ):

        records = []

        for item in chunks:
            record = KnowledgeChunk(
                pharmacy_id=pharmacy_id,
                document_id=document_id,
                position=item["position"],
                content=item["content"],
                token_count=item["token_count"],
                embedding=item["embedding"],
            )

            records.append(record)

        self.db.add_all(records)

        return records

    async def semantic_search(
        self,
        pharmacy_id,
        query_embedding,
        top_k,
    ):

        distance = KnowledgeChunk.embedding.cosine_distance(query_embedding)

        statement = (
            select(
                KnowledgeChunk,
                KnowledgeDocument,
                distance.label("distance"),
            )
            .join(
                KnowledgeDocument,
                KnowledgeDocument.id == KnowledgeChunk.document_id,
            )
            .where(
                KnowledgeChunk.pharmacy_id == pharmacy_id,
                KnowledgeDocument.pharmacy_id == pharmacy_id,
                KnowledgeDocument.status == "ready",
            )
            .order_by(distance.asc())
            .limit(top_k)
        )

        result = await self.db.execute(statement)

        return result.all()

    async def delete_document(
        self,
        pharmacy_id,
        document_id,
    ):

        statement = (
            delete(KnowledgeDocument)
            .where(
                KnowledgeDocument.id == document_id,
                KnowledgeDocument.pharmacy_id == pharmacy_id,
            )
            .returning(KnowledgeDocument.id)
        )

        return await self.db.scalar(statement)
