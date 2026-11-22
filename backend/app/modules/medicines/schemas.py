from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MedicineCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str = Field(min_length=1, max_length=80)
    brand_name: str = Field(min_length=1, max_length=200)
    generic_name: str = Field(min_length=1, max_length=200)
    strength: str = Field(min_length=1, max_length=80)
    dosage_form: str = Field(min_length=1, max_length=80)

    manufacturer: str | None = Field(default=None, max_length=200)
    barcode: str | None = Field(default=None, max_length=100)

    selling_price: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    reorder_level: int = Field(default=10, ge=0)


class MedicineUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str | None = Field(default=None, min_length=1, max_length=80)
    brand_name: str | None = Field(default=None, min_length=1, max_length=200)
    generic_name: str | None = Field(default=None, min_length=1, max_length=200)
    strength: str | None = Field(default=None, min_length=1, max_length=80)
    dosage_form: str | None = Field(default=None, min_length=1, max_length=80)

    manufacturer: str | None = Field(default=None, max_length=200)
    barcode: str | None = Field(default=None, max_length=100)

    selling_price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    reorder_level: int | None = Field(default=None, ge=0)


class MedicineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pharmacy_id: UUID
    sku: str
    brand_name: str
    generic_name: str
    strength: str
    dosage_form: str
    manufacturer: str | None
    barcode: str | None
    selling_price: Decimal
    reorder_level: int
    is_active: bool
    created_at: datetime


class LowStockResponse(BaseModel):
    medicine_id: UUID
    sku: str
    brand_name: str
    quantity_on_hand: int
    reorder_level: int
    shortage: int
