
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { AxiosError } from "axios";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  X,
} from "lucide-react";

import {
  adjustStock,
  getStockMovements,
  type StockMovement,
} from "./inventoryApi";

import type { StockItem } from "./types";

import "./stock-management.css";

type Mode = "adjust" | "history";

type Props = {
  item: StockItem;
  mode: Mode;
  onClose: () => void;
  onChanged: () => void;
};

function readableError(
  error: unknown
): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;

    if (status === 401) {
      return "Session expired. Please log in again.";
    }

    if (status === 403) {
      return "Only an authorized pharmacy admin may adjust stock.";
    }

    if (status === 409) {
      return "Stock adjustment rejected. Refresh and retry.";
    }

    const payload: unknown =
      error.response?.data;

    if (
      payload &&
      typeof payload === "object"
    ) {
      const data = payload as Record<
        string,
        unknown
      >;

      if (typeof data.detail === "string") {
        return data.detail;
      }

      if (
        data.error &&
        typeof data.error === "object" &&
        "message" in data.error
      ) {
        const message = (
          data.error as {
            message?: unknown;
          }
        ).message;

        if (typeof message === "string") {
          return message;
        }
      }
    }

    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Request failed.";
}

export default function StockManagementModal({
  item,
  mode,
  onClose,
  onChanged,
}: Props) {
  const [direction, setDirection] =
    useState<"add" | "remove">("remove");

  const [quantity, setQuantity] =
    useState("1");

  const [reason, setReason] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [history, setHistory] =
    useState<StockMovement[]>([]);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [historyOffset, setHistoryOffset] =
    useState(0);

  const [hasMore, setHasMore] =
    useState(false);

  useEffect(() => {
    if (mode !== "history") return;

    let active = true;

    setLoadingHistory(true);
    setError(null);

    getStockMovements(
      item.id,
      50,
      historyOffset
    )
      .then((records) => {
        if (!active) return;

        setHistory(records);
        setHasMore(
          records.length === 50
        );
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            readableError(err)
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [item.id, mode, historyOffset]);

  const numericQuantity =
    Number(quantity);

  const validQuantity =
    Number.isSafeInteger(numericQuantity) &&
    numericQuantity > 0;

  const delta =
    direction === "add"
      ? numericQuantity
      : -numericQuantity;

  const after = item.quantity + delta;

  const valid =
    validQuantity &&
    reason.trim().length > 0 &&
    after >= 0;

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!valid || saving || success) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await adjustStock(
        item.id,
        delta,
        reason
      );

      setSuccess(
        "Adjustment saved successfully."
      );

      onChanged();
    } catch (err) {
      setError(
        readableError(err)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="stock-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <section
        className="stock-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-modal-title"
      >
        <header className="stock-modal-header">
          <div>
            <span className="stock-modal-eyebrow">
              {item.medicine_name}
              {" · "}
              {item.batch_number || "Batch"}
            </span>

            <h2 id="stock-modal-title">
              {mode === "adjust"
                ? "Adjust Stock"
                : "Stock Movement History"}
            </h2>
          </div>

          <button
            className="stock-icon-btn"
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        {mode === "adjust" ? (
          <form
            className="stock-modal-body"
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <div className="stock-current">
              <span>Current Batch Stock</span>

              <strong>
                {item.quantity.toLocaleString()}
                {" "}units
              </strong>
            </div>

            <p className="stock-help">
              Use Purchase Receiving for newly
              purchased stock. Adjustments are
              intended for stock count corrections,
              damage or documented losses.
              Admin permission is required.
            </p>

            <div className="stock-direction">
              <button
                type="button"
                className={
                  direction === "add"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setDirection("add")
                }
              >
                <ArrowUpCircle size={18} />
                Add (+)
              </button>

              <button
                type="button"
                className={
                  direction === "remove"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setDirection("remove")
                }
              >
                <ArrowDownCircle size={18} />
                Remove (-)
              </button>
            </div>

            <label htmlFor="stock-adjust-qty">
              Quantity
            </label>

            <input
              id="stock-adjust-qty"
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value
                )
              }
            />

            <label htmlFor="stock-adjust-reason">
              Reason
            </label>

            <textarea
              id="stock-adjust-reason"
              value={reason}
              maxLength={500}
              rows={3}
              required
              placeholder="e.g. Damaged units found during physical stock count"
              onChange={(event) =>
                setReason(
                  event.target.value
                )
              }
            />

            <div className="stock-current">
              <span>
                Expected Stock After Adjustment
              </span>

              <strong
                className={
                  after < 0
                    ? "stock-danger"
                    : ""
                }
              >
                {validQuantity
                  ? after.toLocaleString()
                  : "—"}
                {" "}units
              </strong>
            </div>

            {validQuantity && after < 0 && (
              <p
                className="stock-danger"
                role="alert"
              >
                Cannot remove more stock
                than the batch contains.
              </p>
            )}

            {error && (
              <p
                className="stock-danger"
                role="alert"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                className="stock-success"
                role="status"
              >
                {success}
              </p>
            )}

            <footer className="stock-modal-actions">
              <button
                type="button"
                className="stock-secondary-btn"
                onClick={onClose}
              >
                Close
              </button>

              <button
                type="submit"
                className="stock-primary-btn"
                disabled={
                  !valid ||
                  saving ||
                  success !== null
                }
              >
                {saving
                  ? "Saving..."
                  : "Confirm Adjustment"}
              </button>
            </footer>
          </form>
        ) : (
          <div className="stock-modal-body">
            <p className="stock-help">
              <History
                size={16}
                style={{
                  verticalAlign: "middle",
                }}
              />
              {" "}Stock movement audit trail
              for this batch.
            </p>

            {loadingHistory ? (
              <p>Loading history...</p>
            ) : error ? (
              <p
                className="stock-danger"
                role="alert"
              >
                {error}
              </p>
            ) : history.length === 0 ? (
              <p>
                No stock movements recorded
                for this batch.
              </p>
            ) : (
              <div className="stock-history-scroll">
                <table className="stock-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Change</th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Reason</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map((movement) => (
                      <tr key={movement.id}>
                        <td>
                          {movement.created_at
                            ? new Date(
                                movement.created_at
                              ).toLocaleString()
                            : "—"}
                        </td>

                        <td>
                          {movement.movement_type ||
                            "—"}
                        </td>

                        <td
                          className={
                            movement.quantity_delta < 0
                              ? "stock-danger"
                              : "stock-success"
                          }
                        >
                          {movement.quantity_delta > 0
                            ? "+"
                            : ""}
                          {movement.quantity_delta}
                        </td>

                        <td>
                          {movement.quantity_before}
                        </td>

                        <td>
                          {movement.quantity_after}
                        </td>

                        <td>
                          {movement.reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="stock-modal-actions">
              <button
                type="button"
                className="stock-secondary-btn"
                onClick={onClose}
              >
                Close
              </button>

              <button
                type="button"
                className="stock-secondary-btn"
                disabled={
                  historyOffset === 0 ||
                  loadingHistory
                }
                onClick={() =>
                  setHistoryOffset((n) =>
                    Math.max(0, n - 50)
                  )
                }
              >
                Previous
              </button>

              <button
                type="button"
                className="stock-secondary-btn"
                disabled={
                  !hasMore ||
                  loadingHistory
                }
                onClick={() =>
                  setHistoryOffset(
                    (n) => n + 50
                  )
                }
              >
                Next
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
