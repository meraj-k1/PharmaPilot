from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.suppliers.models import Supplier


class SupplierRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(
        self,
        pharmacy_id: UUID,
        supplier_id: UUID,
    ) -> Supplier | None:
        stmt = select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.pharmacy_id == pharmacy_id,
            Supplier.is_active.is_(True),
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self,
        pharmacy_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ) -> list[Supplier]:
        stmt = select(Supplier).where(
            Supplier.pharmacy_id == pharmacy_id,
            Supplier.is_active.is_(True),
        )

        if search:
            stmt = stmt.where(Supplier.name.ilike(f"%{search}%"))

        stmt = stmt.order_by(Supplier.name, Supplier.id).limit(limit).offset(offset)
        return list((await self.db.scalars(stmt)).all())

    async def has_open_purchase(
        self,
        pharmacy_id: UUID,
        supplier_id: UUID,
    ) -> bool:
        from app.modules.purchases.models import PurchaseOrder

        stmt = (
            select(PurchaseOrder.id)
            .where(
                PurchaseOrder.pharmacy_id == pharmacy_id,
                PurchaseOrder.supplier_id == supplier_id,
                PurchaseOrder.status == "draft",
            )
            .limit(1)
        )
        return (await self.db.scalar(stmt)) is not None
