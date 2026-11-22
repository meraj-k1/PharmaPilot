
import { api } from "../../lib/api";

import type {
  InventoryPageResult,
  StockItem,
} from "./types";

export const ENDPOINTS = {
  inventory: "/inventory/batches",
  summary: "/inventory/summary",
  lowStock: "/inventory/low-stock",
  expiring: "/inventory/expiring",
  movements: "/inventory/movements",
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function asNumber(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function nullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function nullableDate(
  value: unknown
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value
    : null;
}

function normalizeStockItem(
  raw: JsonRecord,
  index: number
): StockItem {
  const medicine = isRecord(raw.medicine)
    ? raw.medicine
    : null;

  const medicineId =
    raw.medicine_id ??
    medicine?.id ??
    "";

  const name =
    raw.medicine_name ??
    raw.brand_name ??
    medicine?.brand_name ??
    medicine?.name ??
    raw.name;

  const quantity =
    raw.quantity_on_hand ??
    raw.quantity ??
    raw.current_quantity ??
    raw.available_quantity ??
    raw.remaining_quantity;

  return {
    id:
      asString(
        raw.id ??
        raw.batch_id ??
        raw.medicine_id ??
        `item-${index}`
      ) || `item-${index}`,

    medicine_id: asString(medicineId),

    medicine_name:
      asString(name) || "Unknown medicine",

    batch_number: asString(
      raw.batch_number ??
      raw.batch_no ??
      raw.lot_number
    ),

    quantity: asNumber(quantity),

    reorder_level: nullableNumber(
      raw.reorder_level ??
      raw.minimum_stock ??
      raw.min_stock ??
      medicine?.reorder_level
    ),

    expiry_date: nullableDate(
      raw.expiry_date ??
      raw.expires_at ??
      raw.expiration_date
    ),
  };
}

function extractItems(
  payload: unknown
): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    throw new Error(
      "Invalid inventory API response."
    );
  }

  const candidates = [
    payload.items,
    payload.results,
    payload.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  if (isRecord(payload.data)) {
    for (const candidate of [
      payload.data.items,
      payload.data.results,
    ]) {
      if (Array.isArray(candidate)) {
        return candidate.filter(isRecord);
      }
    }
  }

  throw new Error(
    "Inventory response contains no supported list."
  );
}

async function fetchItems(
  endpoint: string,
  params?: Record<string, string | number>
): Promise<StockItem[]> {
  const response = await api.get<unknown>(
    endpoint,
    { params }
  );

  return extractItems(response.data).map(
    normalizeStockItem
  );
}

export async function getInventoryPage(
  page = 1,
  limit = 25
): Promise<InventoryPageResult> {
  const safeLimit = Math.min(
    100,
    Math.max(1, limit)
  );

  const safePage = Math.max(1, page);

  const items = await fetchItems(
    ENDPOINTS.inventory,
    {
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    }
  );

  return {
    items,
    hasMore: items.length === safeLimit,
  };
}

export async function getExpiringPage(
  days = 30,
  page = 1,
  limit = 25
): Promise<InventoryPageResult> {
  const safeLimit = Math.min(
    100,
    Math.max(1, limit)
  );

  const safePage = Math.max(1, page);

  const items = await fetchItems(
    ENDPOINTS.expiring,
    {
      days: Math.min(3650, Math.max(0, days)),
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    }
  );

  return {
    items,
    hasMore: items.length === safeLimit,
  };
}

export async function getLowStock():
  Promise<StockItem[]> {
  return fetchItems(
    ENDPOINTS.lowStock
  );
}

export async function getInventory():
  Promise<StockItem[]> {
  return fetchItems(
    ENDPOINTS.inventory,
    {
      limit: 100,
      offset: 0,
    }
  );
}

export async function getExpiringBatches(
  days: number
): Promise<StockItem[]> {
  return fetchItems(
    ENDPOINTS.expiring,
    {
      days,
      limit: 100,
      offset: 0,
    }
  );
}

export async function getInventorySummary():
  Promise<unknown> {
  const response = await api.get<unknown>(
    ENDPOINTS.summary
  );

  return response.data;
}
