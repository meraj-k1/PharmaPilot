
export type StockItem = {
  id: string;
  source: "batch" | "low-stock";
  medicine_id: string;
  medicine_name: string;
  sku: string;
  batch_number: string;
  quantity: number;
  reorder_level: number | null;
  shortage: number | null;
  expiry_date: string | null;
};

export type InventoryTab =
  | "all"
  | "low-stock"
  | "expiring";

export type StockStatus =
  | "healthy"
  | "low"
  | "out"
  | "expiring"
  | "expired";

export type InventorySort =
  | "name-asc"
  | "name-desc"
  | "quantity-asc"
  | "quantity-desc"
  | "expiry-asc"
  | "expiry-desc";

export type InventoryPageResult = {
  items: StockItem[];
  hasMore: boolean;
};

export type InventorySummary = {
  total_medicines: number;
  total_batches: number;
  total_units: number;
  stock_value: number;
  expiring_units: number;
};

export const INVENTORY_PAGE_SIZE = 25;
