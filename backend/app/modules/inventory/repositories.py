from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.models import (
    MedicineBatch,
    StockMovement,
)


class InventoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_batch(
        self,
        pharmacy_id: UUID,
        batch_id: UUID,
        *,
        lock: bool = False,
    ) -> MedicineBatch | None:
        stmt = select(MedicineBatch).where(
            MedicineBatch.pharmacy_id == pharmacy_id,
            MedicineBatch.id == batch_id,
        )

        if lock:
            stmt = stmt.with_for_update()

        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_batch_by_identity(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID,
        batch_number: str,
        *,
        lock: bool = False,
    ) -> MedicineBatch | None:
        stmt = select(MedicineBatch).where(
            MedicineBatch.pharmacy_id == pharmacy_id,
            MedicineBatch.medicine_id == medicine_id,
            MedicineBatch.batch_number == batch_number,
        )

        if lock:
            stmt = stmt.with_for_update()

        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_batches(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[MedicineBatch]:
        stmt = select(MedicineBatch).where(MedicineBatch.pharmacy_id == pharmacy_id)

        if medicine_id:
            stmt = stmt.where(MedicineBatch.medicine_id == medicine_id)

        stmt = (
            stmt.order_by(
                MedicineBatch.expires_at,
                MedicineBatch.id,
            )
            .limit(limit)
            .offset(offset)
        )

        return list((await self.db.scalars(stmt)).all())

    async def expiring(
        self,
        pharmacy_id: UUID,
        end_date: date,
        limit: int,
        offset: int,
    ) -> list[MedicineBatch]:
        stmt = (
            select(MedicineBatch)
            .where(
                MedicineBatch.pharmacy_id == pharmacy_id,
                MedicineBatch.quantity_on_hand > 0,
                MedicineBatch.expires_at <= end_date,
            )
            .order_by(MedicineBatch.expires_at, MedicineBatch.id)
            .limit(limit)
            .offset(offset)
        )
        return list((await self.db.scalars(stmt)).all())

    async def movements(
        self,
        pharmacy_id: UUID,
        batch_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[StockMovement]:
        stmt = select(StockMovement).where(StockMovement.pharmacy_id == pharmacy_id)

        if batch_id:
            stmt = stmt.where(StockMovement.batch_id == batch_id)

        stmt = (
            stmt.order_by(
                StockMovement.created_at.desc(),
                StockMovement.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        return list((await self.db.scalars(stmt)).all())
