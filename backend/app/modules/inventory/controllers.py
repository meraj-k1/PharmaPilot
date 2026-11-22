from uuid import UUID

from fastapi import APIRouter, Query, status

from app.modules.inventory.dependencies import (
    AdminPharmacy,
    CurrentUser,
    DBSession,
    StaffOrAdminPharmacy,
)
from app.modules.inventory.schemas import (
    BatchResponse,
    InventorySummaryResponse,
    StockAdjustmentRequest,
    StockMovementResponse,
)
from app.modules.inventory.services import InventoryService
from app.modules.medicines.schemas import LowStockResponse

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
)


@router.get(
    "/summary",
    response_model=InventorySummaryResponse,
)
async def inventory_summary(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await InventoryService(db).summary(
        pharmacy,
    )


@router.get(
    "/low-stock",
    response_model=list[LowStockResponse],
)
async def low_stock(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await InventoryService(db).low_stock(
        pharmacy,
    )


@router.get(
    "/expiring",
    response_model=list[BatchResponse],
)
async def expiring_batches(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
    days: int = Query(default=30, ge=0, le=3650),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await InventoryService(db).expiring(
        pharmacy,
        days,
        limit,
        offset,
    )


@router.get(
    "/batches",
    response_model=list[BatchResponse],
)
async def list_batches(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
    medicine_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await InventoryService(db).list_batches(
        pharmacy,
        medicine_id,
        limit,
        offset,
    )


@router.get(
    "/batches/{batch_id}",
    response_model=BatchResponse,
)
async def get_batch(
    batch_id: UUID,
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await InventoryService(db).get_batch(
        pharmacy,
        batch_id,
    )


@router.post(
    "/batches/{batch_id}/adjustments",
    response_model=StockMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def adjust_batch(
    batch_id: UUID,
    data: StockAdjustmentRequest,
    pharmacy: AdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
):
    return await InventoryService(db).adjust(
        pharmacy_id=pharmacy,
        batch_id=batch_id,
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "/movements",
    response_model=list[StockMovementResponse],
)
async def list_movements(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
    batch_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await InventoryService(db).movements(
        pharmacy,
        batch_id,
        limit,
        offset,
    )
