
import hashlib
import logging
from pathlib import Path
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions.base import (
    ConflictException,
    NotFoundException,
)
from app.integrations.embeddings.tei import TEIEmbeddingService
from app.integrations.llm.gemini import GeminiService
from app.modules.knowledge.repositories import KnowledgeRepository
from app.modules.knowledge.schemas import (
    KnowledgeAskResponse,
    KnowledgeDocumentResponse,
    KnowledgeSearchResponse,
    KnowledgeSource,
)
from app.services.document_processing.chunker import DocumentChunker
from app.services.document_processing.extractors import extract_document

logger = logging.getLogger(__name__)


class KnowledgeService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
        self.repo = KnowledgeRepository(db)
        self.embedder = TEIEmbeddingService()
        self.chunker = DocumentChunker()
        self.gemini = GeminiService()

    async def ingest(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        filename: str,
        content: bytes,
    ):
        if not filename:
            raise ConflictException("Document filename is required.")

        safe_filename = Path(filename).name
        max_size = self.settings.RAG_MAX_FILE_SIZE_MB * 1024 * 1024

        if not content:
            raise ConflictException("Uploaded document is empty.")

        if len(content) > max_size:
            raise ConflictException("Document exceeds the maximum upload size.")

        checksum = hashlib.sha256(content).hexdigest()

        existing = await self.repo.get_by_checksum(
            pharmacy_id,
            checksum,
        )

        if existing:
            raise ConflictException("This document has already been uploaded.")

        extracted_text = extract_document(
            safe_filename,
            content,
        )

        chunks = self.chunker.chunk(extracted_text)

        if not chunks:
            raise ConflictException("Document contains no usable text.")

        if len(chunks) > self.settings.RAG_MAX_DOCUMENT_CHUNKS:
            raise ConflictException("Document exceeds the maximum chunk limit.")

        document_id: UUID | None = None

        try:
            document = await self.repo.create_document(
                pharmacy_id=pharmacy_id,
                uploaded_by=user_id,
                filename=safe_filename,
                file_type=Path(safe_filename).suffix.lower(),
                checksum=checksum,
                extracted_text=extracted_text,
            )

            await self.db.flush()

            document_id = document.id

            await self.db.commit()
            await self.db.refresh(document)

            embedded_chunks = []
            batch_size = 32

            for start in range(0, len(chunks), batch_size):
                batch = chunks[start : start + batch_size]
                texts = [item["content"] for item in batch]

                vectors = await self.embedder.embed_passages(texts)

                for item, vector in zip(batch, vectors, strict=True):
                    embedded_chunks.append(
                        {
                            **item,
                            "embedding": vector,
                        }
                    )

            await self.repo.add_chunks(
                pharmacy_id=pharmacy_id,
                document_id=document_id,
                chunks=embedded_chunks,
            )

            document.chunk_count = len(embedded_chunks)
            document.status = "ready"
            document.error_message = None

            await self.db.commit()
            await self.db.refresh(document)

            return KnowledgeDocumentResponse.model_validate(document)

        except Exception as exc:
            await self.db.rollback()

            if document_id is not None:
                try:
                    failed_document = await self.repo.get_document(
                        pharmacy_id,
                        document_id,
                    )

                    if failed_document is not None:
                        failed_document.status = "failed"
                        failed_document.error_message = type(exc).__name__

                        await self.db.commit()

                except SQLAlchemyError:
                    await self.db.rollback()
                    logger.exception(
                        "Failed to update knowledge document status"
                    )

            logger.exception("Knowledge document ingestion failed")
            raise

    async def list_documents(
        self,
        pharmacy_id: UUID,
        limit: int,
        offset: int,
    ):
        documents = await self.repo.list_documents(
            pharmacy_id,
            limit,
            offset,
        )

        return [
            KnowledgeDocumentResponse.model_validate(item)
            for item in documents
        ]

    async def get_document(
        self,
        pharmacy_id: UUID,
        document_id: UUID,
    ):
        document = await self.repo.get_document(
            pharmacy_id,
            document_id,
        )

        if document is None:
            raise NotFoundException("Knowledge document not found.")

        return KnowledgeDocumentResponse.model_validate(document)

    async def delete_document(
        self,
        pharmacy_id: UUID,
        document_id: UUID,
    ):
        document = await self.repo.get_document(
            pharmacy_id,
            document_id,
        )

        if document is None:
            raise NotFoundException("Knowledge document not found.")

        await self.repo.delete_document(
            pharmacy_id,
            document_id,
        )

        await self.db.commit()

    async def search(
        self,
        pharmacy_id: UUID,
        query: str,
        top_k: int,
    ):
        query = query.strip()

        if len(query) < 2:
            raise ConflictException("Search query is too short.")

        query_embedding = await self.embedder.embed_query(query)

        records = await self.repo.semantic_search(
            pharmacy_id=pharmacy_id,
            query_embedding=query_embedding,
            top_k=top_k,
        )

        sources = []

        for chunk, document, distance in records:
            similarity = max(
                0.0,
                min(1.0, 1.0 - float(distance)),
            )

            sources.append(
                KnowledgeSource(
                    document_id=document.id,
                    filename=document.filename,
                    chunk_id=chunk.id,
                    chunk_position=chunk.position,
                    content=chunk.content,
                    similarity=similarity,
                )
            )

        sources = [
            source
            for source in sources
            if source.similarity >= self.settings.RAG_MIN_SIMILARITY
        ]

        return KnowledgeSearchResponse(
            query=query,
            results=sources,
        )

    async def ask(
        self,
        pharmacy_id: UUID,
        question: str,
        top_k: int,
    ):
        search_result = await self.search(
            pharmacy_id=pharmacy_id,
            query=question,
            top_k=top_k,
        )

        if not search_result.results:
            return KnowledgeAskResponse(
                question=question,
                answer=(
                    "I could not find relevant information "
                    "in this pharmacy's uploaded knowledge "
                    "documents. Please upload the relevant "
                    "document or consult a qualified professional."
                ),
                model=self.settings.GEMINI_MODEL,
                sources=[],
            )

        answer = await self.gemini.generate_rag_answer(
            question=question,
            sources=search_result.results,
        )

        return KnowledgeAskResponse(
            question=question,
            answer=answer,
            model=self.settings.GEMINI_MODEL,
            sources=search_result.results,
        )
