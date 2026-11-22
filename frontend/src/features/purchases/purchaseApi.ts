
import { api } from "../../lib/api";

import type {
  MedicineOption,
  Purchase,
  PurchaseCreatePayload,
  ReceivePayload,
  SupplierOption,
} from "./types";

const ENDPOINT = "/purchases";

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
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function unwrap(payload: unknown): JsonRecord {
  if (!isRecord(payload)) {
    throw new Error("Unexpected API response.");
  }

  return isRecord(payload.data)
    ? payload.data
    : payload;
}

function extractItems(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    throw new Error("Unexpected list response.");
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

  throw new Error("API response has no supported list.");
}

function normalizePurchase(value: unknown): Purchase {
  const data = unwrap(value);

  if (!Array.isArray(data.items)) {
    throw new Error("Invalid purchase items response.");
  }

  return {
    id: asString(data.id),
    pharmacy_id: asString(data.pharmacy_id),
    supplier_id: asString(data.supplier_id),
    order_number: asString(data.order_number),
    status: asString(data.status),
    total_amount: asString(data.total_amount),
    created_by: asString(data.created_by),
    received_at:
      typeof data.received_at === "string"
        ? data.received_at
        : null,
    items: data.items.filter(isRecord).map((item) => ({
      id: asString(item.id),
      medicine_id: asString(item.medicine_id),
      quantity: asNumber(item.quantity),
      unit_cost: asString(item.unit_cost),
    })),
  };
}

export async function getPurchases(
  limit = 100,
  offset = 0
): Promise<Purchase[]> {
  const response = await api.get<unknown>(ENDPOINT, {
    params: { limit, offset },
  });

  return extractItems(response.data).map(
    normalizePurchase
  );
}

export async function getPurchase(
  purchaseId: string
): Promise<Purchase> {
  const response = await api.get<unknown>(
    `${ENDPOINT}/${purchaseId}`
  );

  return normalizePurchase(response.data);
}

export async function createPurchase(
  payload: PurchaseCreatePayload
): Promise<Purchase> {
  const response = await api.post<unknown>(
    ENDPOINT,
    payload,
    { timeout: 30000 }
  );

  return normalizePurchase(response.data);
}

export async function receivePurchase(
  purchaseId: string,
  payload: ReceivePayload
): Promise<Purchase> {
  const response = await api.post<unknown>(
    `${ENDPOINT}/${purchaseId}/receive`,
    payload,
    { timeout: 30000 }
  );

  return normalizePurchase(response.data);
}

export async function getPurchaseSuppliers():
  Promise<SupplierOption[]> {
  const response = await api.get<unknown>(
    "/suppliers",
    { params: { limit: 100, offset: 0 } }
  );

  return extractItems(response.data)
    .filter((item) => item.is_active !== false)
    .map((item) => ({
      id: asString(item.id),
      name: asString(item.name),
    }));
}

export async function getPurchaseMedicines():
  Promise<MedicineOption[]> {
  const response = await api.get<unknown>(
    "/medicines",
    { params: { limit: 100, offset: 0 } }
  );

  return extractItems(response.data)
    .filter((item) => item.is_active !== false)
    .map((item) => ({
      id: asString(item.id),
      brand_name: asString(item.brand_name),
      sku: asString(item.sku),
      strength: asString(item.strength),
    }));
}
