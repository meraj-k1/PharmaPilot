
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router";

import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  BookOpen,
  CalendarClock,
  CircleCheck,
  Package,
  Pill,
  RefreshCw,
  ShoppingCart,
  Truck,
} from "lucide-react";

import {
  loadDashboard,
  type DashboardData,
} from "./dashboardApi";

import "./dashboard.css";

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

function formatMoney(value: number | null): string {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

type StatCardProps = {
  title: string;
  value: number | null;
  icon: typeof Pill;
  href: string;
  description: string;
  tone?: "default" | "warning" | "danger";
};

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  description,
  tone = "default",
}: StatCardProps) {
  return (
    <Link
      to={href}
      className={`analytics-stat ${tone}`}
    >
      <div className="analytics-stat-top">
        <div className="analytics-stat-icon">
          <Icon size={22} />
        </div>
        <ArrowUpRight size={18} />
      </div>

      <span>{title}</span>

      <strong>
        {value === null
          ? "Unavailable"
          : value.toLocaleString()}
      </strong>

      <small>{description}</small>
    </Link>
  );
}

function ModuleLink({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof Pill;
}) {
  return (
    <Link className="analytics-module-link" to={href}>
      <div className="analytics-module-icon">
        <Icon size={20} />
      </div>

      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <ArrowUpRight size={17} />
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRefreshError(null);

    try {
      const result = await loadDashboard();
      setData(result);
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Dashboard refresh failed."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    if (!data) return null;

    return {
      medicines: data.medicines.error
        ? null
        : data.medicines.data.length,

      inventory: data.inventory.error
        ? null
        : data.inventory.data.length,

      lowStock: data.lowStock.error
        ? null
        : data.lowStock.data.length,

      expiring: data.expiring.error
        ? null
        : data.expiring.data.length,

      suppliers: data.suppliers.error
        ? null
        : data.suppliers.data.length,

      purchases: data.purchases.error
        ? null
        : data.purchases.data.length,
    };
  }, [data]);

  const recentPurchases = useMemo(() => {
    if (!data || data.purchases.error) return [];

    return [...data.purchases.data]
      .sort((a, b) =>
        (b.purchase_date ?? "").localeCompare(
          a.purchase_date ?? ""
        )
      )
      .slice(0, 5);
  }, [data]);

  const lowStockPreview = useMemo(() => {
    if (!data || data.lowStock.error) return [];

    return data.lowStock.data.slice(0, 5);
  }, [data]);

  const chartRows = useMemo(() => {
    if (!stats) return [];

    return [
      { label: "Medicines", value: stats.medicines },
      { label: "Stock records", value: stats.inventory },
      { label: "Low-stock results", value: stats.lowStock },
      { label: "Expiry results", value: stats.expiring },
      { label: "Suppliers", value: stats.suppliers },
      { label: "Purchases", value: stats.purchases },
    ];
  }, [stats]);

  const maxChartValue = Math.max(
    1,
    ...chartRows.map((row) => row.value ?? 0)
  );

  const apiErrors = data
    ? [
        ["Medicines", data.medicines.error],
        ["Inventory", data.inventory.error],
        ["Low stock", data.lowStock.error],
        ["Expiry", data.expiring.error],
        ["Suppliers", data.suppliers.error],
        ["Purchases", data.purchases.error],
      ].filter((entry) => entry[1])
    : [];

  return (
    <div className="analytics-dashboard">
      <header className="analytics-heading">
        <div>
          <span className="eyebrow">
            PHARMAPILOT OVERVIEW
          </span>
          <h1>Dashboard</h1>
          <p>
            Your pharmacy operations at a glance.
          </p>
        </div>

        <button
          type="button"
          className="analytics-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "analytics-spin" : ""}
          />
          {loading ? "Loading..." : "Refresh data"}
        </button>
      </header>

      {refreshError && (
        <div className="analytics-error" role="alert">
          <AlertCircle size={18} />
          {refreshError}
        </div>
      )}

      {apiErrors.length > 0 && (
        <div className="analytics-error" role="alert">
          <AlertTriangle size={19} />

          <div>
            <strong>
              Some dashboard sections could not load.
            </strong>

            {apiErrors.map(([name, error]) => (
              <p key={name}>
                {name}: {error}
              </p>
            ))}
          </div>
        </div>
      )}

      <section className="analytics-stats-grid">
        <StatCard
          title="Medicines"
          value={stats?.medicines ?? null}
          icon={Pill}
          href="/medicines"
          description="Loaded catalog records"
        />

        <StatCard
          title="Stock Records"
          value={stats?.inventory ?? null}
          icon={Package}
          href="/inventory"
          description="Loaded inventory records"
        />

        <StatCard
          title="Low Stock"
          value={stats?.lowStock ?? null}
          icon={AlertTriangle}
          href="/inventory"
          description="Records from alert endpoint"
          tone="warning"
        />

        <StatCard
          title="Expiring Batches"
          value={stats?.expiring ?? null}
          icon={CalendarClock}
          href="/inventory"
          description="Records within 30-day query"
          tone="danger"
        />

        <StatCard
          title="Suppliers"
          value={stats?.suppliers ?? null}
          icon={Truck}
          href="/suppliers"
          description="Loaded supplier records"
        />

        <StatCard
          title="Purchases"
          value={stats?.purchases ?? null}
          icon={ShoppingCart}
          href="/purchases"
          description="Loaded purchase records"
        />
      </section>

      <div className="analytics-content-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Operations snapshot</h2>
              <p>Comparison of loaded API record counts</p>
            </div>
          </div>

          <div className="analytics-chart">
            {chartRows.map((row) => {
              const width =
                row.value === null
                  ? 0
                  : (row.value / maxChartValue) * 100;

              return (
                <div
                  key={row.label}
                  className="analytics-chart-row"
                >
                  <span>{row.label}</span>

                  <div className="analytics-chart-track">
                    <div
                      className="analytics-chart-fill"
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  <strong>
                    {row.value === null
                      ? "N/A"
                      : row.value}
                  </strong>
                </div>
              );
            })}
          </div>

          <p className="analytics-chart-note">
            These are record counts from different
            datasets, not comparable financial values.
          </p>
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Quick access</h2>
              <p>Open pharmacy management tools</p>
            </div>
          </div>

          <div className="analytics-module-list">
            <ModuleLink
              title="Medicine catalog"
              description="Manage medicines"
              href="/medicines"
              icon={Pill}
            />

            <ModuleLink
              title="Inventory"
              description="Review stock and expiry"
              href="/inventory"
              icon={Package}
            />

            <ModuleLink
              title="Knowledge base"
              description="Upload and search documents"
              href="/knowledge"
              icon={BookOpen}
            />

            <ModuleLink
              title="AI Assistant"
              description="Ask PharmaPilot AI"
              href="/ai-chat"
              icon={Bot}
            />
          </div>
        </section>
      </div>

      <div className="analytics-content-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Low-stock preview</h2>
              <p>First five returned alert records</p>
            </div>

            <Link to="/inventory">
              View inventory
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {data?.lowStock.error ? (
            <div className="analytics-empty">
              Low-stock data unavailable.
            </div>
          ) : lowStockPreview.length === 0 ? (
            <div className="analytics-empty">
              <CircleCheck size={28} />
              No low-stock records returned.
            </div>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Quantity</th>
                  </tr>
                </thead>

                <tbody>
                  {lowStockPreview.map((item, index) => (
                    <tr key={`${item.id}-${index}`}>
                      <td>
                        <strong>
                          {item.medicine_name}
                        </strong>
                      </td>

                      <td>
                        {item.batch_number || "—"}
                      </td>

                      <td>
                        {item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Recent purchases</h2>
              <p>Most recent loaded purchase records</p>
            </div>

            <Link to="/purchases">
              View purchases
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {data?.purchases.error ? (
            <div className="analytics-empty">
              Purchase data unavailable.
            </div>
          ) : recentPurchases.length === 0 ? (
            <div className="analytics-empty">
              No purchase records returned.
            </div>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Purchase</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {recentPurchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>
                        <strong>
                          {purchase.reference_number ||
                            purchase.id.slice(0, 8)}
                        </strong>
                      </td>

                      <td>
                        {formatDate(purchase.purchase_date)}
                      </td>

                      <td>
                        {formatMoney(purchase.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <footer className="analytics-footer">
        <span>
          {loading
            ? "Loading dashboard data..."
            : data
              ? `Last refreshed: ${new Date(
                  data.updatedAt
                ).toLocaleString()}`
              : "Dashboard data not loaded"}
        </span>

        <span>
          Dataset counts may be limited by API pagination.
        </span>
      </footer>
    </div>
  );
}
