from uuid import UUID

from fastapi import APIRouter, Query, status

from app.modules.purchases.dependencies import (
    AdminPharmacy,
    CurrentUser,
    DBSession,
    StaffOrAdminPharmacy,
)
from app.modules.purchases.schemas import (
    PurchaseCreate,
    PurchaseReceiveRequest,
    PurchaseResponse,
)
from app.modules.purchases.services import PurchaseService

router = APIRouter(
    prefix="/purchases",
    tags=["Purchases"],
)


@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase(
    data: PurchaseCreate,
    pharmacy: AdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
):
    return await PurchaseService(db).create(pharmacy, current_user.id, data)


@router.get("", response_model=list[PurchaseResponse])
async def list_purchases(
    pharmacy: StaffOrAdminPharmacy,
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):

    return await PurchaseService(db).list(pharmacy, limit, offset)


@router.get("/{purchase_id}", response_model=PurchaseResponse)
async def get_purchase(
    purchase_id: UUID, pharmacy: StaffOrAdminPharmacy, db: DBSession
):

    return await PurchaseService(db).get(pharmacy, purchase_id)


@router.post("/{purchase_id}/receive", response_model=PurchaseResponse)
async def receive_purchase(
    purchase_id: UUID,
    data: PurchaseReceiveRequest,
    pharmacy: AdminPharmacy,
    current_user: CurrentUser,
    db: DBSession,
):
    return await PurchaseService(db).receive(
        pharmacy,
        purchase_id,
        current_user.id,
        data,
    )
