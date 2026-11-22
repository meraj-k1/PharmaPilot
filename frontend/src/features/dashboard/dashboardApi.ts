
import { getMedicines } from "../medicines/medicineApi";
import { getInventory, getLowStock, getExpiringBatches } from "../inventory/inventoryApi";
import { getSuppliers } from "../suppliers/supplierApi";
import { getPurchases } from "../purchases/purchaseApi";

import type { Medicine } from "../medicines/types";
import type { StockItem } from "../inventory/types";
import type { Supplier } from "../suppliers/types";
import type { PurchaseRecord } from "../purchases/types";

export type Dataset<T> = {
  data: T[];
  error: string | null;
};

export type DashboardData = {
  medicines: Dataset<Medicine>;
  inventory: Dataset<StockItem>;
  lowStock: Dataset<StockItem>;
  expiring: Dataset<StockItem>;
  suppliers: Dataset<Supplier>;
  purchases: Dataset<PurchaseRecord>;
  updatedAt: string;
};

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load data.";
}

function unwrap<T>(
  result: PromiseSettledResult<T[]>
): Dataset<T> {
  if (result.status === "fulfilled") {
    return {
      data: result.value,
      error: null,
    };
  }

  return {
    data: [],
    error: getMessage(result.reason),
  };
}

export async function loadDashboard():
  Promise<DashboardData> {
  const results = await Promise.allSettled([
    getMedicines(),
    getInventory(),
    getLowStock(),
    getExpiringBatches(30),
    getSuppliers(),
    getPurchases(),
  ] as const);

  return {
    medicines: unwrap(results[0]),
    inventory: unwrap(results[1]),
    lowStock: unwrap(results[2]),
    expiring: unwrap(results[3]),
    suppliers: unwrap(results[4]),
    purchases: unwrap(results[5]),
    updatedAt: new Date().toISOString(),
  };
}
