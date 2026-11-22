from app.db.session import AsyncSessionLocal
from app.integrations.mcp.context import resolve_mcp_identity
from app.modules.knowledge.services import KnowledgeService


async def search_knowledge_impl(query: str, top_k: int = 5) -> dict:
    identity = await resolve_mcp_identity()

    query = query.strip()

    if len(query) < 2:
        raise ValueError("Query must contain at least 2 characters.")

    if len(query) > 2000:
        raise ValueError("Query must not exceed 2000 characters.")

    if not 1 <= top_k <= 20:
        raise ValueError("top_k must be between 1 and 20.")

    async with AsyncSessionLocal() as db:
        result = await KnowledgeService(db).search(
            pharmacy_id=identity.pharmacy_id,
            query=query,
            top_k=top_k,
        )

        return result.model_dump(mode="json")
