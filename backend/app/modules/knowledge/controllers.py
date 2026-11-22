from uuid import UUID

from fastapi import (
    APIRouter,
    File,
    Query,
    UploadFile,
    status,
)

from app.core.config import get_settings
from app.core.exceptions.base import AppException
from app.modules.knowledge.dependencies import (
    AdminPharmacy,
    CurrentUser,
    DBSession,
    StaffOrAdminPharmacy,
)
from app.modules.knowledge.schemas import (
    KnowledgeAskRequest,
    KnowledgeAskResponse,
    KnowledgeDocumentResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.modules.knowledge.services import KnowledgeService

UPLOAD_FILE_REQUIRED = File(...)

router = APIRouter(
    prefix="/knowledge",
    tags=["Knowledge & RAG"],
)


@router.post(
    "/documents",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    pharmacy: AdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = UPLOAD_FILE_REQUIRED,
):
    settings = get_settings()

    max_size = settings.RAG_MAX_FILE_SIZE_MB * 1024 * 1024

    content = await file.read(max_size + 1)

    if len(content) > max_size:
        raise AppException(
            message="Document exceeds the maximum upload size.",
            status_code=413,
            error_code="DOCUMENT_TOO_LARGE",
        )

    if not file.filename:
        raise AppException(
            message="Filename is required.",
            status_code=422,
            error_code="INVALID_FILENAME",
        )

    return await KnowledgeService(db).ingest(
        pharmacy_id=pharmacy,
        user_id=current_user.id,
        filename=file.filename,
        content=content,
    )


@router.get(
    "/documents",
    response_model=list[KnowledgeDocumentResponse],
)
async def list_documents(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await KnowledgeService(db).list_documents(
        pharmacy_id=pharmacy,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/documents/{document_id}",
    response_model=KnowledgeDocumentResponse,
)
async def get_document(
    document_id: UUID,
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await KnowledgeService(db).get_document(
        pharmacy_id=pharmacy,
        document_id=document_id,
    )


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    document_id: UUID,
    pharmacy: AdminPharmacy,
    db: DBSession,
):
    await KnowledgeService(db).delete_document(
        pharmacy_id=pharmacy,
        document_id=document_id,
    )


@router.post(
    "/search",
    response_model=KnowledgeSearchResponse,
)
async def search_knowledge(
    data: KnowledgeSearchRequest,
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await KnowledgeService(db).search(
        pharmacy_id=pharmacy,
        query=data.query,
        top_k=data.top_k,
    )


@router.post("/ask", response_model=KnowledgeAskResponse)
async def ask_knowledge(
    data: KnowledgeAskRequest, pharmacy: StaffOrAdminPharmacy, db: DBSession
):
    return await KnowledgeService(db).ask(
        pharmacy_id=pharmacy,
        question=data.question,
        top_k=data.top_k,
    )
