from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.base import (
    ConflictException,
    NotFoundException,
)
from app.modules.medicines.models import Medicine
from app.modules.medicines.repositories import MedicineRepository
from app.modules.medicines.schemas import (
    LowStockResponse,
    MedicineCreate,
    MedicineUpdate,
)


class MedicineService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MedicineRepository(db)

    async def get(self, pharmacy_id: UUID, medicine_id: UUID):
        medicine = await self.repo.get(pharmacy_id, medicine_id)
        if medicine is None:
            raise NotFoundException("Medicine not found.")
        return medicine

    async def list(
        self,
        pharmacy_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ):
        return await self.repo.list_medicines(pharmacy_id, search, limit, offset)

    async def create(self, pharmacy_id: UUID, data: MedicineCreate):
        if await self.repo.get_by_sku(pharmacy_id, data.sku):
            raise ConflictException("Medicine SKU already exists.")

        medicine = Medicine(
            pharmacy_id=pharmacy_id,
            **data.model_dump(),
        )
        self.db.add(medicine)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictException("Medicine SKU already exists.") from exc

        await self.db.refresh(medicine)
        return medicine

    async def update(
        self,
        pharmacy_id: UUID,
        medicine_id: UUID,
        data: MedicineUpdate,
    ):
        medicine = await self.get(pharmacy_id, medicine_id)
        changes = data.model_dump(exclude_unset=True)

        required = {
            "sku",
            "brand_name",
            "generic_name",
            "strength",
            "dosage_form",
            "selling_price",
            "reorder_level",
        }

        if any(key in required and value is None for key, value in changes.items()):
            raise ConflictException("Required fields cannot be null.")

        for key, value in changes.items():
            setattr(medicine, key, value)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictException("Medicine update conflicts.") from exc

        await self.db.refresh(medicine)
        return medicine

    async def delete(self, pharmacy_id: UUID, medicine_id: UUID):
        medicine = await self.get(pharmacy_id, medicine_id)

        stock = await self.repo.total_stock(pharmacy_id, medicine_id)
        if stock > 0:
            raise ConflictException(
                "Cannot deactivate a medicine with remaining stock."
            )

        if await self.repo.has_open_purchase(pharmacy_id, medicine_id):
            raise ConflictException("Cannot deactivate a medicine in a draft purchase.")

        medicine.is_active = False
        await self.db.commit()

    async def low_stock(self, pharmacy_id: UUID):
        records = await self.repo.low_stock(pharmacy_id)

        return [
            LowStockResponse(
                medicine_id=medicine.id,
                sku=medicine.sku,
                brand_name=medicine.brand_name,
                quantity_on_hand=quantity,
                reorder_level=medicine.reorder_level,
                shortage=max(0, medicine.reorder_level - quantity),
            )
            for medicine, quantity in records
        ]
