
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
  getPurchase,
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

// ============================================================
// TYPES
// ============================================================

type Notice = {
  type: "success" | "error";
  message: string;
};

type PurchaseFormProps = {
  suppliers: SupplierOption[];
  medicines: MedicineOption[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (
    supplierId: string,
    items: PurchaseDraftItem[]
  ) => Promise<void>;
};

type ReceiveFormProps = {
  purchase: Purchase;
  medicines: MedicineOption[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (
    lines: ReceiveDraftLine[]
  ) => Promise<void>;
};

// ============================================================
// HELPERS
// ============================================================

function newItem(): PurchaseDraftItem {
  return {
    key: crypto.randomUUID(),
    medicine_id: "",
    quantity: "1",
    unit_cost: "",
  };
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

function formatDate(
  value: string | null | undefined
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
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

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isValidCost(value: string): boolean {
  return (
    /^\d{1,10}(\.\d{1,2})?$/.test(value) &&
    Number.isFinite(Number(value))
  );
}

function isDraft(status: string): boolean {
  return status.trim().toLowerCase() === "draft";
}

function isReceived(status: string): boolean {
  return status.trim().toLowerCase() === "received";
}

function getStatusClass(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === "received") {
    return "received";
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "cancelled";
  }

  return "pending";
}

function errorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data: unknown = error.response?.data;

    if (status === 401) {
      return "Session expired. Please log in again.";
    }

    if (status === 403) {
      return (
        "Only an authorized pharmacy admin " +
        "can perform this action."
      );
    }

    if (status === 404) {
      return "Purchase resource not found.";
    }

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
    ) {
      const payload = data as Record<string, unknown>;

      if (typeof payload.detail === "string") {
        return payload.detail;
      }

      if (Array.isArray(payload.detail)) {
        return payload.detail
          .map((entry: unknown) => {
            if (
              entry &&
              typeof entry === "object" &&
              "msg" in entry
            ) {
              const issue = entry as {
                loc?: unknown[];
                msg?: unknown;
              };

              const location = Array.isArray(issue.loc)
                ? issue.loc.join(".")
                : "";

              return `${location}: ${String(issue.msg ?? "Invalid value")}`;
            }

            return String(entry);
          })
          .join("; ");
      }

      if (
        payload.error &&
        typeof payload.error === "object" &&
        "message" in payload.error
      ) {
        const apiError = payload.error as {
          message?: unknown;
        };

        if (typeof apiError.message === "string") {
          return apiError.message;
        }
      }
    }

    if (status === 409) {
      return (
        "This purchase cannot be received " +
        "in its current status."
      );
    }

    return error.message || "Request failed.";
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

// ============================================================
// CREATE PURCHASE FORM
// ============================================================

function PurchaseForm({
  suppliers,
  medicines,
  saving,
  error,
  onClose,
  onSave,
}: PurchaseFormProps) {
  const [supplierId, setSupplierId] = useState("");

  const [lines, setLines] = useState<PurchaseDraftItem[]>(
    [newItem()]
  );

  const [validation, setValidation] = useState("");

  const total = useMemo(() => {
    return lines.reduce(
      (sum, line) =>
        sum +
        (Number(line.quantity) || 0) *
          (Number(line.unit_cost) || 0),
      0
    );
  }, [lines]);

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
      current.filter((item) => item.key !== key)
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    if (!supplierId) {
      setValidation("Please select a supplier.");
      return;
    }

    if (lines.length < 1 || lines.length > 100) {
      setValidation(
        "Purchase must contain between 1 and 100 items."
      );
      return;
    }

    const selectedMedicines = new Set<string>();

    for (const line of lines) {
      if (!line.medicine_id) {
        setValidation(
          "Please select a medicine for every item."
        );
        return;
      }

      if (selectedMedicines.has(line.medicine_id)) {
        setValidation(
          "The same medicine cannot be added twice. " +
          "Combine its quantities into one line."
        );
        return;
      }

      selectedMedicines.add(line.medicine_id);

      const quantity = Number(line.quantity);

      if (
        !Number.isSafeInteger(quantity) ||
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
          "Unit cost must be a valid non-negative " +
          "amount with up to 2 decimal places."
        );
        return;
      }
    }

    setValidation("");
    await onSave(supplierId, lines);
  }

  return (
    <form
      className="purchase-form"
      onSubmit={(event) => void submit(event)}
    >
      <label className="purchase-field">
        <span>Supplier *</span>

        <select
          required
          value={supplierId}
          disabled={saving}
          onChange={(event) =>
            setSupplierId(event.target.value)
          }
        >
          <option value="">Select supplier</option>

          {suppliers.map((supplier) => (
            <option
              key={supplier.id}
              value={supplier.id}
            >
              {supplier.name}
            </option>
          ))}
        </select>
      </label>

      <div className="purchase-section-heading">
        <div>
          <h3>Purchase items</h3>
          <p>
            Select medicines, quantity and purchase
            unit cost.
          </p>
        </div>

        <button
          type="button"
          className="purchase-btn secondary"
          disabled={saving || lines.length >= 100}
          onClick={() =>
            setLines((current) => [
              ...current,
              newItem(),
            ])
          }
        >
          <Plus size={16} />
          Add item
        </button>
      </div>

      <div className="purchase-items">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="purchase-item-card"
          >
            <div className="purchase-item-heading">
              <strong>Item {index + 1}</strong>

              <button
                type="button"
                className="purchase-icon-button danger"
                aria-label="Remove item"
                disabled={saving || lines.length === 1}
                onClick={() => removeLine(line.key)}
              >
                <Trash2 size={17} />
              </button>
            </div>

            <div className="purchase-form-grid">
              <label className="purchase-field purchase-full">
                <span>Medicine *</span>

                <select
                  required
                  disabled={saving}
                  value={line.medicine_id}
                  onChange={(event) =>
                    updateLine(
                      line.key,
                      "medicine_id",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select medicine
                  </option>

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
                  required
                  min="1"
                  max="1000000"
                  step="1"
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
                <span>Unit Cost *</span>

                <input
                  type="number"
                  required
                  min="0"
                  max="9999999999.99"
                  step="0.01"
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
              Line Total:{" "}
              <strong>
                {money(
                  (Number(line.quantity) || 0) *
                    (Number(line.unit_cost) || 0)
                )}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <div className="purchase-total">
        <span>Estimated Purchase Total</span>
        <strong>{money(total)}</strong>
      </div>

      {(validation || error) && (
        <div
          className="purchase-notice error"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{validation || error}</span>
        </div>
      )}

      <div className="purchase-form-actions">
        <button
          type="button"
          className="purchase-btn secondary"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="purchase-btn primary"
          disabled={
            saving ||
            suppliers.length === 0 ||
            medicines.length === 0
          }
        >
          {saving ? (
            <Loader2
              size={17}
              className="purchase-spin"
            />
          ) : (
            <ShoppingCart size={17} />
          )}

          {saving
            ? "Creating..."
            : "Create Purchase"}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// RECEIVE PURCHASE FORM
// ============================================================

function ReceiveForm({
  purchase,
  medicines,
  saving,
  error,
  onClose,
  onSave,
}: ReceiveFormProps) {
  const [lines, setLines] = useState<
    ReceiveDraftLine[]
  >(
    purchase.items.map((item) => ({
      purchase_order_item_id: item.id,
      medicine_id: item.medicine_id,
      batch_number: "",
      manufactured_at: "",
      expires_at: "",
    }))
  );

  const [validation, setValidation] =
    useState("");

  function updateLine(
    itemId: string,
    field:
      | "batch_number"
      | "manufactured_at"
      | "expires_at",
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

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    if (!isDraft(purchase.status)) {
      setValidation(
        "Only draft purchases can be received."
      );
      return;
    }

    if (lines.length === 0) {
      setValidation(
        "This purchase has no items to receive."
      );
      return;
    }

    for (const line of lines) {
      const batchNumber =
        line.batch_number.trim();

      if (
        !batchNumber ||
        batchNumber.length > 100
      ) {
        setValidation(
          "Every item needs a batch number " +
          "(maximum 100 characters)."
        );
        return;
      }

      if (
        !validDate(line.expires_at)
      ) {
        setValidation(
          "Every item requires a valid expiry date."
        );
        return;
      }

      if (
        line.manufactured_at &&
        !validDate(line.manufactured_at)
      ) {
        setValidation(
          "Manufacturing date is invalid."
        );
        return;
      }

      if (
        line.manufactured_at &&
        line.manufactured_at >= line.expires_at
      ) {
        setValidation(
          "Expiry date must be later than " +
          "manufacturing date."
        );
        return;
      }

      if (line.expires_at <= today()) {
        setValidation(
          "Expired medicines cannot be received " +
          "into saleable stock using this form."
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
          Enter the actual batch number and expiry
          date printed on each medicine package.
          Receiving will add the purchased quantity
          to Inventory.
        </p>
      </div>

      <div className="purchase-items">
        {lines.map((line, index) => {
          const medicine = medicines.find(
            (item) =>
              item.id === line.medicine_id
          );

          const orderItem = purchase.items.find(
            (item) =>
              item.id ===
              line.purchase_order_item_id
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
                    Ordered Quantity:{" "}
                    {orderItem?.quantity ?? "—"}
                    {" | "}
                    Unit Cost:{" "}
                    {money(
                      orderItem?.unit_cost ?? 0
                    )}
                  </p>
                </div>
              </div>

              <div className="purchase-form-grid">
                <label className="purchase-field purchase-full">
                  <span>Batch Number *</span>

                  <input
                    required
                    maxLength={100}
                    placeholder="e.g. OMI-BATCH-001"
                    value={line.batch_number}
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
                  <span>Manufacturing Date</span>

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
                  <span>Expiry Date *</span>

                  <input
                    required
                    type="date"
                    min={today()}
                    value={line.expires_at}
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
        <div
          className="purchase-notice error"
          role="alert"
        >
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
          disabled={
            saving ||
            lines.length === 0
          }
        >
          {saving ? (
            <Loader2
              size={17}
              className="purchase-spin"
            />
          ) : (
            <ClipboardCheck size={17} />
          )}

          {saving
            ? "Receiving..."
            : "Confirm Receive"}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// PURCHASES PAGE
// ============================================================

export default function PurchasesPage() {
  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [suppliers, setSuppliers] =
    useState<SupplierOption[]>([]);

  const [medicines, setMedicines] =
    useState<MedicineOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [listError, setListError] =
    useState<string | null>(null);

  const [formError, setFormError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] =
    useState(false);

  const [receiveTarget, setReceiveTarget] =
    useState<Purchase | null>(null);

  const [detailsTarget, setDetailsTarget] =
    useState<Purchase | null>(null);

  // ==========================================================
  // LOAD PURCHASE DATA
  // ==========================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const results = await Promise.allSettled([
        getPurchases(),
        getPurchaseSuppliers(),
        getPurchaseMedicines(),
      ]);

      if (results[0].status === "fulfilled") {
        setPurchases(results[0].value);
      } else {
        setListError(
          errorMessage(results[0].reason)
        );
      }

      if (results[1].status === "fulfilled") {
        setSuppliers(results[1].value);
      } else {
        setListError(
          (current) =>
            current ??
            `Suppliers: ${
              errorMessage(results[1].reason)
            }`
        );
      }

      if (results[2].status === "fulfilled") {
        setMedicines(results[2].value);
      } else {
        setListError(
          (current) =>
            current ??
            `Medicines: ${
              errorMessage(results[2].reason)
            }`
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ==========================================================
  // LOOKUP MAPS
  // ==========================================================

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

  // ==========================================================
  // SEARCH FILTER
  // ==========================================================

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return purchases;

    return purchases.filter((purchase) => {
      const searchable = [
        purchase.order_number,
        purchase.status,
        purchase.id,
        supplierNames.get(purchase.supplier_id) ??
          "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [purchases, search, supplierNames]);

  // ==========================================================
  // STATS
  // ==========================================================

  const stats = useMemo(() => {
    const received = purchases.filter(
      (purchase) => isReceived(purchase.status)
    ).length;

    const drafts = purchases.filter(
      (purchase) => isDraft(purchase.status)
    ).length;

    const other =
      purchases.length - received - drafts;

    return {
      total: purchases.length,
      received,
      drafts,
      other,

      value: purchases.reduce(
        (sum, purchase) =>
          sum +
          (Number(purchase.total_amount) || 0),
        0
      ),
    };
  }, [purchases]);

  // ==========================================================
  // CREATE PURCHASE
  // ==========================================================

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
          unit_cost:
            Number(line.unit_cost).toFixed(2),
        })),
      });

      setCreateOpen(false);

      setNotice({
        type: "success",
        message:
          `Purchase ${purchase.order_number} ` +
          "created successfully. " +
          "Use Receive to add stock.",
      });

      await loadData();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // OPEN RECEIVE FORM
  // ==========================================================

  async function openReceive(purchase: Purchase) {
    if (saving || !isDraft(purchase.status)) {
      return;
    }

    setFormError(null);

    // Refresh the record before opening the form.
    try {
      const latest = await getPurchase(
        purchase.id
      );

      if (!isDraft(latest.status)) {
        setNotice({
          type: "error",
          message:
            "This purchase is no longer in draft status.",
        });

        await loadData();
        return;
      }

      setReceiveTarget(latest);
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error),
      });
    }
  }

  // ==========================================================
  // RECEIVE PURCHASE
  // ==========================================================

  async function submitReceive(
    lines: ReceiveDraftLine[]
  ) {
    if (!receiveTarget || saving) return;

    setSaving(true);
    setFormError(null);

    try {
      // Recheck status to prevent receiving
      // a purchase already processed elsewhere.
      const latest = await getPurchase(
        receiveTarget.id
      );

      if (!isDraft(latest.status)) {
        throw new Error(
          "This purchase has already changed status. " +
          "Please refresh the list."
        );
      }

      const updated = await receivePurchase(
        latest.id,
        {
          items: lines.map((line) => ({
            purchase_order_item_id:
              line.purchase_order_item_id,

            batch_number:
              line.batch_number.trim(),

            manufactured_at:
              line.manufactured_at || null,

            expires_at:
              line.expires_at,
          })),
        }
      );

      setReceiveTarget(null);

      setNotice({
        type: "success",
        message:
          `Purchase ${updated.order_number} ` +
          "received successfully. " +
          "Inventory stock has been updated.",
      });

      await loadData();
    } catch (error) {
      setFormError(
        errorMessage(error) +
          " If the request timed out, " +
          "refresh the purchase list before retrying."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="purchases-page">
      {/* HEADER */}
      <header className="purchase-page-header">
        <div>
          <span className="purchase-eyebrow">
            PHARMACY OPERATIONS
          </span>

          <h1>Purchase Management</h1>

          <p>
            Create purchase orders, manage suppliers
            and receive medicine batches into
            inventory.
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
              className={
                loading ? "purchase-spin" : ""
              }
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

      {/* NOTICES */}
      {notice && (
        <div
          className={`purchase-notice ${notice.type}`}
          role="status"
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertCircle size={19} />
          )}

          <span>{notice.message}</span>

          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNotice(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {listError && (
        <div
          className="purchase-notice error"
          role="alert"
        >
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

      {/* PURCHASE STATS */}
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
            <small>Completed purchases</small>
          </div>
        </div>

        <div className="purchase-stat-card">
          <Truck size={22} />

          <div>
            <span>Draft Purchases</span>
            <strong>{stats.drafts}</strong>
            <small>Waiting to receive stock</small>
          </div>
        </div>

        <div className="purchase-stat-card">
          <PackagePlus size={22} />

          <div>
            <span>Purchase Value</span>

            <strong>
              {money(stats.value)}
            </strong>

            <small>
              Loaded orders only
              {stats.other > 0
                ? ` · ${stats.other} other statuses`
                : ""}
            </small>
          </div>
        </div>
      </div>

      {/* PURCHASE DIRECTORY */}
      <section className="purchase-panel">
        <div className="purchase-panel-header">
          <div>
            <h2>Purchase Orders</h2>

            <p>
              {filtered.length} orders shown
            </p>
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
            <Loader2
              size={30}
              className="purchase-spin"
            />
            <p>Loading purchases...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="purchase-empty">
            <ShoppingCart size={36} />
            <h3>No purchases found</h3>

            <p>
              Create a purchase order to start
              managing incoming stock.
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
                      ) ||
                        purchase.supplier_id.slice(
                          0,
                          8
                        )}
                    </td>

                    <td>
                      {purchase.items.length}
                    </td>

                    <td>
                      <strong>
                        {money(
                          purchase.total_amount
                        )}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={
                          `purchase-status ` +
                          getStatusClass(
                            purchase.status
                          )
                        }
                      >
                        {purchase.status}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        purchase.received_at
                      )}
                    </td>

                    <td>
                      <div className="purchase-actions">
                        {/* VIEW DETAILS */}
                        <button
                          type="button"
                          className="purchase-icon-button"
                          title="View purchase details"
                          aria-label={
                            `View ${purchase.order_number}`
                          }
                          onClick={() =>
                            setDetailsTarget(
                              purchase
                            )
                          }
                        >
                          <Eye size={17} />
                        </button>

                        {/* RECEIVE DRAFT PURCHASE */}
                        {isDraft(
                          purchase.status
                        ) && (
                          <button
                            type="button"
                            className="purchase-btn receive"
                            title="Receive medicine stock"
                            disabled={saving}
                            onClick={() =>
                              void openReceive(
                                purchase
                              )
                            }
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

      {/* CREATE PURCHASE MODAL */}
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

                <p>
                  Supplier and medicine item details
                </p>
              </div>

              <button
                type="button"
                className="purchase-icon-button"
                disabled={saving}
                onClick={() =>
                  setCreateOpen(false)
                }
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <PurchaseForm
              suppliers={suppliers}
              medicines={medicines}
              saving={saving}
              error={formError}
              onClose={() =>
                setCreateOpen(false)
              }
              onSave={submitPurchase}
            />
          </section>
        </div>
      )}

      {/* RECEIVE PURCHASE MODAL */}
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
                  Enter Batch Number and Expiry Date
                  for each medicine.
                </p>
              </div>

              <button
                type="button"
                className="purchase-icon-button"
                disabled={saving}
                onClick={() =>
                  setReceiveTarget(null)
                }
                aria-label="Close"
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
              onClose={() =>
                setReceiveTarget(null)
              }
              onSave={submitReceive}
            />
          </section>
        </div>
      )}

      {/* PURCHASE DETAILS MODAL */}
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
                onClick={() =>
                  setDetailsTarget(null)
                }
                aria-label="Close"
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
                  ) ||
                    detailsTarget.supplier_id}
                </strong>
              </div>

              <div className="purchase-detail-line">
                <span>Status</span>

                <strong>
                  {detailsTarget.status}
                </strong>
              </div>

              <div className="purchase-detail-line">
                <span>Total Amount</span>

                <strong>
                  {money(
                    detailsTarget.total_amount
                  )}
                </strong>
              </div>

              <div className="purchase-detail-line">
                <span>Received At</span>

                <strong>
                  {formatDate(
                    detailsTarget.received_at
                  )}
                </strong>
              </div>

              <h3>Order Items</h3>

              {detailsTarget.items.map((item) => (
                <div
                  className="purchase-detail-item"
                  key={item.id}
                >
                  <strong>
                    {medicineNames.get(
                      item.medicine_id
                    ) ||
                      item.medicine_id}
                  </strong>

                  <span>
                    {item.quantity}
                    {" × "}
                    {money(item.unit_cost)}
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
                onClick={() =>
                  setDetailsTarget(null)
                }
              >
                Close
              </button>

              {isDraft(
                detailsTarget.status
              ) && (
                <button
                  type="button"
                  className="purchase-btn receive"
                  onClick={() => {
                    const target = detailsTarget;

                    setDetailsTarget(null);
                    void openReceive(target);
                  }}
                >
                  <ClipboardCheck size={16} />
                  Receive Stock
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
