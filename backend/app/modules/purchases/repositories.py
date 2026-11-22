from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.purchases.models import (
    PurchaseOrder,
    PurchaseOrderItem,
)


class PurchaseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(
        self,
        pharmacy_id: UUID,
        purchase_id: UUID,
        *,
        lock: bool = False,
    ) -> PurchaseOrder | None:
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.pharmacy_id == pharmacy_id,
            PurchaseOrder.id == purchase_id,
        )

        if lock:
            stmt = stmt.with_for_update()

        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_items(
        self,
        pharmacy_id: UUID,
        purchase_id: UUID,
    ) -> list[PurchaseOrderItem]:
        stmt = (
            select(PurchaseOrderItem)
            .where(
                PurchaseOrderItem.pharmacy_id == pharmacy_id,
                PurchaseOrderItem.purchase_order_id == purchase_id,
            )
            .order_by(PurchaseOrderItem.id)
        )
        return list((await self.db.scalars(stmt)).all())

    async def list(
        self,
        pharmacy_id: UUID,
        limit: int,
        offset: int,
    ) -> list[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .where(PurchaseOrder.pharmacy_id == pharmacy_id)
            .order_by(
                PurchaseOrder.created_at.desc(),
                PurchaseOrder.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        return list((await self.db.scalars(stmt)).all())
