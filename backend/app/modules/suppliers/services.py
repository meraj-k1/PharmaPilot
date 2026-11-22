from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.base import (
    ConflictException,
    NotFoundException,
)
from app.modules.suppliers.models import Supplier
from app.modules.suppliers.repositories import SupplierRepository
from app.modules.suppliers.schemas import (
    SupplierCreate,
    SupplierUpdate,
)


class SupplierService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SupplierRepository(db)

    async def get(self, pharmacy_id: UUID, supplier_id: UUID):
        supplier = await self.repo.get(pharmacy_id, supplier_id)
        if supplier is None:
            raise NotFoundException("Supplier not found.")
        return supplier

    async def list(
        self,
        pharmacy_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ):
        return await self.repo.list(pharmacy_id, search, limit, offset)

    async def create(self, pharmacy_id: UUID, data: SupplierCreate):
        supplier = Supplier(
            pharmacy_id=pharmacy_id,
            **data.model_dump(),
        )
        self.db.add(supplier)
        await self.db.commit()
        await self.db.refresh(supplier)
        return supplier

    async def update(
        self,
        pharmacy_id: UUID,
        supplier_id: UUID,
        data: SupplierUpdate,
    ):
        supplier = await self.get(pharmacy_id, supplier_id)

        changes = data.model_dump(exclude_unset=True)
        if changes.get("name", supplier.name) is None:
            raise ConflictException("Supplier name cannot be null.")

        for key, value in changes.items():
            setattr(supplier, key, value)

        await self.db.commit()
        await self.db.refresh(supplier)
        return supplier

    async def delete(self, pharmacy_id: UUID, supplier_id: UUID):
        supplier = await self.get(pharmacy_id, supplier_id)

        if await self.repo.has_open_purchase(pharmacy_id, supplier_id):
            raise ConflictException("Supplier has a draft purchase order.")

        supplier.is_active = False
        await self.db.commit()
