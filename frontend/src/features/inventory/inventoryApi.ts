
import { api } from "../../lib/api";

import type {
  InventoryPageResult,
  InventorySummary,
  StockItem,
} from "./types";

export const ENDPOINTS = {
  inventory: "/inventory/batches",
  summary: "/inventory/summary",
  lowStock: "/inventory/low-stock",
  expiring: "/inventory/expiring",
  movements: "/inventory/movements",
  medicines: "/medicines",
} as const;

type JsonRecord = Record<string, unknown>;

type MedicineInfo = {
  name: string;
  sku: string;
  reorderLevel: number | null;
};

const medicineCache = new Map<
  string,
  {
    expires: number;
    data: Map<string, MedicineInfo>;
  }
>();

function isRecord(value: unknown): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function numberValue(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateValue(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function extractRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    for (const item of [
      payload.items,
      payload.results,
      payload.data,
    ]) {
      if (Array.isArray(item)) {
        return item.filter(isRecord);
      }
    }

    if (isRecord(payload.data)) {
      for (const item of [
        payload.data.items,
        payload.data.results,
      ]) {
        if (Array.isArray(item)) {
          return item.filter(isRecord);
        }
      }
    }
  }

  throw new Error(
    "Unexpected API response: expected a list."
  );
}

async function medicineLookup(): Promise<
  Map<string, MedicineInfo>
> {
  const pharmacyId =
    sessionStorage.getItem(
      "pharmapilot_pharmacy_id"
    ) || "";

  const cached = medicineCache.get(pharmacyId);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const lookup = new Map<string, MedicineInfo>();
  const pageSize = 100;

  for (let page = 0; page < 100; page++) {
    const { data } = await api.get<unknown>(
      ENDPOINTS.medicines,
      {
        params: {
          limit: pageSize,
          offset: page * pageSize,
        },
      }
    );

    const rows = extractRows(data);

    for (const medicine of rows) {
      const id = stringValue(medicine.id);
      if (!id) continue;

      lookup.set(id, {
        name:
          stringValue(medicine.brand_name) ||
          `Medicine ${id.slice(0, 8)}`,
        sku: stringValue(medicine.sku),
        reorderLevel: nullableNumber(
          medicine.reorder_level
        ),
      });
    }

    if (rows.length < pageSize) break;
  }

  medicineCache.set(pharmacyId, {
    expires: Date.now() + 30_000,
    data: lookup,
  });

  return lookup;
}

function normalizeBatch(
  raw: JsonRecord,
  index: number,
  lookup: Map<string, MedicineInfo>
): StockItem {
  const medicine = isRecord(raw.medicine)
    ? raw.medicine
    : null;

  const medicineId = stringValue(
    raw.medicine_id ?? medicine?.id
  );

  const info = lookup.get(medicineId);

  return {
    id:
      stringValue(raw.id ?? raw.batch_id) ||
      `batch-${index}`,

    source: "batch",

    medicine_id: medicineId,

    medicine_name:
      stringValue(
        raw.medicine_name ??
          raw.brand_name ??
          medicine?.brand_name
      ) ||
      info?.name ||
      `Medicine ${medicineId.slice(0, 8)}`,

    sku:
      stringValue(raw.sku ?? medicine?.sku) ||
      info?.sku ||
      "",

    batch_number: stringValue(
      raw.batch_number ??
        raw.batch_no ??
        raw.lot_number
    ),

    quantity: numberValue(
      raw.quantity_on_hand ?? raw.quantity
    ),

    reorder_level:
      nullableNumber(
        raw.reorder_level ??
          medicine?.reorder_level
      ) ??
      info?.reorderLevel ??
      null,

    shortage: null,

    expiry_date: dateValue(
      raw.expires_at ??
        raw.expiry_date ??
        raw.expiration_date
    ),
  };
}

function normalizeLowStock(
  raw: JsonRecord,
  index: number
): StockItem {
  const medicineId = stringValue(
    raw.medicine_id
  );

  return {
    id: `low-${medicineId || index}`,
    source: "low-stock",
    medicine_id: medicineId,
    medicine_name:
      stringValue(raw.brand_name) ||
      "Unknown medicine",
    sku: stringValue(raw.sku),
    batch_number: "",
    quantity: numberValue(
      raw.quantity_on_hand
    ),
    reorder_level: nullableNumber(
      raw.reorder_level
    ),
    shortage: numberValue(raw.shortage),
    expiry_date: null,
  };
}

async function fetchBatches(
  endpoint: string,
  params: Record<string, number>
): Promise<StockItem[]> {
  const { data } = await api.get<unknown>(
    endpoint,
    { params }
  );

  const rows = extractRows(data);
  if (rows.length === 0) return [];

  let lookup = new Map<string, MedicineInfo>();

  try {
    lookup = await medicineLookup();
  } catch {
    // Batch loading can continue without enrichment.
  }

  return rows.map((row, index) =>
    normalizeBatch(row, index, lookup)
  );
}

async function paginated(
  endpoint: string,
  page: number,
  limit: number,
  extra: Record<string, number> = {}
): Promise<InventoryPageResult> {
  const safePage = Math.max(
    1,
    Math.floor(page)
  );

  const safeLimit = Math.min(
    100,
    Math.max(1, Math.floor(limit))
  );

  const offset =
    (safePage - 1) * safeLimit;

  const requestLimit = Math.min(
    100,
    safeLimit + 1
  );

  const records = await fetchBatches(
    endpoint,
    {
      ...extra,
      limit: requestLimit,
      offset,
    }
  );

  let hasMore =
    records.length > safeLimit;

  if (
    safeLimit === 100 &&
    records.length === 100
  ) {
    const { data } = await api.get<unknown>(
      endpoint,
      {
        params: {
          ...extra,
          limit: 1,
          offset: offset + safeLimit,
        },
      }
    );

    hasMore = extractRows(data).length > 0;
  }

  return {
    items: records.slice(0, safeLimit),
    hasMore,
  };
}

export function getInventoryPage(
  page = 1,
  limit = 25
): Promise<InventoryPageResult> {
  return paginated(
    ENDPOINTS.inventory,
    page,
    limit
  );
}

export function getExpiringPage(
  days = 30,
  page = 1,
  limit = 25
): Promise<InventoryPageResult> {
  return paginated(
    ENDPOINTS.expiring,
    page,
    limit,
    {
      days: Math.min(
        3650,
        Math.max(0, Math.floor(days))
      ),
    }
  );
}

export async function getLowStock():
  Promise<StockItem[]> {
  const { data } = await api.get<unknown>(
    ENDPOINTS.lowStock
  );

  return extractRows(data).map(
    normalizeLowStock
  );
}

export async function getInventory():
  Promise<StockItem[]> {
  return (
    await getInventoryPage(1, 100)
  ).items;
}

export async function getExpiringBatches(
  days: number
): Promise<StockItem[]> {
  return (
    await getExpiringPage(days, 1, 100)
  ).items;
}

export async function getInventorySummary():
  Promise<InventorySummary> {
  const { data } = await api.get<unknown>(
    ENDPOINTS.summary
  );

  if (!isRecord(data)) {
    throw new Error(
      "Invalid inventory summary response."
    );
  }

  return {
    total_medicines: numberValue(
      data.total_medicines
    ),
    total_batches: numberValue(
      data.total_batches
    ),
    total_units: numberValue(
      data.total_units
    ),
    stock_value: numberValue(
      data.stock_value
    ),
    expiring_units: numberValue(
      data.expiring_units
    ),
  };
}

// POST: existing batch stock adjustment.
// Backend restricts this operation to pharmacy admins.
export async function adjustStock(
  batchId: string,
  quantityDelta: number,
  reason: string
): Promise<void> {
  await api.post(
    `${ENDPOINTS.inventory}/${
      encodeURIComponent(batchId)
    }/adjustments`,
    {
      quantity_delta: quantityDelta,
      reason: reason.trim(),
    }
  );
}

export type StockMovement = {
  id: string;
  batch_id: string;
  movement_type: string;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  created_at: string | null;
};

export async function getStockMovements(
  batchId: string,
  limit = 50,
  offset = 0
): Promise<StockMovement[]> {
  const { data } = await api.get<unknown>(
    ENDPOINTS.movements,
    {
      params: {
        batch_id: batchId,
        limit,
        offset,
      },
    }
  );

  return extractRows(data).map(
    (row, index) => ({
      id:
        stringValue(row.id) ||
        `movement-${index}`,

      batch_id: stringValue(
        row.batch_id
      ),

      movement_type: stringValue(
        row.movement_type
      ),

      quantity_delta: numberValue(
        row.quantity_delta
      ),

      quantity_before: numberValue(
        row.quantity_before
      ),

      quantity_after: numberValue(
        row.quantity_after
      ),

      reason: stringValue(
        row.reason
      ),

      created_at: dateValue(
        row.created_at
      ),
    })
  );
}
