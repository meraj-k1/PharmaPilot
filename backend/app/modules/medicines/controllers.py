from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.modules.medicines.dependencies import (
    AdminPharmacy,
    DBSession,
    StaffOrAdminPharmacy,
)
from app.modules.medicines.schemas import (
    MedicineCreate,
    MedicineResponse,
    MedicineUpdate,
)
from app.modules.medicines.services import MedicineService

router = APIRouter(prefix="/medicines", tags=["Medicines"])


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    data: MedicineCreate,
    pharmacy_id: AdminPharmacy,
    db: DBSession,
):
    return await MedicineService(db).create(
        pharmacy_id,
        data,
    )


@router.get("", response_model=list[MedicineResponse])
async def list_medicines(
    pharmacy_id: StaffOrAdminPharmacy,
    db: DBSession,
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await MedicineService(db).list(
        pharmacy_id,
        search,
        limit,
        offset,
    )


@router.get("/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(
    medicine_id: UUID,
    pharmacy_id: StaffOrAdminPharmacy,
    db: DBSession,
):
    return await MedicineService(db).get(
        pharmacy_id,
        medicine_id,
    )


@router.patch("/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(
    medicine_id: UUID,
    data: MedicineUpdate,
    pharmacy_id: AdminPharmacy,
    db: DBSession,
):
    return await MedicineService(db).update(
        pharmacy_id,
        medicine_id,
        data,
    )


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medicine(
    medicine_id: UUID,
    pharmacy_id: AdminPharmacy,
    db: DBSession,
):
    await MedicineService(db).delete(
        pharmacy_id,
        medicine_id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
