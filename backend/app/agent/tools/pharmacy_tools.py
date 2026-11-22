from datetime import date, timedelta
from uuid import UUID

from google.genai import types
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.repositories import InventoryRepository
from app.modules.medicines.repositories import MedicineRepository


class SearchMedicinesArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=100)
    limit: int = Field(default=10, ge=1, le=20)


class LowStockArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit: int = Field(default=10, ge=1, le=20)


class ExpiringBatchesArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    days: int = Field(default=30, ge=0, le=365)
    limit: int = Field(default=10, ge=1, le=20)


TOOL_MODELS = {
    "search_medicines": SearchMedicinesArgs,
    "get_low_stock_medicines": LowStockArgs,
    "get_expiring_batches": ExpiringBatchesArgs,
}


def get_tool_declarations() -> list[types.Tool]:
    declarations = [
        types.FunctionDeclaration(
            name="search_medicines",
            description=(
                "Search the current pharmacy's medicine catalog "
                "by brand name, generic name, or SKU. "
                "Returns matching medicines and live batch stock."
            ),
            parameters_json_schema=SearchMedicinesArgs.model_json_schema(),
        ),
        types.FunctionDeclaration(
            name="get_low_stock_medicines",
            description=(
                "Find medicines in the current pharmacy whose "
                "total stock is at or below their reorder level."
            ),
            parameters_json_schema=LowStockArgs.model_json_schema(),
        ),
        types.FunctionDeclaration(
            name="get_expiring_batches",
            description=(
                "Find batches in the current pharmacy expiring "
                "within a chosen number of days. "
                "Includes already expired batches."
            ),
            parameters_json_schema=ExpiringBatchesArgs.model_json_schema(),
        ),
    ]

    return [types.Tool(function_declarations=declarations)]


class PharmacyToolExecutor:
    def __init__(
        self,
        db: AsyncSession,
        pharmacy_id: UUID,
    ):
        self.db = db
        self.pharmacy_id = pharmacy_id
        self.medicines = MedicineRepository(db)
        self.inventory = InventoryRepository(db)

    async def execute(
        self,
        name: str,
        arguments: dict,
    ) -> dict:
        model = TOOL_MODELS.get(name)

        if model is None:
            return {"error": "Unsupported tool."}

        try:
            args = model.model_validate(arguments)
        except ValueError:
            return {"error": "Invalid tool arguments."}

        if name == "search_medicines":
            return await self._search_medicines(args)

        if name == "get_low_stock_medicines":
            return await self._low_stock(args)

        if name == "get_expiring_batches":
            return await self._expiring(args)

        return {"error": "Unsupported tool."}

    async def _search_medicines(
        self,
        args: SearchMedicinesArgs,
    ) -> dict:
        records = await self.medicines.list_medicines(
            pharmacy_id=self.pharmacy_id,
            search=args.query,
            limit=args.limit,
            offset=0,
        )

        results = []

        for medicine in records:
            stock = await self.medicines.total_stock(
                self.pharmacy_id,
                medicine.id,
            )

            results.append(
                {
                    "medicine_id": str(medicine.id),
                    "sku": medicine.sku,
                    "brand_name": medicine.brand_name,
                    "generic_name": medicine.generic_name,
                    "strength": medicine.strength,
                    "dosage_form": medicine.dosage_form,
                    "selling_price": str(medicine.selling_price),
                    "quantity_on_hand": stock,
                    "reorder_level": medicine.reorder_level,
                }
            )

        return {
            "query": args.query,
            "count": len(results),
            "medicines": results,
        }

    async def _low_stock(
        self,
        args: LowStockArgs,
    ) -> dict:
        records = await self.medicines.low_stock(self.pharmacy_id)

        results = [
            {
                "medicine_id": str(medicine.id),
                "sku": medicine.sku,
                "brand_name": medicine.brand_name,
                "quantity_on_hand": quantity,
                "reorder_level": medicine.reorder_level,
                "shortage": max(
                    0,
                    medicine.reorder_level - quantity,
                ),
            }
            for medicine, quantity in records[: args.limit]
        ]

        return {
            "count": len(results),
            "medicines": results,
        }

    async def _expiring(
        self,
        args: ExpiringBatchesArgs,
    ) -> dict:
        cutoff = date.today() + timedelta(days=args.days)

        batches = await self.inventory.expiring(
            pharmacy_id=self.pharmacy_id,
            end_date=cutoff,
            limit=args.limit,
            offset=0,
        )

        results = []

        for batch in batches:
            medicine = await self.medicines.get(
                self.pharmacy_id,
                batch.medicine_id,
            )

            results.append(
                {
                    "batch_id": str(batch.id),
                    "batch_number": batch.batch_number,
                    "medicine_name": (
                        medicine.brand_name
                        if medicine is not None
                        else "Inactive medicine"
                    ),
                    "expires_at": batch.expires_at.isoformat(),
                    "quantity_on_hand": batch.quantity_on_hand,
                    "days_until_expiry": (batch.expires_at - date.today()).days,
                }
            )

        return {
            "as_of": date.today().isoformat(),
            "days": args.days,
            "count": len(results),
            "batches": results,
        }
