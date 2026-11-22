from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.agent.tools.pharmacy_tools import (
    ExpiringBatchesArgs,
    LowStockArgs,
    PharmacyToolExecutor,
    SearchMedicinesArgs,
    get_tool_declarations,
)


def test_tool_declarations():
    tools = get_tool_declarations()

    assert len(tools) == 1

    names = {declaration.name for declaration in tools[0].function_declarations}

    assert names == {
        "search_medicines",
        "get_low_stock_medicines",
        "get_expiring_batches",
    }


def test_search_arguments():
    args = SearchMedicinesArgs(
        query="Paracetamol",
        limit=5,
    )

    assert args.query == "Paracetamol"
    assert args.limit == 5


def test_low_stock_default_limit():
    args = LowStockArgs()
    assert args.limit == 10


def test_expiry_default_window():
    args = ExpiringBatchesArgs()
    assert args.days == 30


@pytest.mark.asyncio
async def test_unsupported_tool_rejected():
    executor = PharmacyToolExecutor(
        db=None,
        pharmacy_id=uuid4(),
    )

    result = await executor.execute(
        name="delete_all_medicines",
        arguments={},
    )

    assert result == {"error": "Unsupported tool."}


@pytest.mark.asyncio
async def test_invalid_arguments_rejected():
    executor = PharmacyToolExecutor(
        db=None,
        pharmacy_id=uuid4(),
    )

    result = await executor.execute(
        name="search_medicines",
        arguments={
            "query": "",
            "limit": 99999,
        },
    )

    assert result == {"error": "Invalid tool arguments."}


@pytest.mark.asyncio
async def test_search_uses_verified_pharmacy():
    pharmacy_id = uuid4()
    medicine_id = uuid4()

    class FakeMedicineRepository:
        def __init__(self):
            self.seen_pharmacy = None

        async def list(
            self,
            pharmacy_id,
            search,
            limit,
            offset,
        ):
            self.seen_pharmacy = pharmacy_id

            return [
                SimpleNamespace(
                    id=medicine_id,
                    sku="DEMO-PARA-500",
                    brand_name="Demo Paracetamol",
                    generic_name="Paracetamol",
                    strength="500 mg",
                    dosage_form="Tablet",
                    selling_price=Decimal("2.50"),
                    reorder_level=100,
                )
            ]

        async def total_stock(
            self,
            pharmacy_id,
            medicine_id,
        ):
            assert pharmacy_id == self.seen_pharmacy
            return 500

    executor = PharmacyToolExecutor(
        db=None,
        pharmacy_id=pharmacy_id,
    )

    fake = FakeMedicineRepository()
    executor.medicines = fake

    result = await executor.execute(
        name="search_medicines",
        arguments={
            "query": "Paracetamol",
            "limit": 5,
        },
    )

    assert fake.seen_pharmacy == pharmacy_id
    assert result["count"] == 1
    assert result["medicines"][0]["quantity_on_hand"] == 500
