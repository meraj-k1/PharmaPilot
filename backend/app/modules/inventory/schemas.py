from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pharmacy_id: UUID
    medicine_id: UUID
    batch_number: str
    manufactured_at: date | None
    expires_at: date
    unit_cost: Decimal
    quantity_on_hand: int
    created_at: datetime


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    batch_id: UUID
    actor_user_id: UUID
    purchase_order_item_id: UUID | None
    movement_type: str
    quantity_delta: int
    quantity_before: int
    quantity_after: int
    reason: str
    created_at: datetime


class StockAdjustmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity_delta: int = Field(ge=-1_000_000, le=1_000_000)
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("quantity_delta")
    @classmethod
    def nonzero_delta(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Quantity adjustment cannot be zero.")
        return value


class InventorySummaryResponse(BaseModel):
    total_medicines: int
    total_batches: int
    total_units: int
    stock_value: Decimal
    expiring_units: int
