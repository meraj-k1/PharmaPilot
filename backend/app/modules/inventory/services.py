from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.base import (
    ConflictException,
    NotFoundException,
)
from app.modules.inventory.models import (
    MedicineBatch,
    StockMovement,
)
from app.modules.inventory.repositories import InventoryRepository
from app.modules.inventory.schemas import (
    InventorySummaryResponse,
    StockAdjustmentRequest,
)
from app.modules.medicines.models import Medicine
from app.modules.medicines.services import MedicineService


class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = InventoryRepository(db)

    async def get_batch(self, pharmacy_id: UUID, batch_id: UUID):
        batch = await self.repo.get_batch(pharmacy_id, batch_id)
        if batch is None:
            raise NotFoundException("Medicine batch not found.")
        return batch

    async def list_batches(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID | None,
        limit: int,
        offset: int,
    ):
        return await self.repo.list_batches(
            pharmacy_id,
            medicine_id,
            limit,
            offset,
        )

    async def expiring(
        self,
        pharmacy_id: UUID,
        days: int,
        limit: int,
        offset: int,
    ):
        cutoff = date.today() + timedelta(days=days)
        return await self.repo.expiring(
            pharmacy_id,
            cutoff,
            limit,
            offset,
        )

    async def low_stock(self, pharmacy_id: UUID):
        return await MedicineService(self.db).low_stock(pharmacy_id)

    async def movements(
        self,
        pharmacy_id: UUID,
        batch_id: UUID | None,
        limit: int,
        offset: int,
    ):
        return await self.repo.movements(
            pharmacy_id,
            batch_id,
            limit,
            offset,
        )

    async def adjust(
        self,
        pharmacy_id: UUID,
        batch_id: UUID,
        user_id: UUID,
        data: StockAdjustmentRequest,
    ):
        batch = await self.repo.get_batch(
            pharmacy_id,
            batch_id,
            lock=True,
        )
        if batch is None:
            raise NotFoundException("Medicine batch not found.")

        before = batch.quantity_on_hand
        after = before + data.quantity_delta

        if after < 0:
            raise ConflictException("Stock adjustment would make quantity negative.")

        batch.quantity_on_hand = after

        movement = StockMovement(
            pharmacy_id=pharmacy_id,
            batch_id=batch.id,
            actor_user_id=user_id,
            movement_type="adjustment",
            quantity_delta=data.quantity_delta,
            quantity_before=before,
            quantity_after=after,
            reason=data.reason,
        )
        self.db.add(movement)

        await self.db.commit()
        await self.db.refresh(movement)
        return movement

    async def summary(self, pharmacy_id: UUID):
        medicine_count = await self.db.scalar(
            select(func.count(Medicine.id)).where(
                Medicine.pharmacy_id == pharmacy_id,
                Medicine.is_active.is_(True),
            )
        )

        stmt = select(
            func.count(MedicineBatch.id),
            func.coalesce(func.sum(MedicineBatch.quantity_on_hand), 0),
            func.coalesce(
                func.sum(MedicineBatch.quantity_on_hand * MedicineBatch.unit_cost),
                0,
            ),
        ).where(MedicineBatch.pharmacy_id == pharmacy_id)

        result = (await self.db.execute(stmt)).one()

        cutoff = date.today() + timedelta(days=30)

        expiring_units = await self.db.scalar(
            select(func.coalesce(func.sum(MedicineBatch.quantity_on_hand), 0)).where(
                MedicineBatch.pharmacy_id == pharmacy_id,
                MedicineBatch.expires_at <= cutoff,
            )
        )

        return InventorySummaryResponse(
            total_medicines=int(medicine_count or 0),
            total_batches=int(result[0] or 0),
            total_units=int(result[1] or 0),
            stock_value=Decimal(result[2] or 0),
            expiring_units=int(expiring_units or 0),
        )
