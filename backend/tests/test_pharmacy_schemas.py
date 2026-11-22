from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.inventory.schemas import StockAdjustmentRequest
from app.modules.medicines.schemas import (
    MedicineCreate,
    MedicineUpdate,
)
from app.modules.purchases.schemas import (
    PurchaseCreate,
    PurchaseItemCreate,
    ReceiveLine,
)


def test_valid_medicine():
    medicine = MedicineCreate(
        sku="MED-001",
        brand_name="Demo Paracetamol",
        generic_name="Paracetamol",
        strength="500 mg",
        dosage_form="Tablet",
        selling_price=Decimal("2.50"),
        reorder_level=50,
    )

    assert medicine.sku == "MED-001"
    assert medicine.selling_price == Decimal("2.50")


def test_negative_medicine_price_rejected():
    with pytest.raises(ValidationError):
        MedicineCreate(
            sku="MED-002",
            brand_name="Demo Medicine",
            generic_name="Generic Medicine",
            strength="100 mg",
            dosage_form="Tablet",
            selling_price=Decimal("-5.00"),
        )


def test_negative_reorder_level_rejected():
    with pytest.raises(ValidationError):
        MedicineUpdate(reorder_level=-1)


def test_purchase_quantity_must_be_positive():
    with pytest.raises(ValidationError):
        PurchaseItemCreate(
            medicine_id=uuid4(),
            quantity=0,
            unit_cost=Decimal("10.00"),
        )


def test_purchase_requires_items():
    with pytest.raises(ValidationError):
        PurchaseCreate(
            supplier_id=uuid4(),
            items=[],
        )


def test_invalid_manufacturing_date_rejected():
    today = date.today()

    with pytest.raises(ValidationError):
        ReceiveLine(
            purchase_order_item_id=uuid4(),
            batch_number="BATCH-001",
            manufactured_at=today,
            expires_at=today - timedelta(days=1),
        )


def test_zero_stock_adjustment_rejected():
    with pytest.raises(ValidationError):
        StockAdjustmentRequest(
            quantity_delta=0,
            reason="Physical stock count correction",
        )


def test_valid_negative_stock_adjustment():
    adjustment = StockAdjustmentRequest(
        quantity_delta=-5,
        reason="Damaged units removed after physical inspection",
    )

    assert adjustment.quantity_delta == -5
