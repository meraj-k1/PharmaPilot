from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class PurchaseItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    medicine_id: UUID
    quantity: int = Field(gt=0, le=1_000_000)
    unit_cost: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class PurchaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    supplier_id: UUID
    items: list[PurchaseItemCreate] = Field(min_length=1, max_length=100)


class PurchaseItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    medicine_id: UUID
    quantity: int
    unit_cost: Decimal


class PurchaseResponse(BaseModel):
    id: UUID
    pharmacy_id: UUID
    supplier_id: UUID
    order_number: str
    status: str
    total_amount: Decimal
    created_by: UUID
    received_at: datetime | None
    items: list[PurchaseItemResponse]


class ReceiveLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purchase_order_item_id: UUID
    batch_number: str = Field(min_length=1, max_length=100)
    manufactured_at: date | None = None
    expires_at: date

    @model_validator(mode="after")
    def valid_dates(self):
        if self.manufactured_at is not None and self.manufactured_at >= self.expires_at:
            raise ValueError("Expiry date must be after manufacturing date.")
        return self


class PurchaseReceiveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ReceiveLine] = Field(min_length=1, max_length=100)
