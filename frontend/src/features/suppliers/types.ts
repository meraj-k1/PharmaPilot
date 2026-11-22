
export type Supplier = {
  id: string;
  pharmacy_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
};

export type SupplierFormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

export const EMPTY_SUPPLIER_FORM: SupplierFormValues = {
  name: "",
  phone: "",
  email: "",
  address: "",
};
