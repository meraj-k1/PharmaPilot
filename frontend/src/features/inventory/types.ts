
export type StockItem = {
  id: string;
  medicine_id: string;
  medicine_name: string;
  batch_number: string;
  quantity: number;
  reorder_level: number | null;
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

export const INVENTORY_PAGE_SIZE = 25;
