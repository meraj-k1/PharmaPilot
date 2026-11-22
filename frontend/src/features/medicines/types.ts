
export type Medicine = {
  id: string;
  pharmacy_id: string;
  sku: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  manufacturer: string | null;
  barcode: string | null;
  selling_price: string;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
};

export type MedicineFormValues = {
  sku: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  manufacturer: string;
  barcode: string;
  selling_price: string;
  reorder_level: number;
};

export const EMPTY_MEDICINE_FORM: MedicineFormValues = {
  sku: "",
  brand_name: "",
  generic_name: "",
  strength: "",
  dosage_form: "",
  manufacturer: "",
  barcode: "",
  selling_price: "",
  reorder_level: 10,
};
