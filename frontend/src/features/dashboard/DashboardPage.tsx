
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Layers3,
  Package,
  Pill,
  RefreshCw,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { api } from "../../lib/api";

import {
  loadDashboard,
  type DashboardData,
} from "./dashboardApi";

import "./dashboard.css";


type InventorySummary = {
  total_medicines: number;
  total_batches: number;
  total_units: number;
  stock_value: number;
  expiring_units: number;
};

type SummaryState = {
  data: InventorySummary | null;
  error: string | null;
};

type OverviewCardProps = {
  label: string;
  value: number | null;
  subtitle: string;
  icon: LucideIcon;
  href: string;
  variant?: "blue" | "teal" | "amber" | "rose";
};

const numberFormat = new Intl.NumberFormat("en-BD");

const currencyFormat = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

function numberFrom(value: unknown): number | null {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return null;
  }

  if (value === "") return null;

  const result = Number(value);

  return Number.isFinite(result) ? result : null;
}

function parseSummary(value: unknown): InventorySummary {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid inventory summary response");
  }

  const record = value as Record<string, unknown>;

  const fields = [
    "total_medicines",
    "total_batches",
    "total_units",
    "stock_value",
    "expiring_units",
  ] as const;

  for (const field of fields) {
    if (numberFrom(record[field]) === null) {
      throw new Error(
        `Inventory summary missing ${field}`
      );
    }
  }

  return {
    total_medicines: numberFrom(
      record.total_medicines
    )!,
    total_batches: numberFrom(
      record.total_batches
    )!,
    total_units: numberFrom(
      record.total_units
    )!,
    stock_value: numberFrom(
      record.stock_value
    )!,
    expiring_units: numberFrom(
      record.expiring_units
    )!,
  };
}

function dateText(
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

function overviewError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to refresh dashboard.";
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  href,
  variant = "blue",
}: OverviewCardProps) {
  return (
    <Link
      to={href}
      className={`ppdash-metric ppdash-metric--${variant}`}
    >
      <div className="ppdash-metric-head">
        <span className="ppdash-icon">
          <Icon size={21} />
        </span>

        <ArrowUpRight
          size={17}
          className="ppdash-muted-icon"
        />
      </div>

      <span className="ppdash-metric-label">
        {label}
      </span>

      <strong className="ppdash-metric-number">
        {value === null
          ? "—"
          : numberFormat.format(value)}
      </strong>

      <span className="ppdash-metric-caption">
        {subtitle}
      </span>
    </Link>
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
  action = "View all",
}: {
  title: string;
  subtitle: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="ppdash-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {href && (
        <Link to={href}>
          {action}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

function EmptyMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="ppdash-empty">
      <CheckCircle2 size={23} />
      <span>{message}</span>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Link className="ppdash-action" to={to}>
      <span className="ppdash-action-icon">
        <Icon size={21} />
      </span>

      <span className="ppdash-action-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <ArrowRight size={17} />
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [summary, setSummary] =
    useState<SummaryState>({
      data: null,
      error: null,
    });

  const [loading, setLoading] = useState(true);

  const [refreshError, setRefreshError] =
    useState<string | null>(null);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  // Fetch module data and inventory summary
  // separately so a failure in one does not
  // automatically hide the other.
  const refresh = useCallback(async () => {
    setLoading(true);
    setRefreshError(null);

    const [dashboardResult, summaryResult] =
      await Promise.allSettled([
        loadDashboard(),
        api.get<unknown>("/inventory/summary"),
      ]);

    if (dashboardResult.status === "fulfilled") {
      setData(dashboardResult.value);
    } else {
      setRefreshError(
        overviewError(dashboardResult.reason)
      );
    }

    if (summaryResult.status === "fulfilled") {
      try {
        setSummary({
          data: parseSummary(
            summaryResult.value.data
          ),
          error: null,
        });
      } catch (error) {
        setSummary({
          data: null,
          error: overviewError(error),
        });
      }
    } else {
      setSummary({
        data: null,
        error: overviewError(
          summaryResult.reason
        ),
      });
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
  }

  const recentPurchases = useMemo(() => {
    if (!data || data.purchases.error) {
      return [];
    }

    return [...data.purchases.data]
      .sort((a, b) =>
        (b.purchase_date ?? "").localeCompare(
          a.purchase_date ?? ""
        )
      )
      .slice(0, 5);
  }, [data]);

  const lowStock = useMemo(() => {
    if (!data || data.lowStock.error) {
      return [];
    }

    return [...data.lowStock.data]
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5);
  }, [data]);

  const expiring = useMemo(() => {
    if (!data || data.expiring.error) {
      return [];
    }

    return [...data.expiring.data]
      .sort((a, b) =>
        (a.expiry_date ?? "").localeCompare(
          b.expiry_date ?? ""
        )
      )
      .slice(0, 5);
  }, [data]);

  const moduleErrors = useMemo(() => {
    if (!data) return [];

    return [
      ["Medicines", data.medicines.error],
      ["Inventory", data.inventory.error],
      ["Low stock", data.lowStock.error],
      ["Expiring", data.expiring.error],
      ["Suppliers", data.suppliers.error],
      ["Purchases", data.purchases.error],
    ].filter(
      (row): row is [string, string] =>
        Boolean(row[1])
    );
  }, [data]);

  const liveSummary = summary.data;

  const stockValue =
    liveSummary?.stock_value ?? null;

  const expiryCount =
    data && !data.expiring.error
      ? data.expiring.data.length
      : null;

  const lowCount =
    data && !data.lowStock.error
      ? data.lowStock.data.length
      : null;

  return (
    <main className="ppdash-root">

      {/* HERO SECTION */}
      <section className="ppdash-hero">
        <div>
          <span className="ppdash-kicker">
            <span className="ppdash-kicker-dot" />
            PHARMAPILOT CONTROL CENTER
          </span>

          <h1>Pharmacy Dashboard</h1>

          <p>
            See inventory health, upcoming expiries,
            purchases and the operations that need
            attention.
          </p>

          <div className="ppdash-hero-meta">
            <Clock3 size={15} />

            {lastUpdated
              ? `Last checked ${lastUpdated.toLocaleTimeString(
                  "en-BD",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}`
              : "Not loaded yet"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="ppdash-refresh"
        >
          <RefreshCw
            size={17}
            className={
              loading ? "ppdash-spin" : ""
            }
          />

          {loading
            ? "Refreshing..."
            : "Refresh dashboard"}
        </button>
      </section>

      {/* API ERRORS */}
      {refreshError && (
        <div
          className="ppdash-error"
          role="alert"
        >
          <AlertCircle size={19} />
          <span>{refreshError}</span>
        </div>
      )}

      {summary.error && (
        <div
          className="ppdash-error"
          role="alert"
        >
          <AlertCircle size={19} />

          <span>
            Inventory summary unavailable:{" "}
            {summary.error}
          </span>
        </div>
      )}

      {moduleErrors.length > 0 && (
        <div
          className="ppdash-error"
          role="alert"
        >
          <AlertTriangle size={19} />

          <div>
            <strong>
              Some dashboard modules could not
              be loaded.
            </strong>

            <div className="ppdash-error-lines">
              {moduleErrors.map(([name, error]) => (
                <span key={name}>
                  {name}: {error}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY METRICS */}
      <section
        className="ppdash-metrics"
        aria-label="Inventory metrics"
      >
        <MetricCard
          label="Active medicines"
          value={
            liveSummary?.total_medicines ?? null
          }
          subtitle="From complete inventory summary"
          icon={Pill}
          href="/medicines"
        />

        <MetricCard
          label="Inventory batches"
          value={
            liveSummary?.total_batches ?? null
          }
          subtitle="Total batch records"
          icon={Layers3}
          href="/inventory"
          variant="teal"
        />

        <MetricCard
          label="Physical stock"
          value={
            liveSummary?.total_units ?? null
          }
          subtitle="Units across all batches"
          icon={Package}
          href="/inventory"
          variant="blue"
        />

        <MetricCard
          label="Expiring units"
          value={
            liveSummary?.expiring_units ?? null
          }
          subtitle="Within 30 days · backend metric"
          icon={CalendarClock}
          href="/inventory"
          variant="rose"
        />
      </section>

      {/* INVENTORY VALUE + ATTENTION */}
      <section
        className="ppdash-spotlight"
        aria-label="Inventory valuation"
      >
        <div className="ppdash-valuation">
          <div className="ppdash-valuation-icon">
            <Activity size={23} />
          </div>

          <div>
            <span>Inventory value at cost</span>

            <strong>
              {stockValue === null
                ? "Not available"
                : currencyFormat.format(
                    stockValue
                  )}
            </strong>

            <small>
              Physical inventory valuation from
              your API; it may include expired batches.
            </small>
          </div>
        </div>

        <div className="ppdash-attention">
          <div>
            <AlertTriangle size={20} />
            <strong>Needs attention</strong>
          </div>

          <p>
            <b>
              {lowCount === null
                ? "—"
                : numberFormat.format(lowCount)}
            </b>{" "}
            returned low-stock medicine records
          </p>

          <p>
            <b>
              {expiryCount === null
                ? "—"
                : numberFormat.format(expiryCount)}
            </b>{" "}
            loaded expiry alerts
          </p>

          <small>
            Alerts depend on the dashboard API's
            returned record limits.
          </small>

          <Link to="/inventory">
            Review inventory
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* LOW STOCK + UPCOMING EXPIRY */}
      <section className="ppdash-two-col">
        <div className="ppdash-panel">
          <SectionHeading
            title="Low-stock priorities"
            subtitle="Medicines that may need replenishment"
            href="/inventory"
            action="Open inventory"
          />

          {data?.lowStock.error ? (
            <div className="ppdash-empty">
              Low-stock data unavailable.
            </div>
          ) : !data && loading ? (
            <div className="ppdash-empty">
              Loading alerts...
            </div>
          ) : lowStock.length === 0 ? (
            <EmptyMessage
              message="No low-stock alerts in loaded results."
            />
          ) : (
            <div className="ppdash-list">
              {lowStock.map((item, index) => (
                <div
                  className="ppdash-list-row"
                  key={`${item.id}-${index}`}
                >
                  <span className="ppdash-list-symbol ppdash-list-symbol--amber">
                    <AlertTriangle size={17} />
                  </span>

                  <div className="ppdash-list-primary">
                    <strong>
                      {item.medicine_name}
                    </strong>

                    <small>
                      Medicine-level stock alert
                    </small>
                  </div>

                  <div className="ppdash-list-number">
                    <strong>
                      {numberFormat.format(
                        item.quantity
                      )}
                    </strong>
                    <small>available</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ppdash-panel">
          <SectionHeading
            title="Upcoming expiry"
            subtitle="First five records returned by the 30-day query"
            href="/inventory"
            action="Manage batches"
          />

          {data?.expiring.error ? (
            <div className="ppdash-empty">
              Expiry data unavailable.
            </div>
          ) : !data && loading ? (
            <div className="ppdash-empty">
              Loading batches...
            </div>
          ) : expiring.length === 0 ? (
            <EmptyMessage
              message="No expiry alerts in loaded results."
            />
          ) : (
            <div className="ppdash-list">
              {expiring.map((item, index) => (
                <div
                  className="ppdash-list-row"
                  key={`${item.id}-${index}`}
                >
                  <span className="ppdash-list-symbol ppdash-list-symbol--rose">
                    <CalendarClock size={17} />
                  </span>

                  <div className="ppdash-list-primary">
                    <strong>
                      {item.medicine_name}
                    </strong>

                    <small>
                      {item.batch_number ||
                        "Batch number unavailable"}
                    </small>
                  </div>

                  <div className="ppdash-list-number">
                    <strong>
                      {dateText(item.expiry_date)}
                    </strong>

                    <small>
                      {numberFormat.format(
                        item.quantity
                      )}{" "}
                      units
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PURCHASES + QUICK ACTIONS */}
      <section className="ppdash-two-col">
        <div className="ppdash-panel">
          <SectionHeading
            title="Recent purchases"
            subtitle="Most recent records from the loaded purchase list"
            href="/purchases"
          />

          {data?.purchases.error ? (
            <div className="ppdash-empty">
              Purchase data unavailable.
            </div>
          ) : !data && loading ? (
            <div className="ppdash-empty">
              Loading purchases...
            </div>
          ) : recentPurchases.length === 0 ? (
            <div className="ppdash-empty">
              No purchases in the loaded results.
            </div>
          ) : (
            <div className="ppdash-table-scroller">
              <table className="ppdash-table">
                <thead>
                  <tr>
                    <th>Purchase</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {recentPurchases.map(
                    (purchase) => (
                      <tr key={purchase.id}>
                        <td>
                          <strong>
                            {purchase.reference_number ||
                              purchase.id.slice(
                                0,
                                8
                              )}
                          </strong>
                        </td>

                        <td>
                          {dateText(
                            purchase.purchase_date
                          )}
                        </td>

                        <td>
                          {purchase.total_amount ===
                          null
                            ? "—"
                            : currencyFormat.format(
                                purchase.total_amount
                              )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ppdash-panel">
          <SectionHeading
            title="Quick actions"
            subtitle="Jump straight into daily pharmacy workflows"
          />

          <div className="ppdash-actions">
            <QuickAction
              to="/medicines"
              icon={Pill}
              label="Medicine catalog"
              description="Add and update medicine records"
            />

            <QuickAction
              to="/inventory"
              icon={Package}
              label="Inventory management"
              description="Stock adjustments and expiry alerts"
            />

            <QuickAction
              to="/purchases"
              icon={ShoppingCart}
              label="Purchase orders"
              description="Receive new batches through purchases"
            />

            <QuickAction
              to="/suppliers"
              icon={Truck}
              label="Supplier directory"
              description="Manage pharmacy suppliers"
            />

            <QuickAction
              to="/knowledge"
              icon={BookOpen}
              label="Knowledge base"
              description="Upload and search pharmacy documents"
            />

            <QuickAction
              to="/ai-chat"
              icon={Bot}
              label="AI assistant"
              description="Ask authorized pharmacy questions"
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ppdash-footer">
        <span>
          <CheckCircle2 size={15} />
          Pharmacy-scoped API data
        </span>

        <span>
          Purchase and alert previews may be
          incomplete when API pagination limits apply.
        </span>
      </footer>
    </main>
  );
}
