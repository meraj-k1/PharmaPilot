from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.modules.suppliers.dependencies import (
    AdminPharmacy,
    DBSession,
    StaffOrAdminPharmacy,
)
from app.modules.suppliers.schemas import (
    SupplierCreate,
    SupplierResponse,
    SupplierUpdate,
)
from app.modules.suppliers.services import SupplierService

router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"],
)


@router.post(
    "",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_supplier(
    data: SupplierCreate,
    pharmacy: AdminPharmacy,
    db: DBSession,
):
    return await SupplierService(db).create(
        pharmacy,
        data,
    )


@router.get("", response_model=list[SupplierResponse])
async def list_suppliers(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await SupplierService(db).list(
        pharmacy,
        search,
        limit,
        offset,
    )


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await SupplierService(db).get(
        pharmacy,
        supplier_id,
    )


@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    pharmacy: AdminPharmacy,
    db: DBSession,
):
    return await SupplierService(db).update(
        pharmacy,
        supplier_id,
        data,
    )


@router.delete(
    "/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_supplier(
    supplier_id: UUID,
    pharmacy: AdminPharmacy,
    db: DBSession,
):
    await SupplierService(db).delete(
        pharmacy,
        supplier_id,
    )
    return Response(status_code=204)
