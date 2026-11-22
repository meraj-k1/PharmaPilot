
import { api } from "../../lib/api";

import type {
  Supplier,
  SupplierFormValues,
} from "./types";

export const SUPPLIER_ENDPOINT = "/suppliers";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeSupplier(payload: unknown): Supplier {
  if (!isRecord(payload)) {
    throw new Error("Invalid supplier response.");
  }

  const data = isRecord(payload.data)
    ? payload.data
    : payload;

  return {
    id: asString(data.id),
    pharmacy_id: asString(data.pharmacy_id),
    name: asString(data.name),
    phone: asNullableString(data.phone),
    email: asNullableString(data.email),
    address: asNullableString(data.address),
    is_active: data.is_active === true,
    created_at: asString(data.created_at),
  };
}

function extractSuppliers(payload: unknown): Supplier[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeSupplier);
  }

  if (isRecord(payload)) {
    const candidates = [
      payload.items,
      payload.results,
      payload.data,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeSupplier);
      }
    }

    if (isRecord(payload.data)) {
      if (Array.isArray(payload.data.items)) {
        return payload.data.items.map(normalizeSupplier);
      }

      if (Array.isArray(payload.data.results)) {
        return payload.data.results.map(normalizeSupplier);
      }
    }
  }

  throw new Error(
    "Unexpected suppliers response format."
  );
}

function buildSupplierPayload(values: SupplierFormValues) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    address: values.address.trim() || null,
  };
}

export async function getSuppliers(): Promise<Supplier[]> {
  const response = await api.get<unknown>(
    SUPPLIER_ENDPOINT,
    {
      params: {
        limit: 100,
        offset: 0,
      },
    }
  );

  return extractSuppliers(response.data);
}

export async function createSupplier(
  values: SupplierFormValues
): Promise<Supplier> {
  const response = await api.post<unknown>(
    SUPPLIER_ENDPOINT,
    buildSupplierPayload(values)
  );

  return normalizeSupplier(response.data);
}

export async function updateSupplier(
  supplierId: string,
  values: SupplierFormValues
): Promise<Supplier> {
  const response = await api.patch<unknown>(
    `${SUPPLIER_ENDPOINT}/${supplierId}`,
    buildSupplierPayload(values)
  );

  return normalizeSupplier(response.data);
}

export async function deleteSupplier(
  supplierId: string
): Promise<void> {
  await api.delete(
    `${SUPPLIER_ENDPOINT}/${supplierId}`
  );
}
