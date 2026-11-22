
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { AxiosError } from "axios";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import {
  createPurchase,
  getPurchaseMedicines,
  getPurchaseSuppliers,
  getPurchases,
  receivePurchase,
} from "./purchaseApi";

import type {
  MedicineOption,
  Purchase,
  PurchaseDraftItem,
  ReceiveDraftLine,
  SupplierOption,
} from "./types";

import "./purchases.css";

type Notice = {
  type: "success" | "error";
  message: string;
};

function newItem(): PurchaseDraftItem {
  return {
    key: crypto.randomUUID(),
    medicine_id: "",
    quantity: "1",
    unit_cost: "",
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      return "Session expired. Please log in again.";
    }

    if (status === 403) {
      return "Only an authorized pharmacy admin can perform this action.";
    }

    if (status === 404) {
      return "Purchase API resource not found.";
    }

    if (status === 409) {
      return typeof data?.detail === "string"
        ? data.detail
        : "This operation conflicts with the current purchase status.";
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: { loc?: unknown[]; msg?: string }) => {
          const path = Array.isArray(item.loc)
            ? item.loc.join(".")
            : "";

          return `${path}: ${item.msg ?? "Invalid value"}`;
        })
        .join("; ");
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    return error.message || "Request failed.";
  }

  return error instanceof Error
    ? error.message
    : "Unexpected error occurred.";
}

function money(value: number | string): string {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function today(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isValidCost(value: string): boolean {
  return /^\d{1,10}(\.\d{1,2})?$/.test(value) &&
    Number.isFinite(Number(value));
}

function getStatusClass(status: string): string {
  const value = status.toLowerCase();

  if (value === "received") return "received";
  if (value === "cancelled" || value === "canceled") {
    return "cancelled";
  }

  return "pending";
}

function PurchaseForm({
  suppliers,
  medicines,
  saving,
  error,
  onClose,
  onSave,
}: {
  suppliers: SupplierOption[];
  medicines: MedicineOption[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (
    supplierId: string,
    items: PurchaseDraftItem[]
  ) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<PurchaseDraftItem[]>([
    newItem(),
  ]);
  const [validation, setValidation] = useState("");

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          (Number(line.quantity) || 0) *
            (Number(line.unit_cost) || 0),
        0
      ),
    [lines]
  );

  function updateLine(
    key: string,
    field: "medicine_id" | "quantity" | "unit_cost",
    value: string
  ) {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? { ...line, [field]: value }
          : line
      )
    );
    setValidation("");
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.filter((line) => line.key !== key)
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supplierId) {
      setValidation("Select a supplier.");
      return;
    }

    if (lines.length < 1 || lines.length > 100) {
      setValidation("Add between 1 and 100 items.");
      return;
    }

    const used = new Set<string>();

    for (const line of lines) {
      if (!line.medicine_id) {
        setValidation("Select a medicine for every item.");
        return;
      }

      if (used.has(line.medicine_id)) {
        setValidation(
          "The same medicine is selected more than once. Combine the quantities."
        );
        return;
      }

      used.add(line.medicine_id);

      const quantity = Number(line.quantity);

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 1_000_000
      ) {
        setValidation(
          "Quantity must be between 1 and 1,000,000."
        );
        return;
      }

      if (!isValidCost(line.unit_cost.trim())) {
        setValidation(
          "Unit cost must be a valid non-negative amount with up to 2 decimal places."
        );
        return;
      }
    }

    setValidation("");
    await onSave(supplierId, lines);
  }

  return (
    <form className="purchase-form" onSubmit={(event) => void submit(event)}>
      <label className="purchase-field">
        <span>Supplier *</span>
        <select
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          disabled={saving}
          required
        >
          <option value="">Select supplier</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>

      <div className="purchase-section-heading">
        <div>
          <h3>Purchase items</h3>
          <p>Choose medicines, quantities and unit costs.</p>
        </div>

        <button
          type="button"
          className="purchase-btn secondary"
          onClick={() =>
            setLines((current) => [...current, newItem()])
          }
          disabled={saving || lines.length >= 100}
        >
          <Plus size={16} />
          Add item
        </button>
      </div>

      <div className="purchase-items">
        {lines.map((line, index) => (
          <div className="purchase-item-card" key={line.key}>
            <div className="purchase-item-heading">
              <strong>Item {index + 1}</strong>

              <button
                type="button"
                className="purchase-icon-button danger"
                disabled={saving || lines.length === 1}
                onClick={() => removeLine(line.key)}
                aria-label="Remove item"
              >
                <Trash2 size={17} />
              </button>
            </div>

            <div className="purchase-form-grid">
              <label className="purchase-field purchase-full">
                <span>Medicine *</span>
                <select
                  value={line.medicine_id}
                  onChange={(event) =>
                    updateLine(
                      line.key,
                      "medicine_id",
                      event.target.value
                    )
                  }
                  disabled={saving}
                  required
                >
                  <option value="">Select medicine</option>

                  {medicines.map((medicine) => (
                    <option
                      key={medicine.id}
                      value={medicine.id}
                    >
                      {medicine.brand_name}
                      {medicine.strength
                        ? ` - ${medicine.strength}`
                        : ""}
                      {medicine.sku
                        ? ` (${medicine.sku})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="purchase-field">
                <span>Quantity *</span>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                  value={line.quantity}
                  disabled={saving}
                  onChange={(event) =>
                    updateLine(
                      line.key,
                      "quantity",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="purchase-field">
                <span>Unit cost *</span>
                <input
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={line.unit_cost}
                  disabled={saving}
                  onChange={(event) =>
                    updateLine(
                      line.key,
                      "unit_cost",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            <div className="purchase-line-total">
              Line total: <strong>{money(
                (Number(line.quantity) || 0) *
                  (Number(line.unit_cost) || 0)
              )}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="purchase-total">
        <span>Estimated order total</span>
        <strong>{money(total)}</strong>
      </div>

      {(validation || error) && (
        <div className="purchase-notice error" role="alert">
          <AlertCircle size={18} />
          <span>{validation || error}</span>
        </div>
      )}

      <div className="purchase-form-actions">
        <button
          type="button"
          className="purchase-btn secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="purchase-btn primary"
          disabled={saving || suppliers.length === 0 || medicines.length === 0}
        >
          {saving ? (
            <Loader2 size={17} className="purchase-spin" />
          ) : (
            <ShoppingCart size={17} />
          )}
          {saving ? "Submitting..." : "Submit Purchase"}
        </button>
      </div>
    </form>
  );
}

function ReceiveForm({
  purchase,
  medicines,
  saving,
  error,
  onClose,
  onSave,
}: {
  purchase: Purchase;
  medicines: MedicineOption[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (lines: ReceiveDraftLine[]) => Promise<void>;
}) {
  const [lines, setLines] = useState<ReceiveDraftLine[]>(
    purchase.items.map((item) => ({
      purchase_order_item_id: item.id,
      medicine_id: item.medicine_id,
      batch_number: "",
      manufactured_at: "",
      expires_at: "",
    }))
  );

  const [validation, setValidation] = useState("");

  function updateLine(
    itemId: string,
    field: "batch_number" | "manufactured_at" | "expires_at",
    value: string
  ) {
    setLines((current) =>
      current.map((line) =>
        line.purchase_order_item_id === itemId
          ? { ...line, [field]: value }
          : line
      )
    );
    setValidation("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    for (const line of lines) {
      if (
        !line.batch_number.trim() ||
        line.batch_number.trim().length > 100
      ) {
        setValidation(
          "Enter a batch number (maximum 100 characters) for every item."
        );
        return;
      }

      if (!line.expires_at) {
        setValidation("Expiry date is required for every item.");
        return;
      }

      if (
        line.manufactured_at &&
        line.manufactured_at >= line.expires_at
      ) {
        setValidation(
          "Expiry date must be after manufacturing date."
        );
        return;
      }

      if (line.expires_at <= today()) {
        setValidation(
          "Expiry date must be in the future."
        );
        return;
      }
    }

    setValidation("");
    await onSave(lines);
  }

  return (
    <form
      className="purchase-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="purchase-receive-intro">
        <strong>{purchase.order_number}</strong>
        <p>
          Enter batch numbers and expiry dates to
          receive this purchase into inventory.
        </p>
      </div>

      <div className="purchase-items">
        {lines.map((line, index) => {
          const medicine = medicines.find(
            (item) => item.id === line.medicine_id
          );

          const orderItem = purchase.items.find(
            (item) =>
              item.id === line.purchase_order_item_id
          );

          return (
            <div
              className="purchase-item-card"
              key={line.purchase_order_item_id}
            >
              <div className="purchase-item-heading">
                <div>
                  <strong>
                    {medicine?.brand_name ||
                      `Medicine ${index + 1}`}
                  </strong>
                  <p>
                    Ordered quantity:{" "}
                    {orderItem?.quantity ?? "—"}
                  </p>
                </div>
              </div>

              <div className="purchase-form-grid">
                <label className="purchase-field purchase-full">
                  <span>Batch number *</span>
                  <input
                    value={line.batch_number}
                    maxLength={100}
                    required
                    placeholder="Enter batch number"
                    disabled={saving}
                    onChange={(event) =>
                      updateLine(
                        line.purchase_order_item_id,
                        "batch_number",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="purchase-field">
                  <span>Manufacturing date</span>
                  <input
                    type="date"
                    value={line.manufactured_at}
                    disabled={saving}
                    onChange={(event) =>
                      updateLine(
                        line.purchase_order_item_id,
                        "manufactured_at",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="purchase-field">
                  <span>Expiry date *</span>
                  <input
                    type="date"
                    value={line.expires_at}
                    required
                    disabled={saving}
                    onChange={(event) =>
                      updateLine(
                        line.purchase_order_item_id,
                        "expires_at",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {(validation || error) && (
        <div className="purchase-notice error" role="alert">
          <AlertCircle size={18} />
          <span>{validation || error}</span>
        </div>
      )}

      <div className="purchase-form-actions">
        <button
          type="button"
          className="purchase-btn secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="purchase-btn primary"
          disabled={saving || lines.length === 0}
        >
          {saving ? (
            <Loader2 size={17} className="purchase-spin" />
          ) : (
            <ClipboardCheck size={17} />
          )}
          {saving ? "Receiving..." : "Receive Purchase"}
        </button>
      </div>
    </form>
  );
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<Purchase | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Purchase | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setListError(null);

    const results = await Promise.allSettled([
      getPurchases(),
      getPurchaseSuppliers(),
      getPurchaseMedicines(),
    ]);

    if (results[0].status === "fulfilled") {
      setPurchases(results[0].value);
    } else {
      setListError(errorMessage(results[0].reason));
    }

    if (results[1].status === "fulfilled") {
      setSuppliers(results[1].value);
    } else {
      setListError((current) =>
        current ??
        `Suppliers: ${errorMessage(results[1].reason)}`
      );
    }

    if (results[2].status === "fulfilled") {
      setMedicines(results[2].value);
    } else {
      setListError((current) =>
        current ??
        `Medicines: ${errorMessage(results[2].reason)}`
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const supplierNames = useMemo(
    () =>
      new Map(
        suppliers.map((supplier) => [
          supplier.id,
          supplier.name,
        ])
      ),
    [suppliers]
  );

  const medicineNames = useMemo(
    () =>
      new Map(
        medicines.map((medicine) => [
          medicine.id,
          medicine.brand_name,
        ])
      ),
    [medicines]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return purchases;

    return purchases.filter((purchase) => {
      const text = [
        purchase.order_number,
        purchase.status,
        purchase.id,
        supplierNames.get(purchase.supplier_id) ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [purchases, search, supplierNames]);

  const stats = useMemo(() => {
    const received = purchases.filter(
      (purchase) =>
        purchase.status.toLowerCase() === "received"
    ).length;

    return {
      total: purchases.length,
      received,
      awaiting: purchases.length - received,
      value: purchases.reduce(
        (sum, purchase) =>
          sum + (Number(purchase.total_amount) || 0),
        0
      ),
    };
  }, [purchases]);

  async function submitPurchase(
    supplierId: string,
    lines: PurchaseDraftItem[]
  ) {
    if (saving) return;

    setSaving(true);
    setFormError(null);

    try {
      const purchase = await createPurchase({
        supplier_id: supplierId,
        items: lines.map((line) => ({
          medicine_id: line.medicine_id,
          quantity: Number(line.quantity),
          unit_cost: Number(line.unit_cost).toFixed(2),
        })),
      });

      setCreateOpen(false);
      setNotice({
        type: "success",
        message: `Purchase ${purchase.order_number} created successfully.`,
      });
      await loadData();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitReceive(lines: ReceiveDraftLine[]) {
    if (!receiveTarget || saving) return;

    setSaving(true);
    setFormError(null);

    try {
      const updated = await receivePurchase(
        receiveTarget.id,
        {
          items: lines.map((line) => ({
            purchase_order_item_id:
              line.purchase_order_item_id,
            batch_number: line.batch_number.trim(),
            manufactured_at:
              line.manufactured_at || null,
            expires_at: line.expires_at,
          })),
        }
      );

      setReceiveTarget(null);
      setNotice({
        type: "success",
        message: `Purchase ${updated.order_number} received successfully.`,
      });
      await loadData();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="purchases-page">
      <header className="purchase-page-header">
        <div>
          <span className="purchase-eyebrow">
            PHARMACY OPERATIONS
          </span>
          <h1>Purchase Management</h1>
          <p>
            Create purchase orders, track supplier
            purchases and receive stock batches.
          </p>
        </div>

        <div className="purchase-header-actions">
          <button
            type="button"
            className="purchase-btn secondary"
            disabled={loading}
            onClick={() => void loadData()}
          >
            <RefreshCw
              size={17}
              className={loading ? "purchase-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="purchase-btn primary"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            <Plus size={18} />
            New Purchase
          </button>
        </div>
      </header>

      {notice && (
        <div className={`purchase-notice ${notice.type}`} role="status">
          {notice.type === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertCircle size={19} />
          )}
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {listError && (
        <div className="purchase-notice error" role="alert">
          <AlertCircle size={19} />
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => void loadData()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="purchase-stats">
        <div className="purchase-stat-card">
          <ShoppingCart size={22} />
          <div>
            <span>Loaded Purchases</span>
            <strong>{stats.total}</strong>
            <small>First 100 records</small>
          </div>
        </div>

        <div className="purchase-stat-card">
          <CheckCircle2 size={22} />
          <div>
            <span>Received</span>
            <strong>{stats.received}</strong>
            <small>Completed orders</small>
          </div>
        </div>

        <div className="purchase-stat-card">
          <Truck size={22} />
          <div>
            <span>Other Statuses</span>
            <strong>{stats.awaiting}</strong>
            <small>Not marked received</small>
          </div>
        </div>

        <div className="purchase-stat-card">
          <PackagePlus size={22} />
          <div>
            <span>Purchase Value</span>
            <strong>{money(stats.value)}</strong>
            <small>Loaded orders only</small>
          </div>
        </div>
      </div>

      <section className="purchase-panel">
        <div className="purchase-panel-header">
          <div>
            <h2>Purchase Orders</h2>
            <p>{filtered.length} orders shown</p>
          </div>

          <label className="purchase-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search orders or suppliers..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>
        </div>

        {loading ? (
          <div className="purchase-empty">
            <Loader2 size={30} className="purchase-spin" />
            <p>Loading purchases...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="purchase-empty">
            <ShoppingCart size={36} />
            <h3>No purchases found</h3>
            <p>
              Create a purchase order to start
              managing incoming pharmacy stock.
            </p>
          </div>
        ) : (
          <div className="purchase-table-scroll">
            <table className="purchase-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Received At</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <strong className="purchase-order-number">
                        {purchase.order_number}
                      </strong>
                    </td>
                    <td>
                      {supplierNames.get(
                        purchase.supplier_id
                      ) || purchase.supplier_id.slice(0, 8)}
                    </td>
                    <td>{purchase.items.length}</td>
                    <td>
                      <strong>
                        {money(purchase.total_amount)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`purchase-status ${getStatusClass(purchase.status)}`}
                      >
                        {purchase.status}
                      </span>
                    </td>
                    <td>{formatDate(purchase.received_at)}</td>
                    <td>
                      <div className="purchase-actions">
                        <button
                          type="button"
                          className="purchase-icon-button"
                          title="View details"
                          onClick={() =>
                            setDetailsTarget(purchase)
                          }
                        >
                          <Eye size={17} />
                        </button>

                        {purchase.status.toLowerCase() === "pending" && (
                          <button
                            type="button"
                            className="purchase-btn receive"
                            onClick={() => {
                              setFormError(null);
                              setReceiveTarget(purchase);
                            }}
                          >
                            <ClipboardCheck size={16} />
                            Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="purchase-modal-backdrop">
          <section
            className="purchase-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-create-title"
          >
            <div className="purchase-modal-header">
              <div>
                <h2 id="purchase-create-title">
                  Create Purchase Order
                </h2>
                <p>Supplier and medicine item details</p>
              </div>
              <button
                type="button"
                className="purchase-icon-button"
                disabled={saving}
                onClick={() => setCreateOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <PurchaseForm
              suppliers={suppliers}
              medicines={medicines}
              saving={saving}
              error={formError}
              onClose={() => setCreateOpen(false)}
              onSave={submitPurchase}
            />
          </section>
        </div>
      )}

      {receiveTarget && (
        <div className="purchase-modal-backdrop">
          <section
            className="purchase-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-receive-title"
          >
            <div className="purchase-modal-header">
              <div>
                <h2 id="purchase-receive-title">
                  Receive Purchase
                </h2>
                <p>
                  Enter batch details for each item
                </p>
              </div>
              <button
                type="button"
                className="purchase-icon-button"
                disabled={saving}
                onClick={() =>
                  setReceiveTarget(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            <ReceiveForm
              key={receiveTarget.id}
              purchase={receiveTarget}
              medicines={medicines}
              saving={saving}
              error={formError}
              onClose={() => setReceiveTarget(null)}
              onSave={submitReceive}
            />
          </section>
        </div>
      )}

      {detailsTarget && (
        <div className="purchase-modal-backdrop">
          <section
            className="purchase-modal purchase-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-details-title"
          >
            <div className="purchase-modal-header">
              <div>
                <h2 id="purchase-details-title">
                  {detailsTarget.order_number}
                </h2>
                <p>Purchase order information</p>
              </div>
              <button
                type="button"
                className="purchase-icon-button"
                onClick={() => setDetailsTarget(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="purchase-details-content">
              <div className="purchase-detail-line">
                <span>Supplier</span>
                <strong>
                  {supplierNames.get(
                    detailsTarget.supplier_id
                  ) || detailsTarget.supplier_id}
                </strong>
              </div>

              <div className="purchase-detail-line">
                <span>Status</span>
                <strong>{detailsTarget.status}</strong>
              </div>

              <div className="purchase-detail-line">
                <span>Total</span>
                <strong>
                  {money(detailsTarget.total_amount)}
                </strong>
              </div>

              <div className="purchase-detail-line">
                <span>Received</span>
                <strong>
                  {formatDate(detailsTarget.received_at)}
                </strong>
              </div>

              <h3>Order items</h3>

              {detailsTarget.items.map((item) => (
                <div
                  className="purchase-detail-item"
                  key={item.id}
                >
                  <strong>
                    {medicineNames.get(item.medicine_id) ||
                      item.medicine_id}
                  </strong>
                  <span>
                    {item.quantity} × {money(item.unit_cost)}
                  </span>
                  <strong>
                    {money(
                      item.quantity *
                        Number(item.unit_cost)
                    )}
                  </strong>
                </div>
              ))}
            </div>

            <div className="purchase-form-actions purchase-details-footer">
              <button
                type="button"
                className="purchase-btn secondary"
                onClick={() => setDetailsTarget(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
