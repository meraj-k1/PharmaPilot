import secrets
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
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
from app.modules.medicines.repositories import MedicineRepository
from app.modules.purchases.models import (
    PurchaseOrder,
    PurchaseOrderItem,
)
from app.modules.purchases.repositories import PurchaseRepository
from app.modules.purchases.schemas import (
    PurchaseCreate,
    PurchaseItemResponse,
    PurchaseReceiveRequest,
    PurchaseResponse,
)
from app.modules.suppliers.repositories import SupplierRepository


class PurchaseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PurchaseRepository(db)
        self.inventory_repo = InventoryRepository(db)
        self.medicine_repo = MedicineRepository(db)
        self.supplier_repo = SupplierRepository(db)

    async def _response(self, order: PurchaseOrder):
        items = await self.repo.get_items(
            order.pharmacy_id,
            order.id,
        )
        return PurchaseResponse(
            id=order.id,
            pharmacy_id=order.pharmacy_id,
            supplier_id=order.supplier_id,
            order_number=order.order_number,
            status=order.status,
            total_amount=order.total_amount,
            created_by=order.created_by,
            received_at=order.received_at,
            items=[PurchaseItemResponse.model_validate(item) for item in items],
        )

    async def get(self, pharmacy_id: UUID, purchase_id: UUID):
        order = await self.repo.get(pharmacy_id, purchase_id)
        if order is None:
            raise NotFoundException("Purchase order not found.")
        return await self._response(order)

    async def list(
        self,
        pharmacy_id: UUID,
        limit: int,
        offset: int,
    ):
        orders = await self.repo.list(pharmacy_id, limit, offset)
        return [await self._response(order) for order in orders]

    async def create(
        self,
        pharmacy_id: UUID,
        user_id: UUID,
        data: PurchaseCreate,
    ):
        supplier = await self.supplier_repo.get(
            pharmacy_id,
            data.supplier_id,
        )
        if supplier is None:
            raise NotFoundException("Supplier not found.")

        ids = [item.medicine_id for item in data.items]

        if len(ids) != len(set(ids)):
            raise ConflictException("A medicine cannot appear twice in one purchase.")

        for item in data.items:
            medicine = await self.medicine_repo.get(
                pharmacy_id,
                item.medicine_id,
            )
            if medicine is None:
                raise NotFoundException(f"Medicine {item.medicine_id} not found.")

        total = sum(
            (item.quantity * item.unit_cost for item in data.items),
            start=0,
        )

        order = PurchaseOrder(
            pharmacy_id=pharmacy_id,
            supplier_id=data.supplier_id,
            order_number=f"PO-{secrets.token_hex(8).upper()}",
            status="draft",
            total_amount=total,
            created_by=user_id,
        )

        self.db.add(order)

        try:
            await self.db.flush()

            for item in data.items:
                self.db.add(
                    PurchaseOrderItem(
                        pharmacy_id=pharmacy_id,
                        purchase_order_id=order.id,
                        medicine_id=item.medicine_id,
                        quantity=item.quantity,
                        unit_cost=item.unit_cost,
                    )
                )

            await self.db.commit()

        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictException(
                "Purchase order conflicts with existing data."
            ) from exc

        return await self._response(order)

    async def receive(
        self,
        pharmacy_id: UUID,
        purchase_id: UUID,
        user_id: UUID,
        data: PurchaseReceiveRequest,
    ):
        order = await self.repo.get(
            pharmacy_id,
            purchase_id,
            lock=True,
        )

        if order is None:
            raise NotFoundException("Purchase order not found.")

        if order.status != "draft":
            raise ConflictException("This purchase order has already been received.")

        items = await self.repo.get_items(
            pharmacy_id,
            purchase_id,
        )

        expected = {item.id for item in items}
        provided = {item.purchase_order_item_id for item in data.items}

        if len(provided) != len(data.items):
            raise ConflictException("Duplicate receipt lines.")

        if expected != provided:
            raise ConflictException(
                "Receipt must contain every purchase line exactly once."
            )

        receipt_map = {line.purchase_order_item_id: line for line in data.items}

        # Stable ordering helps minimize concurrent lock conflicts.
        sorted_items = sorted(
            items,
            key=lambda item: (str(item.medicine_id), str(item.id)),
        )

        try:
            for item in sorted_items:
                line = receipt_map[item.id]

                if line.expires_at <= date.today():
                    raise ConflictException("Cannot receive an expired medicine batch.")

                batch = await self.inventory_repo.get_batch_by_identity(
                    pharmacy_id,
                    item.medicine_id,
                    line.batch_number,
                    lock=True,
                )

                if batch is None:
                    batch = MedicineBatch(
                        pharmacy_id=pharmacy_id,
                        medicine_id=item.medicine_id,
                        batch_number=line.batch_number,
                        manufactured_at=line.manufactured_at,
                        expires_at=line.expires_at,
                        unit_cost=item.unit_cost,
                        quantity_on_hand=0,
                    )
                    self.db.add(batch)
                    await self.db.flush()

                else:
                    if (
                        batch.expires_at != line.expires_at
                        or batch.manufactured_at != line.manufactured_at
                        or batch.unit_cost != item.unit_cost
                    ):
                        raise ConflictException(
                            "Existing batch metadata or cost differs."
                        )

                before = batch.quantity_on_hand
                after = before + item.quantity

                batch.quantity_on_hand = after

                movement = StockMovement(
                    pharmacy_id=pharmacy_id,
                    batch_id=batch.id,
                    purchase_order_item_id=item.id,
                    actor_user_id=user_id,
                    movement_type="purchase_receipt",
                    quantity_delta=item.quantity,
                    quantity_before=before,
                    quantity_after=after,
                    reason=f"Receipt of {order.order_number}",
                )

                self.db.add(movement)

            order.status = "received"
            order.received_at = datetime.now(UTC)
            order.received_by = user_id

            await self.db.commit()

        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictException(
                "Batch creation conflicted with a concurrent receipt."
            ) from exc

        except Exception:
            await self.db.rollback()
            raise

        return await self._response(order)
