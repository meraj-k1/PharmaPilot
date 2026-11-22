from app.agent.tools.pharmacy_tools import PharmacyToolExecutor
from app.db.session import AsyncSessionLocal
from app.integrations.mcp.context import resolve_mcp_identity


async def get_low_stock_impl(limit: int = 20) -> dict:
    identity = await resolve_mcp_identity()

    if not 1 <= limit <= 100:
        raise ValueError("Invalid limit.")

    async with AsyncSessionLocal() as db:
        executor = PharmacyToolExecutor(
            db,
            identity.pharmacy_id,
        )

        result = await executor.execute(
            "get_low_stock_medicines",
            {"limit": limit},
        )

        return {
            "pharmacy_id": str(identity.pharmacy_id),
            "data": result,
        }


async def get_expiring_batches_impl(days: int = 30, limit: int = 20) -> dict:
    identity = current_identity()

    if not 1 <= days <= 365:
        raise ValueError("Days must be between 1 and 365.")

    if not 1 <= limit <= 100:
        raise ValueError("Invalid limit.")

    async with AsyncSessionLocal() as db:
        executor = PharmacyToolExecutor(
            db,
            identity.pharmacy_id,
        )

        result = await executor.execute(
            "get_expiring_batches",
            {
                "days": days,
                "limit": limit,
            },
        )

        return {
            "pharmacy_id": str(identity.pharmacy_id),
            "data": result,
        }
