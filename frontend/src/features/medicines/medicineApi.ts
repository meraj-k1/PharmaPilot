
import { api } from "../../lib/api";

import type {
  Medicine,
  MedicineFormValues,
} from "./types";

const MEDICINES_ENDPOINT = "/medicines";

type MedicinePayload = {
  sku: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  manufacturer: string | null;
  barcode: string | null;
  selling_price: string;
  reorder_level: number;
};

function buildPayload(
  values: MedicineFormValues
): MedicinePayload {
  return {
    sku: values.sku.trim(),
    brand_name: values.brand_name.trim(),
    generic_name: values.generic_name.trim(),
    strength: values.strength.trim(),
    dosage_form: values.dosage_form.trim(),
    manufacturer:
      values.manufacturer.trim() || null,
    barcode:
      values.barcode.trim() || null,
    selling_price: values.selling_price.trim(),
    reorder_level: values.reorder_level,
  };
}

export async function getMedicines(): Promise<Medicine[]> {
  const response = await api.get<unknown>(
    MEDICINES_ENDPOINT,
    {
      params: {
        limit: 100,
        offset: 0,
      },
    }
  );

  const payload = response.data;

  let records: unknown;

  if (Array.isArray(payload)) {
    records = payload;
  } else if (
    typeof payload === "object" &&
    payload !== null
  ) {
    const root = payload as Record<string, unknown>;
    const data =
      typeof root.data === "object" &&
      root.data !== null
        ? root.data as Record<string, unknown>
        : null;

    records =
      root.items ??
      root.results ??
      root.data ??
      data?.items;
  }

  if (!Array.isArray(records)) {
    throw new Error(
      "Unexpected medicine list response format."
    );
  }

  return records as Medicine[];
}

export async function createMedicine(
  values: MedicineFormValues
): Promise<void> {
  await api.post(
    MEDICINES_ENDPOINT,
    buildPayload(values)
  );
}

export async function updateMedicine(
  medicineId: string,
  values: MedicineFormValues
): Promise<void> {
  await api.patch(
    `${MEDICINES_ENDPOINT}/${medicineId}`,
    buildPayload(values)
  );
}

export async function deleteMedicine(
  medicineId: string
): Promise<void> {
  await api.delete(
    `${MEDICINES_ENDPOINT}/${medicineId}`
  );
}
