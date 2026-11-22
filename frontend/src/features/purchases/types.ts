
export type PurchaseItem = {
  id: string;
  medicine_id: string;
  quantity: number;
  unit_cost: string;
};

export type Purchase = {
  id: string;
  pharmacy_id: string;
  supplier_id: string;
  order_number: string;
  status: string;
  total_amount: string;
  created_by: string;
  received_at: string | null;
  items: PurchaseItem[];
};

export type PurchaseCreateItem = {
  medicine_id: string;
  quantity: number;
  unit_cost: string;
};

export type PurchaseCreatePayload = {
  supplier_id: string;
  items: PurchaseCreateItem[];
};

export type ReceiveLine = {
  purchase_order_item_id: string;
  batch_number: string;
  manufactured_at: string | null;
  expires_at: string;
};

export type ReceivePayload = {
  items: ReceiveLine[];
};

export type SupplierOption = {
  id: string;
  name: string;
};

export type MedicineOption = {
  id: string;
  brand_name: string;
  sku: string;
  strength: string;
};

export type PurchaseDraftItem = {
  key: string;
  medicine_id: string;
  quantity: string;
  unit_cost: string;
};

export type ReceiveDraftLine = {
  purchase_order_item_id: string;
  medicine_id: string;
  batch_number: string;
  manufactured_at: string;
  expires_at: string;
};
