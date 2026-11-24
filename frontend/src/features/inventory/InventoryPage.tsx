
import { useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardEdit,
  Download,
  Eye,
  History,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import {
  getExpiringPage,
  getInventoryPage,
  getInventorySummary,
  getLowStock,
} from "./inventoryApi";

import StockManagementModal from "./StockManagementModal";

import {
  INVENTORY_PAGE_SIZE,
  type InventorySort,
  type InventorySummary,
  type InventoryTab,
  type StockItem,
  type StockStatus,
} from "./types";

import "./inventory.css";

type StatusFilter = "all" | StockStatus;

type StockAction = {
  item: StockItem;
  mode: "adjust" | "history";
};

const TABS: {
  id: InventoryTab;
  label: string;
}[] = [
  { id: "all", label: "All Batches" },
  { id: "low-stock", label: "Low Stock" },
  { id: "expiring", label: "Expiring" },
];

const SORT_OPTIONS: {
  value: InventorySort;
  label: string;
}[] = [
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
  { value: "quantity-asc", label: "Stock: Low to High" },
  { value: "quantity-desc", label: "Stock: High to Low" },
  { value: "expiry-asc", label: "Expiry: Earliest" },
  { value: "expiry-desc", label: "Expiry: Latest" },
];

function parseDate(value: string | null): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const result = new Date(year, month, day);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month ||
    result.getDate() !== day
  ) {
    return null;
  }

  return result;
}

function daysUntilExpiry(
  value: string | null
): number | null {
  const expiry = parseDate(value);
  if (!expiry) return null;

  const today = new Date();

  const expiryUTC = Date.UTC(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );

  const todayUTC = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.round(
    (expiryUTC - todayUTC) / 86400000
  );
}

function formatDate(value: string | null): string {
  const date = parseDate(value);

  return date
    ? date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not specified";
}

function getStatus(
  item: StockItem,
  days: number
): StockStatus {
  // Low-stock records represent medicines, not batches.
  if (item.source === "low-stock") {
    return item.quantity <= 0 ? "out" : "low";
  }

  // Batch records have expiry-based statuses.
  if (item.quantity <= 0) {
    return "out";
  }

  const remaining = daysUntilExpiry(item.expiry_date);

  if (remaining !== null && remaining < 0) {
    return "expired";
  }

  if (remaining !== null && remaining <= days) {
    return "expiring";
  }

  return "healthy";
}

function statusLabel(status: StockStatus): string {
  const labels: Record<StockStatus, string> = {
    healthy: "Healthy",
    low: "Low Stock",
    out: "Out of Stock",
    expiring: "Expiring",
    expired: "Expired",
  };

  return labels[status];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;

    if (status === 401) {
      return "Session expired. Please log in again.";
    }

    if (status === 403) {
      return "You do not have permission to view inventory.";
    }

    const payload: unknown = error.response?.data;

    if (payload && typeof payload === "object") {
      if ("detail" in payload) {
        if (typeof payload.detail === "string") {
          return payload.detail;
        }
      }

      if ("error" in payload) {
        const apiError = payload.error;

        if (
          apiError &&
          typeof apiError === "object" &&
          "message" in apiError &&
          typeof apiError.message === "string"
        ) {
          return apiError.message;
        }
      }
    }

    return error.message || "Inventory request failed.";
  }

  return error instanceof Error
    ? error.message
    : "Unable to load inventory.";
}

function StatusBadge({
  status,
}: {
  status: StockStatus;
}) {
  return (
    <span className={`inventory-status ${status}`}>
      <span className="inventory-status-dot" />
      {statusLabel(status)}
    </span>
  );
}

function ExpiryDisplay({
  date,
}: {
  date: string | null;
}) {
  const remaining = daysUntilExpiry(date);

  return (
    <div className="inventory-expiry">
      <strong>{formatDate(date)}</strong>

      {remaining !== null && (
        <span
          className={
            remaining < 0
              ? "danger"
              : remaining <= 30
                ? "warning"
                : ""
          }
        >
          {remaining < 0
            ? `${Math.abs(remaining)} days overdue`
            : remaining === 0
              ? "Expires today"
              : `${remaining} days remaining`}
        </span>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: typeof Package;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <article className="inventory-stat-card">
      <div className={`inventory-stat-icon ${tone}`}>
        <Icon size={21} />
      </div>

      <div className="inventory-stat-text">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{subtitle}</small>
      </div>
    </article>
  );
}

function exportCsv(
  records: StockItem[],
  days: number
) {
  const rows = [
    [
      "Medicine",
      "SKU",
      "Medicine ID",
      "Batch",
      "Quantity",
      "Reorder Level",
      "Shortage",
      "Expiry Date",
      "Status",
    ],

    ...records.map((item) => [
      item.medicine_name,
      item.sku,
      item.medicine_id,
      item.batch_number,
      String(item.quantity),
      item.reorder_level === null
        ? ""
        : String(item.reorder_level),
      item.shortage === null
        ? ""
        : String(item.shortage),
      item.expiry_date ?? "",
      statusLabel(getStatus(item, days)),
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          // Protect spreadsheet apps from formula injection.
          const safeValue = /^[\s]*[=+\-@\t\r]/.test(value)
            ? `'${value}`
            : value;

          return `"${safeValue.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `pharmapilot-inventory-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function DetailsModal({
  item,
  days,
  onClose,
}: {
  item: StockItem;
  days: number;
  onClose: () => void;
}) {
  const status = getStatus(item, days);

  const fields = [
    ["SKU", item.sku || "—"],
    [
      "Record Type",
      item.source === "low-stock"
        ? "Medicine Stock"
        : "Inventory Batch",
    ],
    ["Batch Number", item.batch_number || "—"],
    [
      item.source === "low-stock"
        ? "Usable Stock"
        : "Batch Quantity",
      item.quantity.toLocaleString(),
    ],
    [
      "Reorder Level",
      item.reorder_level === null
        ? "—"
        : item.reorder_level.toLocaleString(),
    ],
    [
      "Shortage",
      item.shortage === null
        ? "—"
        : item.shortage.toLocaleString(),
    ],
    ["Expiry Date", formatDate(item.expiry_date)],
    ["Medicine ID", item.medicine_id || "—"],
  ];

  return (
    <div
      className="inventory-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-details-title"
      >
        <div className="inventory-modal-header">
          <div>
            <span className="inventory-eyebrow">
              INVENTORY INFORMATION
            </span>

            <h2 id="inventory-details-title">
              {item.medicine_name}
            </h2>
          </div>

          <button
            type="button"
            className="inventory-icon-button"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="inventory-detail-grid">
          {fields.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}

          <div>
            <span>Status</span>
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="inventory-modal-footer">
          <button
            type="button"
            className="inventory-btn secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState<InventoryTab>("all");

  const [items, setItems] = useState<StockItem[]>([]);

  const [summary, setSummary] =
    useState<InventorySummary | null>(null);

  const [loading, setLoading] = useState(true);

  const [summaryError, setSummaryError] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [sort, setSort] =
    useState<InventorySort>("name-asc");

  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selected, setSelected] =
    useState<StockItem | null>(null);

  const [stockAction, setStockAction] =
    useState<{
      item: StockItem;
      mode: "adjust" | "history";
    } | null>(null);

  // Load inventory records.
  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (tab === "low-stock") {
          const records = await getLowStock();

          if (!active) return;

          setItems(records);
          setHasMore(false);
        } else if (tab === "expiring") {
          const result = await getExpiringPage(
            days,
            page,
            INVENTORY_PAGE_SIZE
          );

          if (!active) return;

          setItems(result.items);
          setHasMore(result.hasMore);
        } else {
          const result = await getInventoryPage(
            page,
            INVENTORY_PAGE_SIZE
          );

          if (!active) return;

          setItems(result.items);
          setHasMore(result.hasMore);
        }
      } catch (err) {
        if (!active) return;

        setItems([]);
        setHasMore(false);
        setError(getErrorMessage(err));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [tab, days, page, refreshKey]);

  // Load overall statistics from backend.
  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const result = await getInventorySummary();

        if (active) {
          setSummary(result);
          setSummaryError(false);
        }
      } catch {
        if (active) {
          setSummary(null);
          setSummaryError(true);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    const records = items.filter((item) => {
      const searchable = [
        item.medicine_name,
        item.medicine_id,
        item.sku,
        item.batch_number,
        item.id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || searchable.includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        getStatus(item, days) === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...records].sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.medicine_name.localeCompare(
            b.medicine_name
          );

        case "name-desc":
          return b.medicine_name.localeCompare(
            a.medicine_name
          );

        case "quantity-asc":
          return a.quantity - b.quantity;

        case "quantity-desc":
          return b.quantity - a.quantity;

        case "expiry-asc":
          return (
            (parseDate(a.expiry_date)?.getTime() ??
              Infinity) -
            (parseDate(b.expiry_date)?.getTime() ??
              Infinity)
          );

        case "expiry-desc":
          return (
            (parseDate(b.expiry_date)?.getTime() ??
              -Infinity) -
            (parseDate(a.expiry_date)?.getTime() ??
              -Infinity)
          );

        default:
          return 0;
      }
    });
  }, [items, search, statusFilter, sort, days]);

  function switchTab(next: InventoryTab) {
    setTab(next);
    setPage(1);
    setSearch("");
    setStatusFilter("all");
    setSelected(null);
    setStockAction(null);
  }

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function openStockAction(
    item: StockItem,
    mode: "adjust" | "history"
  ) {
    if (item.source !== "batch") return;

    setStockAction({ item, mode });
  }

  function handleStockChanged() {
    setStockAction(null);
    setSelected(null);
    refresh();
  }

  const loadedUnits = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const loadedLowCount = items.filter(
    (item) => item.source === "low-stock"
  ).length;

  return (
    <div className="inventory-page">
      {/* Page Header */}
      <header className="inventory-page-header">
        <div>
          <span className="inventory-eyebrow">
            PHARMACY OPERATIONS
          </span>

          <h1>Inventory Management</h1>

          <p>
            Monitor medicine batches, stock levels,
            reorder alerts and upcoming expiry dates.
          </p>
        </div>

        <div className="inventory-header-actions">
          <button
            type="button"
            className="inventory-btn secondary"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading ? "inventory-spin" : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="inventory-btn primary"
            disabled={
              loading || filteredItems.length === 0
            }
            onClick={() =>
              exportCsv(filteredItems, days)
            }
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="inventory-stats">
        <StatCard
          title="Total Medicines"
          value={
            summary
              ? summary.total_medicines.toLocaleString()
              : "—"
          }
          subtitle="Active medicine records"
          icon={Boxes}
        />

        <StatCard
          title="Total Batches"
          value={
            summary
              ? summary.total_batches.toLocaleString()
              : "—"
          }
          subtitle="Across selected pharmacy"
          icon={Package}
          tone="green"
        />

        <StatCard
          title="Stock Units"
          value={
            summary
              ? summary.total_units.toLocaleString()
              : "—"
          }
          subtitle="Physical stock units"
          icon={Activity}
          tone="amber"
        />

        <StatCard
          title="Expiring Units"
          value={
            summary
              ? summary.expiring_units.toLocaleString()
              : "—"
          }
          subtitle="Next 30 days (backend)"
          icon={CalendarClock}
          tone="red"
        />
      </div>

      {summaryError && (
        <div className="inventory-alert" role="alert">
          <AlertCircle size={18} />
          <span>
            Summary is unavailable. Inventory records
            may still be viewed below.
          </span>
        </div>
      )}

      {/* Inventory Panel */}
      <section className="inventory-panel">
        <div className="inventory-panel-top">
          <div>
            <h2>Stock Directory</h2>

            <p>
              Browse, inspect and manage your pharmacy
              stock.
            </p>
          </div>

          <div className="inventory-panel-indicator">
            <Activity size={16} />
            Inventory API
          </div>
        </div>

        {/* Tabs */}
        <div
          className="inventory-tabs"
          role="tablist"
          aria-label="Inventory categories"
        >
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={tab === option.id}
              className={
                tab === option.id ? "active" : ""
              }
              onClick={() => switchTab(option.id)}
            >
              {option.id === "all" ? (
                <Boxes size={17} />
              ) : option.id === "low-stock" ? (
                <AlertTriangle size={17} />
              ) : (
                <CalendarClock size={17} />
              )}

              {option.label}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search medicine, SKU, batch..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              aria-label="Search inventory"
            />
          </div>

          <div className="inventory-filters">
            <label className="inventory-select">
              <SlidersHorizontal size={16} />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as StatusFilter
                  )
                }
                aria-label="Filter status"
              >
                <option value="all">
                  All Statuses
                </option>
                <option value="healthy">
                  Healthy
                </option>
                <option value="low">
                  Low Stock
                </option>
                <option value="out">
                  Out of Stock
                </option>
                <option value="expiring">
                  Expiring
                </option>
                <option value="expired">
                  Expired
                </option>
              </select>
            </label>

            <label className="inventory-select">
              <ArrowDownUp size={16} />

              <select
                value={sort}
                onChange={(event) =>
                  setSort(
                    event.target.value as InventorySort
                  )
                }
                aria-label="Sort inventory"
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {tab === "expiring" && (
              <label className="inventory-select">
                <CalendarClock size={16} />

                <select
                  value={days}
                  onChange={(event) => {
                    setDays(Number(event.target.value));
                    setPage(1);
                  }}
                  aria-label="Expiry period"
                >
                  {[7, 15, 30, 60, 90, 180].map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        Next {value} days
                      </option>
                    )
                  )}
                </select>
              </label>
            )}
          </div>
        </div>

        {/* Results Bar */}
        <div className="inventory-results-bar">
          <span>
            {loading
              ? "Loading inventory..."
              : `${filteredItems.length} visible records`}
          </span>

          <span>
            {tab === "low-stock"
              ? "Medicine-level stock"
              : `Page ${page}`}
          </span>
        </div>

        {/* Error State */}
        {error && (
          <div
            className="inventory-alert"
            role="alert"
          >
            <AlertCircle size={20} />
            <span>{error}</span>

            <button
              type="button"
              onClick={refresh}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="inventory-loading">
            {Array.from({ length: 6 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="inventory-skeleton"
                />
              )
            )}
          </div>
        ) : error ? null : filteredItems.length === 0 ? (
          /* Empty State */
          <div className="inventory-empty">
            <Package size={38} />

            <h3>No inventory records found</h3>

            <p>
              Try changing your search, filters or
              selected inventory tab.
            </p>

            <button
              type="button"
              className="inventory-btn secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Stock Table */
          <div className="inventory-table-scroll">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Medicine</th>

                  <th>
                    {tab === "low-stock"
                      ? "SKU"
                      : "Batch"}
                  </th>

                  <th>
                    {tab === "low-stock"
                      ? "Usable Stock"
                      : "Batch Quantity"}
                  </th>

                  <th>
                    {tab === "low-stock"
                      ? "Shortage"
                      : "Reorder Level"}
                  </th>

                  <th>
                    {tab === "low-stock"
                      ? "Reorder Level"
                      : "Expiry Date"}
                  </th>

                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const status = getStatus(item, days);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-medicine-cell">
                          <div className="inventory-medicine-icon">
                            <Package size={19} />
                          </div>

                          <div>
                            <strong>
                              {item.medicine_name}
                            </strong>

                            <span>
                              {item.sku ||
                                item.medicine_id.slice(
                                  0,
                                  8
                                )}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="inventory-batch">
                          {tab === "low-stock"
                            ? item.sku || "—"
                            : item.batch_number || "—"}
                        </span>
                      </td>

                      <td>
                        <strong
                          className={
                            item.quantity <= 0
                              ? "inventory-quantity danger"
                              : "inventory-quantity"
                          }
                        >
                          {item.quantity.toLocaleString()}
                        </strong>
                      </td>

                      <td>
                        {tab === "low-stock"
                          ? item.shortage?.toLocaleString() ??
                            "—"
                          : item.reorder_level?.toLocaleString() ??
                            "—"}
                      </td>

                      <td>
                        {tab === "low-stock"
                          ? item.reorder_level?.toLocaleString() ??
                            "—"
                          : (
                            <ExpiryDisplay
                              date={item.expiry_date}
                            />
                          )}
                      </td>

                      <td>
                        <StatusBadge status={status} />
                      </td>

                      {/* New Stock Management Actions */}
                      <td>
                        <div className="stock-action-buttons">
                          <button
                            type="button"
                            title="View inventory details"
                            onClick={() =>
                              setSelected(item)
                            }
                          >
                            <Eye size={15} />
                            View
                          </button>

                          {item.source === "batch" && (
                            <>
                              <button
                                type="button"
                                title="Adjust existing batch stock"
                                onClick={() =>
                                  openStockAction(
                                    item,
                                    "adjust"
                                  )
                                }
                              >
                                <ClipboardEdit size={15} />
                                Adjust
                              </button>

                              <button
                                type="button"
                                title="View stock movement history"
                                onClick={() =>
                                  openStockAction(
                                    item,
                                    "history"
                                  )
                                }
                              >
                                <History size={15} />
                                History
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && (
          <div className="inventory-footer">
            <span>
              Showing {filteredItems.length} of{" "}
              {items.length} loaded records
            </span>

            {tab !== "low-stock" && (
              <div className="inventory-pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                >
                  <ChevronLeft size={17} />
                  Previous
                </button>

                <span>Page {page}</span>

                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={() =>
                    setPage((value) => value + 1)
                  }
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Information */}
      <div className="inventory-help">
        <AlertTriangle size={18} />

        <span>
          Inventory summary comes from the backend.
          Search, sorting and CSV export apply only
          to loaded records. Low Stock uses
          medicine-level quantities, not individual
          batch quantities.
        </span>
      </div>

      {tab === "low-stock" && !loading && !error && (
        <div className="inventory-help">
          <span>
            Low Stock Records: {loadedLowCount}.
            Units in Loaded Records:{" "}
            {loadedUnits.toLocaleString()}.
          </span>
        </div>
      )}

      {/* Details Modal */}
      {selected && (
        <DetailsModal
          item={selected}
          days={days}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Stock Adjustment / History Modal */}
      {stockAction && (
        <StockManagementModal
          item={stockAction.item}
          mode={stockAction.mode}
          onClose={() => setStockAction(null)}
          onChanged={handleStockChanged}
        />
      )}
    </div>
  );
}
