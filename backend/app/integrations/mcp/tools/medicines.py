
from app.agent.tools.pharmacy_tools import PharmacyToolExecutor
from app.db.session import AsyncSessionLocal
from app.integrations.mcp.context import resolve_mcp_identity


async def search_medicines_impl(
    search: str,
    limit: int = 10,
) -> dict:

    identity = await resolve_mcp_identity()

    search = search.strip()

    if not search:
        raise ValueError("Search term cannot be empty.")

    if not 1 <= limit <= 50:
        raise ValueError("Limit must be between 1 and 50.")

    async with AsyncSessionLocal() as db:
        executor = PharmacyToolExecutor(
            db,
            identity.pharmacy_id,
        )

        result = await executor.execute(
            "search_medicines",
            {
                "search": search,
                "limit": limit,
            },
        )

        return {
            "pharmacy_id": str(identity.pharmacy_id),
            "data": result,
        }
