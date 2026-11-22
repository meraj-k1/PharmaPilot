from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.models import MedicineBatch
from app.modules.medicines.models import Medicine


class MedicineRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID,
    ) -> Medicine | None:
        stmt = select(Medicine).where(
            Medicine.id == medicine_id,
            Medicine.pharmacy_id == pharmacy_id,
            Medicine.is_active.is_(True),
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_by_sku(
        self,
        pharmacy_id: UUID,
        sku: str,
    ) -> Medicine | None:
        stmt = select(Medicine).where(
            Medicine.pharmacy_id == pharmacy_id,
            Medicine.sku == sku,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_medicines(
        self,
        pharmacy_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ) -> list[Medicine]:
        stmt = select(Medicine).where(
            Medicine.pharmacy_id == pharmacy_id,
            Medicine.is_active.is_(True),
        )

        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Medicine.brand_name.ilike(pattern),
                    Medicine.generic_name.ilike(pattern),
                    Medicine.sku.ilike(pattern),
                )
            )

        stmt = (
            stmt.order_by(Medicine.brand_name, Medicine.id).limit(limit).offset(offset)
        )
        return list((await self.db.scalars(stmt)).all())

    async def has_open_purchase(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID,
    ) -> bool:
        from app.modules.purchases.models import (
            PurchaseOrder,
            PurchaseOrderItem,
        )

        stmt = (
            select(PurchaseOrderItem.id)
            .join(
                PurchaseOrder,
                PurchaseOrder.id == PurchaseOrderItem.purchase_order_id,
            )
            .where(
                PurchaseOrderItem.pharmacy_id == pharmacy_id,
                PurchaseOrderItem.medicine_id == medicine_id,
                PurchaseOrder.status == "draft",
            )
            .limit(1)
        )
        return (await self.db.scalar(stmt)) is not None

    async def total_stock(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID,
    ) -> int:
        stmt = select(func.coalesce(func.sum(MedicineBatch.quantity_on_hand), 0)).where(
            MedicineBatch.pharmacy_id == pharmacy_id,
            MedicineBatch.medicine_id == medicine_id,
        )
        return int(await self.db.scalar(stmt) or 0)

    async def low_stock(
        self,
        pharmacy_id: UUID,
    ) -> list[tuple[Medicine, int]]:
        stock = (
            select(func.coalesce(func.sum(MedicineBatch.quantity_on_hand), 0))
            .where(
                MedicineBatch.pharmacy_id == Medicine.pharmacy_id,
                MedicineBatch.medicine_id == Medicine.id,
            )
            .correlate(Medicine)
            .scalar_subquery()
        )

        stmt = (
            select(Medicine, stock.label("stock"))
            .where(
                Medicine.pharmacy_id == pharmacy_id,
                Medicine.is_active.is_(True),
                stock <= Medicine.reorder_level,
            )
            .order_by(Medicine.brand_name)
        )

        rows = (await self.db.execute(stmt)).all()
        return [(medicine, int(quantity)) for medicine, quantity in rows]
