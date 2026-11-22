
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { AxiosError } from "axios";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import {
  getExpiringPage,
  getInventoryPage,
  getLowStock,
} from "./inventoryApi";

import {
  INVENTORY_PAGE_SIZE,
  type InventorySort,
  type InventoryTab,
  type StockItem,
  type StockStatus,
} from "./types";

import "./inventory.css";

type StatusFilter =
  | "all"
  | "healthy"
  | "low"
  | "out"
  | "expiring"
  | "expired";

const TABS: {
  id: InventoryTab;
  title: string;
}[] = [
  { id: "all", title: "All Batches" },
  { id: "low-stock", title: "Low Stock" },
  { id: "expiring", title: "Expiring" },
];

const SORT_OPTIONS: {
  value: InventorySort;
  label: string;
}[] = [
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
  {
    value: "quantity-asc",
    label: "Stock: Low to High",
  },
  {
    value: "quantity-desc",
    label: "Stock: High to Low",
  },
  {
    value: "expiry-asc",
    label: "Expiry: Earliest",
  },
  {
    value: "expiry-desc",
    label: "Expiry: Latest",
  },
];

function parseDate(value: string | null): Date | null {
  if (!value) return null;

  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    datePart
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function todayAtMidnight(): Date {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function getDaysUntilExpiry(
  value: string | null
): number | null {
  const expiry = parseDate(value);

  if (!expiry) return null;

  const today = todayAtMidnight();

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

function getStockStatus(
  item: StockItem,
  days = 30
): StockStatus {
  const daysLeft = getDaysUntilExpiry(
    item.expiry_date
  );

  if (daysLeft !== null && daysLeft < 0) {
    return "expired";
  }

  if (item.quantity <= 0) {
    return "out";
  }

  if (
    daysLeft !== null &&
    daysLeft <= days
  ) {
    return "expiring";
  }

  if (
    item.reorder_level !== null &&
    item.quantity <= item.reorder_level
  ) {
    return "low";
  }

  return "healthy";
}

function getStatusLabel(
  status: StockStatus
): string {
  const labels: Record<StockStatus, string> = {
    healthy: "Healthy",
    low: "Low Stock",
    out: "Out of Stock",
    expiring: "Expiring",
    expired: "Expired",
  };

  return labels[status];
}

function formatDate(
  value: string | null
): string {
  const date = parseDate(value);

  if (!date) return "Not specified";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      return "Session expired. Please log in again.";
    }

    if (status === 403) {
      return "You do not have permission to view inventory.";
    }

    if (status === 404) {
      return "Inventory API endpoint was not found.";
    }

    if (
      typeof data?.error?.message === "string"
    ) {
      return data.error.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    return error.message || "Inventory request failed.";
  }

  return error instanceof Error
    ? error.message
    : "Unable to load inventory.";
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

function StatusBadge({
  status,
}: {
  status: StockStatus;
}) {
  return (
    <span className={`inventory-status ${status}`}>
      <span className="inventory-status-dot" />
      {getStatusLabel(status)}
    </span>
  );
}

function ExpiryDisplay({
  value,
}: {
  value: string | null;
}) {
  const days = getDaysUntilExpiry(value);

  return (
    <div className="inventory-expiry">
      <strong>{formatDate(value)}</strong>

      {days !== null && (
        <span
          className={
            days < 0
              ? "danger"
              : days <= 30
                ? "warning"
                : ""
          }
        >
          {days < 0
            ? `${Math.abs(days)} days overdue`
            : days === 0
              ? "Expires today"
              : `${days} days remaining`}
        </span>
      )}
    </div>
  );
}

function exportCsv(items: StockItem[]) {
  const rows = [
    [
      "Medicine",
      "Medicine ID",
      "Batch",
      "Quantity",
      "Reorder Level",
      "Expiry Date",
      "Status",
    ],
    ...items.map((item) => [
      item.medicine_name,
      item.medicine_id,
      item.batch_number,
      String(item.quantity),
      item.reorder_level === null
        ? ""
        : String(item.reorder_level),
      item.expiry_date ?? "",
      getStatusLabel(getStockStatus(item)),
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const safeValue = /^[\s]*[=+\-@\t\r]/.test(
            value
          )
            ? `'${value}`
            : value;

          return `"${safeValue.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob(
    ["\uFEFF", csv],
    {
      type: "text/csv;charset=utf-8",
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `pharmapilot-inventory-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function DetailsModal({
  item,
  onClose,
}: {
  item: StockItem;
  onClose: () => void;
}) {
  const status = getStockStatus(item);

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
              BATCH INFORMATION
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
          <div>
            <span>Batch Number</span>
            <strong>
              {item.batch_number || "Not specified"}
            </strong>
          </div>

          <div>
            <span>Available Quantity</span>
            <strong>
              {item.quantity.toLocaleString()}
            </strong>
          </div>

          <div>
            <span>Reorder Level</span>
            <strong>
              {item.reorder_level === null
                ? "Not available"
                : item.reorder_level.toLocaleString()}
            </strong>
          </div>

          <div>
            <span>Expiry Date</span>
            <strong>{formatDate(item.expiry_date)}</strong>
          </div>

          <div>
            <span>Current Status</span>
            <StatusBadge status={status} />
          </div>

          <div>
            <span>Medicine ID</span>
            <strong className="inventory-mono">
              {item.medicine_id || "Not available"}
            </strong>
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
  const [tab, setTab] =
    useState<InventoryTab>("all");

  const [items, setItems] =
    useState<StockItem[]>([]);

  const [loading, setLoading] =
    useState(true);

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

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (tab === "low-stock") {
          const results = await getLowStock();

          if (!active) return;

          setItems(results);
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
  }, [tab, page, days, refreshKey]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    const results = items.filter((item) => {
      const searchable = [
        item.medicine_name,
        item.medicine_id,
        item.batch_number,
        item.id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || searchable.includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        getStockStatus(item, days) === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...results].sort((a, b) => {
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

  const stats = useMemo(() => {
    let low = 0;
    let expiring = 0;
    let healthy = 0;
    let totalUnits = 0;

    for (const item of items) {
      totalUnits += item.quantity;

      const status = getStockStatus(item, days);

      if (
        item.quantity <= 0 ||
        (
          item.reorder_level !== null &&
          item.quantity <= item.reorder_level
        )
      ) {
        low += 1;
      }

      const daysLeft = getDaysUntilExpiry(
        item.expiry_date
      );

      if (
        daysLeft !== null &&
        daysLeft >= 0 &&
        daysLeft <= days
      ) {
        expiring += 1;
      }

      if (status === "healthy") {
        healthy += 1;
      }
    }

    return {
      total: items.length,
      totalUnits,
      low,
      expiring,
      healthy,
    };
  }, [items, days]);

  function switchTab(next: InventoryTab) {
    setTab(next);
    setPage(1);
    setSearch("");
    setStatusFilter("all");
    setSelected(null);
  }

  function refresh() {
    setRefreshKey((previous) => previous + 1);
  }

  const pageLabel =
    tab === "low-stock"
      ? "Returned low-stock records"
      : `Page ${page} · ${items.length} loaded records`;

  return (
    <div className="inventory-page">
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
              loading ||
              filteredItems.length === 0
            }
            onClick={() =>
              exportCsv(filteredItems)
            }
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="inventory-stats">
        <StatCard
          title="Loaded Records"
          value={stats.total}
          subtitle={pageLabel}
          icon={Boxes}
        />

        <StatCard
          title="Stock Units"
          value={stats.totalUnits.toLocaleString()}
          subtitle="Across loaded records"
          icon={Package}
          tone="green"
        />

        <StatCard
          title="Low / Out Stock"
          value={stats.low}
          subtitle="Below reorder threshold"
          icon={AlertTriangle}
          tone="amber"
        />

        <StatCard
          title="Expiring Soon"
          value={stats.expiring}
          subtitle={`Within ${days} days`}
          icon={CalendarClock}
          tone="red"
        />
      </div>

      <section className="inventory-panel">
        <div className="inventory-panel-top">
          <div>
            <h2>Stock Directory</h2>
            <p>
              Browse and inspect your pharmacy stock.
            </p>
          </div>

          <div className="inventory-panel-indicator">
            <Activity size={16} />
            Connected to Inventory API
          </div>
        </div>

        <div
          className="inventory-tabs"
          role="tablist"
          aria-label="Inventory categories"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={
                tab === item.id ? "active" : ""
              }
              onClick={() => switchTab(item.id)}
            >
              {item.id === "all" && (
                <Boxes size={17} />
              )}

              {item.id === "low-stock" && (
                <AlertTriangle size={17} />
              )}

              {item.id === "expiring" && (
                <CalendarClock size={17} />
              )}

              {item.title}
            </button>
          ))}
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search medicine, batch or ID..."
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
                aria-label="Filter stock status"
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
                    setDays(
                      Number(event.target.value)
                    );
                    setPage(1);
                  }}
                  aria-label="Expiry window"
                >
                  <option value={7}>
                    Next 7 days
                  </option>
                  <option value={15}>
                    Next 15 days
                  </option>
                  <option value={30}>
                    Next 30 days
                  </option>
                  <option value={60}>
                    Next 60 days
                  </option>
                  <option value={90}>
                    Next 90 days
                  </option>
                  <option value={180}>
                    Next 180 days
                  </option>
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="inventory-results-bar">
          <span>
            {loading
              ? "Loading inventory..."
              : `${filteredItems.length} visible records`}
          </span>

          <span>
            {tab === "low-stock"
              ? "Low-stock overview"
              : `Page ${page}`}
          </span>
        </div>

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
          <div className="inventory-empty">
            <Package size={38} />

            <h3>No inventory records found</h3>

            <p>
              Try changing your search, filters,
              or selected inventory tab.
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
          <div className="inventory-table-scroll">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Reorder Level</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const status = getStockStatus(
                    item,
                    days
                  );

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
                              {item.medicine_id
                                ? `ID: ${item.medicine_id.slice(0, 8)}...`
                                : "Medicine ID unavailable"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="inventory-batch">
                          {item.batch_number || "—"}
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
                        {item.reorder_level === null
                          ? "—"
                          : item.reorder_level.toLocaleString()}
                      </td>

                      <td>
                        <ExpiryDisplay
                          value={item.expiry_date}
                        />
                      </td>

                      <td>
                        <StatusBadge
                          status={status}
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className="inventory-icon-button"
                          aria-label={`View ${item.medicine_name}`}
                          title="View batch details"
                          onClick={() =>
                            setSelected(item)
                          }
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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
                    setPage((previous) =>
                      Math.max(1, previous - 1)
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
                    setPage(
                      (previous) => previous + 1
                    )
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

      <div className="inventory-help">
        <CheckCircle2 size={18} />

        <span>
          Stock figures come from the Inventory API.
          Statistics, search, sorting and CSV export
          apply to the currently loaded records.
        </span>
      </div>

      {selected && (
        <DetailsModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
